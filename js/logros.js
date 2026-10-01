// Logros: se calculan con lo que el caminante ya hace. Los secretos no se muestran hasta conseguirlos.
// Andy puede añadir o renombrar logros en ruta.json → "logros": [{ id, nombre, texto, simbolo, secreto }]
// (la condición de los logros propios de la ruta todavía no es configurable: usan las de aquí por id).
import { h, hoja } from './ui.js';
import { t, tx } from './i18n.js';
import { estado, todosSellos, guardarProgreso } from './core.js';
import { diasOrdenados } from './viaje.js';

const hora = (ts) => new Date(ts).getHours();

export const LOGROS = [
  { id: 'primer-paso', simbolo: '◦', nombre: { es: 'Primer paso', en: 'First step' }, texto: { es: 'Tu primer sello.', en: 'Your first stamp.' },
    ok: (P) => Object.keys(P.sellos).length >= 1 },
  { id: 'madrugador', simbolo: '☼', nombre: { es: 'Madrugador', en: 'Early riser' }, texto: { es: 'Un sello antes de las 8 de la mañana.', en: 'A stamp before 8 am.' },
    ok: (P) => Object.values(P.sellos).some((s) => hora(s.ts) < 8) },
  { id: 'noctambulo', simbolo: '☾', secreto: true, nombre: { es: 'Noctámbulo', en: 'Night owl' }, texto: { es: 'Un sello después de las 21 h.', en: 'A stamp after 9 pm.' },
    ok: (P) => Object.values(P.sellos).some((s) => hora(s.ts) >= 21) },
  { id: 'cronista', simbolo: '✎', nombre: { es: 'Cronista', en: 'Chronicler' }, texto: { es: 'Tres días cerrados con su diario.', en: 'Three days closed with a diary entry.' },
    ok: (P) => Object.values(P.dias).filter((d) => d.cerrado && (d.diario || '').trim()).length >= 3 },
  { id: 'primera-persona', simbolo: '☺', nombre: { es: 'Compañía', en: 'Company' }, texto: { es: 'La primera persona en tu orla.', en: 'The first person in your yearbook.' },
    ok: (P) => P.gente.length >= 1 },
  { id: 'buena-gente', simbolo: '☻', nombre: { es: 'Buena gente', en: 'Good people' }, texto: { es: 'Cinco personas en tu orla.', en: 'Five people in your yearbook.' },
    ok: (P) => P.gente.length >= 5 },
  { id: 'sin-prisa', simbolo: '∞', nombre: { es: 'Sin prisa', en: 'No hurry' }, texto: { es: 'Una etapa repartida en dos días o más.', en: 'One stage spread over two days or more.' },
    ok: (P, R) => R.etapas.some((e) => new Set(e.sellos.filter((s) => P.sellos[s.id]).map((s) => new Date(P.sellos[s.id].ts).toDateString())).size >= 2) },
  { id: 'ojo-fino', simbolo: '◉', secreto: true, nombre: { es: 'Ojo fino', en: 'Sharp eye' }, texto: { es: 'Todos los sellos ocultos.', en: 'Every hidden stamp.' },
    ok: (P) => { const o = todosSellos().filter((s) => s.oculto); return o.length > 0 && o.every((s) => P.sellos[s.id]); } },
  { id: 'cazador', simbolo: '✧', nombre: { es: 'Cazador', en: 'Hunter' }, texto: { es: 'Tu primera figura capturada.', en: 'Your first captured figure.' },
    ok: (P) => Object.keys(P.capturas).length >= 1 },
  { id: 'coleccionista', simbolo: '✦', nombre: { es: 'Coleccionista', en: 'Collector' }, texto: { es: 'Todas las figuras de la ruta.', en: 'Every figure on the route.' },
    ok: (P) => { const l = todosSellos(); return l.length > 0 && l.every((s) => P.capturas[s.id]); } },
  { id: 'mensajero', simbolo: '✉', nombre: { es: 'Mensajero', en: 'Messenger' }, texto: { es: 'Dejaste un mensaje secreto en el camino.', en: 'You left a secret message on the trail.' },
    ok: (P) => P.enviados.length >= 1 },
  { id: 'buzon', simbolo: '✶', nombre: { es: 'Buzón', en: 'Mailbox' }, texto: { es: 'Encontraste un mensaje secreto.', en: 'You found a secret message.' },
    ok: (P) => P.mensajes.some((m) => m.abierto) },
  { id: 'diez-dias', simbolo: 'Ⅹ', secreto: true, nombre: { es: 'Diez soles', en: 'Ten suns' }, texto: { es: 'Diez días en el camino.', en: 'Ten days on the trail.' },
    ok: () => diasOrdenados().length >= 10 },
  { id: 'peregrino', simbolo: '✠', nombre: { es: 'Ruta completa', en: 'Route completed' }, texto: { es: 'Todos los sellos de la ruta.', en: 'Every stamp on the route.' },
    ok: (P) => !!P.completada },
];

// Nombres y textos propios de la ruta (si Andy los define en ruta.json) sustituyen a los de aquí.
export function logros() {
  const propios = Object.fromEntries((estado.ruta.logros || []).map((l) => [l.id, l]));
  return LOGROS.map((l) => ({ ...l, ...(propios[l.id] || {}), ok: l.ok }));
}

// Comprueba logros nuevos, los guarda y los celebra uno tras otro.
export async function comprobarLogros() {
  const P = estado.prog, R = estado.ruta;
  const nuevos = logros().filter((l) => !P.logros[l.id] && safe(() => l.ok(P, R)));
  if (!nuevos.length) return [];
  nuevos.forEach((l) => (P.logros[l.id] = Date.now()));
  await guardarProgreso();
  for (const l of nuevos) await celebrar(l);
  return nuevos;
}

function safe(fn) { try { return fn(); } catch { return false; } }

function celebrar(l) {
  return new Promise((ok) => {
    const cont = h('div.logro-nuevo', {},
      h('div.medalla.grande.ganada', {}, l.simbolo),
      h('span.mono', {}, t('logroNuevo')),
      h('h2', {}, tx(l.nombre)),
      h('p.lead', {}, tx(l.texto)));
    const { cerrar } = hoja(cont, { clase: 'centrada' });
    cont.append(h('div.botones', {}, h('button.btn', { onclick: () => { cerrar(); setTimeout(ok, 300); } }, t('continuar'))));
  });
}

export function medalla(l, ganado) {
  return h('div.logro' + (ganado ? '.ganado' : ''), {},
    h('div.medalla' + (ganado ? '.ganada' : ''), {}, ganado || !l.secreto ? l.simbolo : '?'),
    h('strong', {}, ganado || !l.secreto ? tx(l.nombre) : t('logroSecreto')),
    h('span.mut', {}, ganado || !l.secreto ? tx(l.texto) : ''));
}
