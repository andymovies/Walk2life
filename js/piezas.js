// Piezas compartidas por todas las pantallas.
import { h, hoja, textoAutor } from './ui.js';
import { t, tx } from './i18n.js';
import { estado, medio } from './core.js';
import { dibujarSello, dibujarInsignia, lienzo, fechaCorta, fuentesListas } from './graficos.js';

export const app = document.getElementById('app');
export const MAX_FOTOS = 3;
export const MARCA = 'Walk2life';

// El enrutador vive en app.js; aquí solo se expone para poder repintar desde cualquier módulo.
let _pintar = async () => {};
export const registrarPintar = (fn) => { _pintar = fn; };
export const pintar = () => _pintar();
export const ir = (hash) => { location.hash = hash; };

export function cabecera(volver) {
  let toques = 0, reloj;
  const marca = h('button.marca', {
    onclick: () => {
      // siete toques seguidos en la marca (arriba a la izquierda) abren el modo autor
      toques++;
      clearTimeout(reloj);
      reloj = setTimeout(() => (toques = 0), 1500);
      if (toques >= 7) { toques = 0; ir('#/autor'); }
      else if (!volver) ir('#/');
    },
  }, MARCA);
  return h('header.barra', {},
    volver ? h('button.enlace', { onclick: () => (history.length > 1 ? history.back() : ir(volver)) }, '← ' + t('volver')) : marca,
    h('button.enlace', { onclick: () => ir('#/ajustes') }, t('ajustes')));
}

// ---------------- piezas ----------------
export function canvasInsignia(tam, ganada) {
  const { c, ctx } = lienzo(tam);
  const R = estado.ruta;
  const pintarla = () => {
    ctx.clearRect(0, 0, tam, tam);
    dibujarInsignia(ctx, tam / 2, tam / 2, tam * 0.46, { nombre: tx(R.insignia?.nombre) || tx(R.subtitulo), codigo: R.titulo, ganada });
  };
  pintarla();
  fuentesListas().then(pintarla);
  c.className = 'insignia' + (ganada ? ' ganada' : '');
  return c;
}

export function canvasSello(s, tam) {
  const { c, ctx } = lienzo(tam);
  const p = estado.prog.sellos[s.id];
  const pintarlo = () => {
    ctx.clearRect(0, 0, tam, tam);
    dibujarSello(ctx, tam / 2, tam / 2, tam * 0.44, { id: s.id, nombre: tx(s.nombre), etapa: s.etapa, fecha: p ? fechaCorta(p.ts) : '' });
  };
  pintarlo();
  fuentesListas().then(pintarlo);
  c.className = 'sello-canvas';
  return c;
}

export function barra(frac) {
  return h('div.progreso', {}, h('i', { style: { width: Math.round(frac * 100) + '%' } }));
}

export async function bloqueMedios(b) {
  if (!b) return null;
  const el = h('div.medios');
  for (const f of [b.foto, ...(b.fotos || [])].filter(Boolean)) {
    el.append(h('img', { src: await medio(f), loading: 'lazy', alt: '' }));
  }
  if (b.audio) el.append(h('audio', { controls: true, preload: 'none', src: await medio(b.audio) }));
  if (b.video) el.append(h('a.btn.sec', { href: b.video, target: '_blank', rel: 'noopener' }, `▶ ${t('verVideo')} · ${t('necesitaConexion')}`));
  return el;
}

export async function bloqueSorpresa(s, abierta) {
  if (!s) return null;
  if (!abierta) return h('div.sorpresa.cerrada', {}, h('span.mono', {}, '✦ ' + t('sorpresa')), h('p.mut', {}, t('sorpresaBloqueada')));
  return h('div.sorpresa', {},
    h('span.mono', {}, '✦ ' + t('sorpresa')),
    s.titulo ? h('h3', {}, tx(s.titulo)) : null,
    textoAutor(tx(s.texto)),
    await bloqueMedios(s));
}

// Preguntas una a una, sin obligar. Devuelve las respuestas o null si se cancela.
export function preguntas(titulo, lista, previas = []) {
  return new Promise((ok) => {
    const resp = [...previas];
    let i = 0;
    const cont = h('div.preguntas');
    const { cerrar } = hoja(cont, { clase: 'completa' });
    const paso = () => {
      cont.innerHTML = '';
      const area = h('textarea', { rows: 5, placeholder: t('respuesta'), value: resp[i] || '' });
      const sig = () => {
        resp[i] = area.value.trim();
        if (++i < lista.length) paso();
        else { cerrar(); ok(resp); }
      };
      cont.append(
        h('span.mono', {}, `${titulo} · ${i + 1}/${lista.length}`),
        h('h2.pregunta', {}, tx(lista[i])),
        area,
        h('div.botones', {},
          h('button.btn', { onclick: sig }, i + 1 < lista.length ? t('continuar') : t('guardar')),
          h('button.btn.sec', { onclick: () => { area.value = ''; sig(); } }, t('omitir'))),
        h('button.enlace.x', { onclick: () => { cerrar(); ok(null); } }, t('cerrar')));
      setTimeout(() => area.focus(), 350);
    };
    paso();
  });
}

