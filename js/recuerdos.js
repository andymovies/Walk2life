// "Recuerdos": días del diario, logros, álbum de figuras, insignia y entregables.
import { h } from './ui.js';
import { t, tx, getIdioma } from './i18n.js';
import { estado, todosSellos, cuenta } from './core.js';
import { urlBlob } from './db.js';
import { app, cabecera, canvasInsignia } from './piezas.js';
import { diasOrdenados, numeroDia, fechaLarga, kmDia, kmTotales, contenidoDia } from './viaje.js';
import { logros, medalla } from './logros.js';
import { figuraProvisional } from './captura.js';

const kmTxt = (n) => (n == null ? '—' : n.toFixed(1).replace('.', ','));

export async function pantallaRecuerdos() {
  const P = estado.prog;
  app.append(cabecera());
  const c = cuenta();

  app.append(h('section.final-cab', { onclick: () => (location.hash = '#/final') },
    canvasInsignia(170, !!P.completada),
    h('span.mono', {}, t('insignia')),
    h('h1', {}, tx(estado.ruta.insignia?.nombre)),
    h('p.mut', {}, P.completada ? t('rutaCompletada') : c.faltan === 1 ? t('faltaSello') : t('faltanSellos', { n: c.faltan }))));

  app.append(h('section.cifras.grandes', {},
    h('div', {}, h('span.num', {}, String(diasOrdenados().length)), h('span.mono', {}, t('dias'))),
    h('div', {}, h('span.num', {}, kmTxt(kmTotales())), h('span.mono', {}, 'km')),
    h('div', {}, h('span.num', {}, String(P.gente.length)), h('span.mono', {}, t('personas')))));

  app.append(h('section.centro', {}, h('a.btn', { href: '#/final' }, t('entregables'))));

  // días
  const dias = h('section.dias', {}, h('h2.seccion', {}, t('tuDiario')));
  if (!diasOrdenados().length) dias.append(h('p.mut', {}, t('sinDias')));
  for (const k of diasOrdenados()) {
    const d = P.dias[k];
    const cont = contenidoDia(k);
    const n = cont.sellos.length + cont.entradas.length + cont.gente.length;
    dias.append(h('a.etapa-card', { href: '#/dia/' + k },
      h('span.n', {}, String(numeroDia(k)).padStart(2, '0')),
      h('div', {},
        h('strong', {}, fechaLarga(k, getIdioma())),
        h('span.mut', {}, `${kmTxt(kmDia(d))} km · ${t('momentosN', { n })}`),
        d.diario ? h('span.mono', {}, d.diario.slice(0, 60) + (d.diario.length > 60 ? '…' : '')) : null)));
  }
  app.append(dias);

  // logros
  const lista = logros();
  const ganados = lista.filter((l) => P.logros[l.id]).length;
  const zona = h('section.logros', {}, h('h2.seccion', {}, `${t('logros')} · ${ganados}/${lista.length}`));
  const grid = h('div.logros-grid');
  for (const l of lista) grid.append(medalla(l, !!P.logros[l.id]));
  zona.append(grid);
  app.append(zona);

  // álbum de figuras
  const album = h('section.album', {}, h('h2.seccion', {}, `${t('figuras')} · ${Object.keys(P.capturas).length}/${todosSellos().length}`));
  const ga = h('div.album-grid');
  for (const s of todosSellos()) {
    const cap = P.capturas[s.id];
    if (cap) ga.append(h('a.figura-celda.ganada', { href: '#/sello/' + s.id }, h('img', { src: await urlBlob(cap.foto), alt: '' })));
    else {
      const f = figuraProvisional(s.id, 160);
      f.className = 'silueta';
      ga.append(h('div.figura-celda', {}, f));
    }
  }
  album.append(ga);
  app.append(album);
}
