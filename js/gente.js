// La orla: gente del camino. Fichas sencillas: fotos, nombre y unas líneas (con el contacto si se quiere).
import { h, hoja, toast, confirmar } from './ui.js';
import { t, tx } from './i18n.js';
import { estado, guardarProgreso, buscarSello } from './core.js';
import { blobs, urlBlob } from './db.js';
import { comprimirFoto, elegirFotos } from './media.js';
import { app, cabecera, pintar, ir, selectorCuando } from './piezas.js';
import { posicionRapida, lugarCercano, registrarActividad, claveDia, numeroDia, esHoy } from './viaje.js';
import { comprobarLogros } from './logros.js';
import { fechaCorta } from './graficos.js';

const MAX = 4;

// Elegir fotos: cámara en el momento o galería.
function botonesFoto(alElegir) {
  const camara = () => new Promise((ok) => {
    const i = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    i.onchange = () => ok([...(i.files || [])]);
    i.click();
  });
  return h('div.botones', {},
    h('button.btn.sec', { onclick: async () => alElegir(await camara()) }, '◉ ' + t('hacerFoto')),
    h('button.btn.sec', { onclick: async () => alElegir(await elegirFotos(true)) }, '▦ ' + t('deGaleria')));
}

export function fichaPersona(id = null) {
  const P = estado.prog;
  const previa = id ? P.gente.find((g) => g.id === id) : null;
  const fotos = [...((previa && previa.fotos) || [])];
  const nombre = h('input', { type: 'text', value: previa ? previa.nombre : '', placeholder: t('nombrePersona'), autocomplete: 'off' });
  const texto = h('textarea', { rows: 5, value: previa ? previa.texto : '', placeholder: t('textoPersona') });
  const cuando = selectorCuando(previa ? previa.ts : Date.now());
  const galeria = h('div.miniaturas');
  const pintarFotos = async () => {
    galeria.innerHTML = '';
    for (const f of fotos) {
      galeria.append(h('div.mini', {}, h('img', { src: await urlBlob(f), alt: '' }),
        h('button', { onclick: () => { fotos.splice(fotos.indexOf(f), 1); pintarFotos(); } }, '×')));
    }
  };
  const anadir = async (files) => {
    for (const f of files.slice(0, MAX - fotos.length)) fotos.push(await blobs.guardar(await comprimirFoto(f), 'gente'));
    pintarFotos();
  };
  const cont = h('div.form-recuerdo', {},
    h('span.mono', {}, t('gente')),
    h('h2', {}, previa ? previa.nombre || t('persona') : t('nuevaPersona')),
    galeria, botonesFoto(anadir),
    h('p.mut.peq', {}, t('pidePermiso')),
    h('label', {}, h('span.mono', {}, t('nombrePersona')), nombre),
    h('label', {}, h('span.mono', {}, t('sobrePersona')), texto),
    cuando.el,
    h('p.mut.peq', {}, t('personaDespues')));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        if (!nombre.value.trim() && !fotos.length) { toast(t('faltaNombre')); return; }
        if (previa) {
          for (const f of previa.fotos || []) if (!fotos.includes(f)) await blobs.del(f);
          Object.assign(previa, { nombre: nombre.value.trim(), texto: texto.value.trim(), fotos, ts: cuando.valor() });
          await guardarProgreso();
        } else {
          const ts = cuando.valor();
          const pos = esHoy(ts) ? await posicionRapida(5000) : null;
          const lugar = lugarCercano(pos);
          P.gente.push({ id: 'g' + Date.now().toString(36), ts, nombre: nombre.value.trim(), texto: texto.value.trim(), fotos, pos, lugar: lugar ? lugar.id : null });
          registrarActividad(pos, lugar, ts);
          await guardarProgreso();
        }
        cerrar();
        await comprobarLogros();
        pintar();
      },
    }, t('guardar')),
    h('button.btn.sec', { onclick: cerrar }, t('cancelar')),
    previa ? h('button.enlace.peligro', {
      onclick: async () => {
        if (!(await confirmar(t('borrarPersona'), t('borrar'), t('cancelar')))) return;
        for (const f of previa.fotos || []) await blobs.del(f);
        P.gente = P.gente.filter((g) => g !== previa);
        await guardarProgreso();
        cerrar();
        ir('#/gente');
      },
    }, t('borrar')) : null));
  pintarFotos();
}

export async function pantallaGente() {
  const P = estado.prog;
  app.append(cabecera());
  app.append(h('section.cab-etapa', {},
    h('span.mono', {}, t('orlaSub')),
    h('h1', {}, t('gente')),
    h('p.mut', {}, P.gente.length ? t('personasN', { n: P.gente.length }) : t('orlaVacia'))));
  const grid = h('section.orla');
  for (const g of [...P.gente].sort((a, b) => a.ts - b.ts)) {
    const foto = g.fotos && g.fotos[0] ? h('img', { src: await urlBlob(g.fotos[0]), alt: '' }) : h('span.inicial', {}, (g.nombre || '?').slice(0, 1).toUpperCase());
    grid.append(h('a.retrato', { href: '#/persona/' + g.id }, h('div.cara', {}, foto), h('strong', {}, g.nombre || '—'), h('span.mono', {}, t('dia') + ' ' + numeroDia(claveDia(g.ts)))));
  }
  grid.append(h('button.retrato.nuevo', { onclick: () => fichaPersona() }, h('div.cara', {}, '+'), h('strong', {}, t('nuevaPersona'))));
  app.append(grid);
}

export async function pantallaPersona(id) {
  const g = estado.prog.gente.find((x) => x.id === id);
  if (!g) return ir('#/gente');
  app.append(cabecera('#/gente'));
  const lugar = g.lugar ? buscarSello(g.lugar) : null;
  const sec = h('section.persona', {},
    h('span.mono', {}, `${t('dia')} ${numeroDia(claveDia(g.ts))} · ${fechaCorta(g.ts)}${lugar ? ' · ' + tx(lugar.nombre) : ''}`),
    h('h1', {}, g.nombre || '—'));
  const fotos = h('div.medios');
  for (const f of g.fotos || []) fotos.append(h('img', { src: await urlBlob(f), alt: '' }));
  sec.append(fotos);
  if (g.texto) sec.append(h('p.frase', {}, g.texto));
  sec.append(h('button.btn.sec', { onclick: () => fichaPersona(g.id) }, t('editar')));
  app.append(sec);
}
