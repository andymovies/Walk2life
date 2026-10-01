// El viaje del caminante: días, entradas de diario, posición y kilómetros.
// Es independiente de las etapas: cada uno camina a su ritmo.
import { estado, base, todosSellos, sellado, guardarProgreso } from './core.js';
import { distancia, posicionActual } from './media.js';

// ---------- fechas ----------
export function claveDia(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const diasOrdenados = () => Object.keys(estado.prog.dias).sort();
export const numeroDia = (clave) => {
  const i = diasOrdenados().indexOf(clave);
  return i < 0 ? diasOrdenados().length + 1 : i + 1;
};
export function fechaLarga(clave, idioma = 'es') {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString(idioma, { weekday: 'long', day: 'numeric', month: 'long' });
}

// ---------- posición ----------
// Intenta obtener la posición sin bloquear: si en unos segundos no llega, se sigue sin ella.
export async function posicionRapida(ms = 8000) {
  try {
    const p = await Promise.race([posicionActual(), new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo')), ms))]);
    estado.ultimaPos = { ...p, ts: Date.now() };
    return p;
  } catch {
    return null;
  }
}

// ---------- trazado de la ruta (GPX convertido a [[lat, lon], ...]) ----------
let track = null; // { puntos, acum } con acumulado en km
export async function cargarTrack() {
  track = null;
  const ref = estado.ruta.track;
  if (!ref) return null;
  try {
    const url = ref.startsWith('idb:') ? null : base() + ref;
    if (!url) return null;
    const puntos = await (await fetch(url)).json();
    const acum = [0];
    for (let i = 1; i < puntos.length; i++) {
      acum.push(acum[i - 1] + distancia({ lat: puntos[i - 1][0], lon: puntos[i - 1][1] }, { lat: puntos[i][0], lon: puntos[i][1] }) / 1000);
    }
    track = { puntos, acum };
  } catch {
    track = null;
  }
  return track;
}
export const hayTrack = () => !!track;
export const kmTotalTrack = () => (track ? track.acum[track.acum.length - 1] : null);

// Proyecta una posición sobre el trazado: km recorridos desde el inicio y distancia al trazado (m).
export function kmEnTrack(pos) {
  if (!track || !pos) return null;
  const { puntos, acum } = track;
  const kx = Math.cos(pos.lat * Math.PI / 180) * 111.32, ky = 110.57; // km por grado
  let mejor = { d: Infinity, km: 0 };
  for (let i = 1; i < puntos.length; i++) {
    const ax = puntos[i - 1][1] * kx, ay = puntos[i - 1][0] * ky;
    const bx = puntos[i][1] * kx, by = puntos[i][0] * ky;
    const px = pos.lon * kx, py = pos.lat * ky;
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy || 1e-12;
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
    const d = Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
    if (d < mejor.d) mejor = { d, km: acum[i - 1] + u * (acum[i] - acum[i - 1]) };
  }
  return { km: mejor.km, dist: mejor.d * 1000 };
}

// Punto kilométrico de un lugar: el que puso Andy, o el calculado sobre el trazado.
export function kmLugar(s) {
  if (!s) return null;
  if (typeof s.km === 'number') return s.km;
  if (s.lat != null && track) return kmEnTrack({ lat: s.lat, lon: s.lon }).km;
  return null;
}

// ---------- lugares ----------
// Lugar con sello más cercano (si hay coordenadas a menos de 3 km); si no, el último sellado.
export function lugarCercano(pos) {
  const lista = todosSellos();
  if (pos) {
    let mejor = null, dm = 3000;
    for (const s of lista) {
      if (s.lat == null) continue;
      const d = distancia(pos, s);
      if (d < dm) { dm = d; mejor = s; }
    }
    if (mejor) return mejor;
  }
  return ultimoSellado();
}
export function ultimoSellado() {
  let ult = null;
  for (const s of todosSellos()) {
    const p = estado.prog.sellos[s.id];
    if (p && (!ult || p.ts > estado.prog.sellos[ult.id].ts)) ult = s;
  }
  return ult;
}

// ---------- días ----------
export function dia(clave = claveDia(), crear = true) {
  const D = estado.prog.dias;
  if (!D[clave] && crear) D[clave] = { inicio: null, ultimo: null, fin: null, objetivo: null, diario: '', kmManual: null, cerrado: null };
  return D[clave];
}

// Punto (posición + km + lugar) a partir de una posición y/o un sello.
function punto(pos, sello, ts = Date.now()) {
  const km = pos && track ? kmEnTrack(pos).km : kmLugar(sello);
  return { ts, pos: pos || null, km: km ?? null, lugar: sello ? sello.id : null };
}

// Cualquier cosa que hace el caminante abre el día (si no lo estaba) y actualiza el último punto.
// También sirve para cosas añadidas después (ts de otro día): se apuntan en su día, sin GPS.
export function registrarActividad(pos, sello = null, ts = Date.now()) {
  const d = dia(claveDia(ts));
  const lugar = sello || lugarCercano(pos);
  const p = punto(pos, lugar, ts);
  if (!d.inicio || ts < d.inicio.ts) d.inicio = p;
  if (!d.ultimo || ts >= d.ultimo.ts) d.ultimo = p;
  return d;
}

// ¿Es de hoy? Lo añadido a otro día no usa GPS (no estás allí).
export const esHoy = (ts) => claveDia(ts) === claveDia();

// Hora para algo añadido a otro día: la hora actual de ese día, o las 21:00 si es un día pasado.
export function tsParaDia(clave) {
  if (clave === claveDia()) return Date.now();
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(a, m - 1, d, 21, 0, 0).getTime();
}

export function kmDia(d) {
  if (!d) return null;
  if (typeof d.kmManual === 'number') return d.kmManual;
  const fin = d.fin || d.ultimo;
  if (d.inicio && fin && d.inicio.km != null && fin.km != null) return Math.abs(fin.km - d.inicio.km);
  return null;
}

export const kmTotales = () => Object.values(estado.prog.dias).reduce((a, d) => a + (kmDia(d) || 0), 0);

// Todo lo que pasó un día: sellos, entradas, gente, capturas y mensajes abiertos.
export function contenidoDia(clave) {
  const P = estado.prog;
  const enDia = (ts) => ts && claveDia(ts) === clave;
  return {
    sellos: todosSellos().filter((s) => P.sellos[s.id] && enDia(P.sellos[s.id].ts)).sort((a, b) => P.sellos[a.id].ts - P.sellos[b.id].ts),
    entradas: P.entradas.filter((e) => enDia(e.ts)),
    gente: P.gente.filter((g) => enDia(g.ts)),
    capturas: Object.entries(P.capturas).filter(([, c]) => enDia(c.ts)).map(([id, c]) => ({ id, ...c })),
    mensajes: P.mensajes.filter((m) => enDia(m.abierto)),
  };
}

// Progreso hacia el objetivo del día: por km si hay trazado, si no por sellos.
export function progresoObjetivo(clave = claveDia(), pos = estado.ultimaPos) {
  const d = dia(clave, false);
  if (!d || !d.objetivo) return null;
  const lista = todosSellos();
  const obj = lista.find((s) => s.id === d.objetivo);
  if (!obj) return null;
  const kmObj = kmLugar(obj);
  const kmIni = d.inicio && d.inicio.km;
  const kmAhora = pos && track ? kmEnTrack(pos).km : d.ultimo && d.ultimo.km;
  if (kmObj != null && kmIni != null && kmAhora != null && kmObj !== kmIni) {
    const total = Math.abs(kmObj - kmIni);
    const hecho = Math.min(total, Math.max(0, (kmAhora - kmIni) * Math.sign(kmObj - kmIni)));
    return { tipo: 'km', frac: hecho / total, hecho, total, obj };
  }
  // por sellos: los que hay entre el primer sello pendiente al empezar el día y el objetivo
  const iObj = lista.indexOf(obj);
  const desde = d.inicio && d.inicio.lugar ? Math.max(0, lista.findIndex((s) => s.id === d.inicio.lugar)) : 0;
  const tramo = lista.slice(Math.min(desde, iObj), iObj + 1);
  const hechos = tramo.filter((s) => sellado(s.id)).length;
  return { tipo: 'sellos', frac: tramo.length ? hechos / tramo.length : 0, hecho: hechos, total: tramo.length, obj };
}

// Día anterior con actividad que quedó sin cerrar.
export function diaSinCerrar() {
  const hoy = claveDia();
  return diasOrdenados().filter((k) => k < hoy && !estado.prog.dias[k].cerrado).pop() || null;
}

// Crear una entrada de diario (foto, nota o voz).
// Crear una entrada de diario. `cuando` (ts) y `lugarId` permiten añadirla después a otro día o lugar.
export async function nuevaEntrada(datos, { cuando = Date.now(), lugarId = null } = {}) {
  const pos = esHoy(cuando) ? await posicionRapida(5000) : null;
  const lugar = lugarId ? todosSellos().find((s) => s.id === lugarId) : lugarCercano(pos);
  const e = { id: 'n' + Date.now().toString(36), ts: cuando, pos, lugar: lugar ? lugar.id : null, ...datos };
  if (!esHoy(cuando)) e.despues = Date.now();
  estado.prog.entradas.push(e);
  registrarActividad(pos, lugar, cuando);
  await guardarProgreso();
  return e;
}
