// Ruta (contenido de Andy) + progreso (lo que hace el caminante).
import { kv, urlBlob } from './db.js';

export const estado = {
  rutaId: null,
  ruta: null,       // contenido publicado, o el borrador del modo autor si existe
  publicada: null,  // contenido publicado tal cual
  prog: null,       // progreso del caminante en esta ruta
  perfil: null,     // { nombre }
};

export const base = (id = estado.rutaId) => `rutas/${id}/`;

export async function cargarRuta(id) {
  const r = await fetch(base(id) + 'ruta.json');
  const publicada = await r.json();
  const borrador = await kv.get('borrador:' + id);
  estado.rutaId = id;
  estado.publicada = publicada;
  estado.ruta = borrador || publicada;
  estado.prog = completarProgreso((await kv.get('progreso:' + id)) || nuevoProgreso());
  estado.perfil = (await kv.get('perfil')) || { nombre: '' };
  return estado.ruta;
}

function nuevoProgreso() {
  return { salida: null, etapas: {}, sellos: {}, completada: null, carta: null };
}

// Campos del viaje (días, diario, gente, logros, capturas, mensajes). Se rellenan también en progresos antiguos.
function completarProgreso(p) {
  p.entradas ||= [];   // notas, fotos y voz del diario: { id, ts, tipo, texto, fotos, audio, pos, lugar }
  p.dias ||= {};       // 'AAAA-MM-DD' → { inicio, ultimo, fin, objetivo, diario, kmManual, cerrado }
  p.gente ||= [];      // fichas de personas: { id, ts, nombre, texto, fotos, pos, lugar }
  p.logros ||= {};     // id → ts
  p.capturas ||= {};   // selloId → { ts, foto }
  p.mensajes ||= [];   // mensajes secretos recibidos
  p.enviados ||= [];   // mensajes secretos enviados
  p.papel ||= [];      // fotos de la credencial en papel (opcional)
  return p;
}

export const guardarProgreso = () => kv.set('progreso:' + estado.rutaId, estado.prog);
export const guardarPerfil = () => kv.set('perfil', estado.perfil);

// Resuelve una referencia de medio: "idb:<id>" (guardado en el móvil, modo autor) o ruta relativa.
export async function medio(ref) {
  if (!ref) return '';
  if (ref.startsWith('idb:')) return urlBlob(ref.slice(4));
  if (/^https?:/.test(ref)) return ref;
  return base() + ref;
}

// Lista de todos los medios de la ruta (para descargarla sin conexión).
export function mediosRuta(ruta = estado.publicada, soloEtapa = null) {
  const lista = [];
  const add = (x) => { if (x && !x.startsWith('idb:') && !/^https?:/.test(x)) lista.push(base(ruta.id) + x); };
  const bloque = (b) => { if (!b) return; add(b.foto); add(b.audio); (b.fotos || []).forEach(add); };
  if (soloEtapa == null) { add(ruta.musica); add(ruta.track); bloque(ruta.sorpresaFinal); }
  for (const e of ruta.etapas) {
    if (soloEtapa != null && e.n !== soloEtapa) continue;
    bloque(e.sorpresa);
    for (const s of e.sellos) { bloque(s); bloque(s.sorpresa); add(s.figura); }
  }
  return lista;
}

// ---- consultas de progreso ----
export const todosSellos = () => estado.ruta.etapas.flatMap((e) => e.sellos.map((s) => ({ ...s, etapa: e.n })));
export const etapa = (n) => estado.ruta.etapas.find((e) => e.n === +n);
export const buscarSello = (id) => todosSellos().find((s) => s.id === id);
export const sellado = (id) => !!estado.prog.sellos[id];
export const progEtapa = (n) => (estado.prog.etapas[n] ||= { inicio: null, respInicio: [], fin: null, respFin: [] });

export function cuenta(n = null) {
  const lista = n == null ? todosSellos() : etapa(n).sellos;
  const hechos = lista.filter((s) => sellado(s.id)).length;
  return { hechos, total: lista.length, faltan: lista.length - hechos };
}

export function siguienteSello(n) {
  return etapa(n).sellos.find((s) => !sellado(s.id) && !s.oculto) || etapa(n).sellos.find((s) => !sellado(s.id));
}

export const etapaTerminada = (n) => !!(estado.prog.etapas[n] && estado.prog.etapas[n].fin);
export const rutaCompleta = () => estado.ruta.etapas.every((e) => etapaTerminada(e.n)) && cuenta().faltan === 0;

export function comprobarFinal() {
  if (rutaCompleta() && !estado.prog.completada) {
    estado.prog.completada = Date.now();
    return true;
  }
  return false;
}

// Días entre hoy y una fecha (redondeado por días de calendario).
export function diasHasta(fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha); f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
}

export function fechaCarta() {
  const c = estado.prog.carta;
  if (!c) return null;
  return new Date(c.cerrada + (estado.ruta.cartaFutura?.dias || 365) * 86400000);
}
