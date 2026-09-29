// Credencial digital · app del caminante.
import { h, toast, hoja, confirmar, textoAutor } from './ui.js';
import { t, tx, IDIOMAS, getIdioma, setIdioma } from './i18n.js';
import { kv, blobs, urlBlob, pedirPersistencia, espacio } from './db.js';
import {
  estado, cargarRuta, guardarProgreso, guardarPerfil, medio, mediosRuta, todosSellos, etapa, buscarSello,
  sellado, progEtapa, cuenta, siguienteSello, etapaTerminada, rutaCompleta, comprobarFinal, diasHasta, fechaCarta, base,
} from './core.js';
import { comprimirFoto, elegirFotos, grabadora, distancia, formatoDist, vigilarPosicion, pararPosicion, entregarArchivo } from './media.js';
import { dibujarSello, dibujarInsignia, lienzo, fechaCorta, fuentesListas } from './graficos.js';

const app = document.getElementById('app');
const MAX_FOTOS = 3;
const MARCA = 'Walk2life';

// ---------------- enrutado ----------------
const rutas = {
  '': inicio,
  etapa: pantallaEtapa,
  sello: pantallaSello,
  final: pantallaFinal,
  ajustes: pantallaAjustes,
  autor: async (...a) => (await import('./autor.js')).pantallaAutor(app, ...a),
};

export async function pintar() {
  pararPosicion();
  // al cambiar de pantalla no puede quedar ninguna hoja abierta ni el scroll bloqueado
  document.querySelectorAll('.hoja').forEach((x) => x.remove());
  document.body.classList.remove('bloq');
  const [nombre, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = rutas[nombre] || inicio;
  app.innerHTML = '';
  app.className = 'p-' + (nombre || 'inicio');
  await fn(...args.map(decodeURIComponent));
  window.scrollTo(0, 0);
}

const ir = (hash) => { location.hash = hash; };
window.addEventListener('hashchange', pintar);

function cabecera(volver) {
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
function canvasInsignia(tam, ganada) {
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

function canvasSello(s, tam) {
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

function barra(frac) {
  return h('div.progreso', {}, h('i', { style: { width: Math.round(frac * 100) + '%' } }));
}

async function bloqueMedios(b) {
  if (!b) return null;
  const el = h('div.medios');
  for (const f of [b.foto, ...(b.fotos || [])].filter(Boolean)) {
    el.append(h('img', { src: await medio(f), loading: 'lazy', alt: '' }));
  }
  if (b.audio) el.append(h('audio', { controls: true, preload: 'none', src: await medio(b.audio) }));
  if (b.video) el.append(h('a.btn.sec', { href: b.video, target: '_blank', rel: 'noopener' }, `▶ ${t('verVideo')} · ${t('necesitaConexion')}`));
  return el;
}

async function bloqueSorpresa(s, abierta) {
  if (!s) return null;
  if (!abierta) return h('div.sorpresa.cerrada', {}, h('span.mono', {}, '✦ ' + t('sorpresa')), h('p.mut', {}, t('sorpresaBloqueada')));
  return h('div.sorpresa', {},
    h('span.mono', {}, '✦ ' + t('sorpresa')),
    s.titulo ? h('h3', {}, tx(s.titulo)) : null,
    textoAutor(tx(s.texto)),
    await bloqueMedios(s));
}

// Preguntas una a una, sin obligar. Devuelve las respuestas o null si se cancela.
function preguntas(titulo, lista, previas = []) {
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

// ---------------- INICIO ----------------
async function inicio() {
  const R = estado.ruta;
  const P = estado.prog;
  const c = cuenta();
  app.append(cabecera());

  const empezada = P.salida || Object.keys(P.sellos).length || Object.keys(P.etapas).length;
  const portada = h('section.portada', {},
    h('p.mono', {}, tx(R.recorrido)),
    h('h1.titulo', {}, tx(R.titulo)),
    h('p.subtitulo', {}, tx(R.subtitulo)),
    canvasInsignia(200, !!P.completada),
    h('p.cuenta', {},
      P.completada ? t('rutaCompletada')
        : c.faltan === 1 ? t('faltaSello') : t('faltanSellos', { n: c.faltan })),
    barra(c.hechos / c.total));
  app.append(portada);

  // cuenta atrás hasta la salida
  if (P.salida && !Object.keys(P.sellos).length) {
    const d = diasHasta(P.salida);
    if (d >= 0) app.append(h('section.cuentaatras', {},
      h('span.num', {}, d > 1 ? d : ''),
      h('span.mono', {}, d > 1 ? t('faltanDias', { n: d }) : d === 1 ? t('faltaDia') : t('hoySales'))));
  }

  // carta al futuro
  const fc = fechaCarta();
  if (fc) {
    const d = diasHasta(fc);
    app.append(h('section.carta-aviso', { onclick: () => ir('#/final') },
      h('span.mono', {}, '✉ ' + t('cartaFutura')),
      h('p', {}, d > 0 ? t('cartaSeAbre', { n: d }) : t('cartaAbierta'))));
  }

  if (!empezada) {
    const nombre = h('input', { type: 'text', value: estado.perfil.nombre || '', placeholder: t('tuNombre'), autocomplete: 'name' });
    const fecha = h('input', { type: 'date' });
    app.append(h('section.bienvenida', {},
      h('span.mono', {}, t('prologo')),
      textoAutor(tx(R.prologo)),
      h('label', {}, h('span.mono', {}, t('tuNombre')), nombre),
      h('label', {}, h('span.mono', {}, t('fechaSalida')), fecha),
      h('button.btn', {
        onclick: async () => {
          estado.perfil.nombre = nombre.value.trim();
          P.salida = fecha.value || new Date().toISOString().slice(0, 10);
          await guardarPerfil();
          await guardarProgreso();
          pedirPersistencia();
          pintar();
        },
      }, t('comenzarRuta'))));
  }

  // etapas
  const lista = h('section.etapas', {}, h('h2.seccion', {}, t('etapas')));
  for (const e of R.etapas) {
    const ce = cuenta(e.n);
    const hecha = etapaTerminada(e.n);
    lista.append(h('a.etapa-card' + (hecha ? '.hecha' : ''), { href: `#/etapa/${e.n}` },
      h('span.n', {}, String(e.n).padStart(2, '0')),
      h('div', {},
        h('strong', {}, tx(e.titulo)),
        h('span.mut', {}, `${tx(e.origen)} → ${tx(e.destino)}${e.km ? ` · ${e.km} ${t('km')}` : ''}`),
        barra(ce.hechos / ce.total),
        h('span.mono', {}, hecha ? '✓ ' + t('etapaCompletada') : t('sellosEtapa', { a: ce.hechos, b: ce.total })))));
  }
  app.append(lista);

  if (P.completada || rutaCompleta()) {
    app.append(h('section.centro', {}, h('a.btn', { href: '#/final' }, t('entregables'))));
  }

  app.append(await bloqueDescarga());
  app.append(h('p.privacidad', {}, t('privacidad')));
}

// ---------------- descarga sin conexión ----------------
async function tamano(urls) {
  let total = 0;
  await Promise.all(urls.map(async (u) => {
    try {
      const r = await fetch(u, { method: 'HEAD' });
      total += +(r.headers.get('content-length') || 0);
    } catch {}
  }));
  return total;
}

async function descargar(urls, alProgreso) {
  const cache = await caches.open('ruta-' + estado.rutaId);
  let i = 0;
  for (const u of urls) {
    if (!(await cache.match(u))) {
      for (let intento = 0; intento < 3; intento++) {
        try { await cache.add(u); break; } catch { await new Promise((r) => setTimeout(r, 1500 * (intento + 1))); }
      }
    }
    alProgreso(++i / urls.length);
  }
}

async function faltanPorBajar(urls) {
  if (!('caches' in window)) return urls;
  const cache = await caches.open('ruta-' + estado.rutaId);
  const res = [];
  for (const u of urls) if (!(await cache.match(u))) res.push(u);
  return res;
}

async function bloqueDescarga(n = null) {
  const urls = mediosRuta(estado.publicada, n);
  const el = h('section.descarga');
  if (!('caches' in window)) return el;
  const pendientes = await faltanPorBajar(urls);
  if (!pendientes.length) {
    el.append(h('p.mono', {}, '✓ ' + t('descargada')));
    return el;
  }
  const bytes = await tamano(pendientes);
  const mb = Math.max(0.1, bytes / 1048576).toFixed(1).replace('.', ',');
  const b = barra(0);
  const btn = h('button.btn.sec', {
    onclick: async () => {
      btn.disabled = true;
      el.append(b);
      await descargar(pendientes, (f) => (b.firstChild.style.width = f * 100 + '%'));
      el.innerHTML = '';
      el.append(h('p.mono', {}, '✓ ' + t('descargada')));
    },
  }, `${n == null ? t('descargarRuta') : t('descargarEtapa')} · ${mb} MB`);
  el.append(btn, h('p.mut.peq', {}, t('recomendadoWifi')));
  return el;
}

// ---------------- ETAPA ----------------
async function pantallaEtapa(nStr) {
  const n = +nStr;
  const e = etapa(n);
  if (!e) return ir('#/');
  const pe = progEtapa(n);
  const ce = cuenta(n);
  app.append(cabecera('#/'));

  app.append(h('section.cab-etapa', {},
    h('span.mono', {}, `${t('etapa')} ${n} / ${estado.ruta.etapas.length}`),
    h('h1', {}, tx(e.titulo)),
    h('p.mut', {}, `${tx(e.origen)} → ${tx(e.destino)}${e.km ? ` · ${e.km} ${t('km')}` : ''}`),
    barra(ce.hechos / ce.total),
    h('p.cuenta', {}, etapaTerminada(n) ? '✓ ' + t('etapaCompletada') : t('sellosEtapa', { a: ce.hechos, b: ce.total }))));

  app.append(h('section.narrativa', {}, textoAutor(tx(e.narrativa?.intro))));

  if (!pe.inicio) {
    app.append(h('section.centro', {}, h('button.btn', {
      onclick: async () => {
        const r = await preguntas(t('preguntasInicio'), e.preguntasInicio || []);
        if (!r) return;
        pe.inicio = Date.now();
        pe.respInicio = r;
        await guardarProgreso();
        pintar();
      },
    }, t('empezarEtapa'))));
  }

  // siguiente sello + GPS (solo con la app abierta)
  const sig = siguienteSello(n);
  const aviso = h('div.aviso-gps');
  if (sig && pe.inicio) {
    const dist = h('span.mono');
    app.append(h('section.siguiente', { onclick: () => ir('#/sello/' + sig.id) },
      h('span.mono', {}, t('siguienteSello')),
      h('strong', {}, sig.oculto ? t('selloOculto') : tx(sig.nombre)),
      h('p.mut', {}, tx(sig.pista)),
      dist, aviso));
    const conCoords = e.sellos.filter((s) => s.lat != null && !sellado(s.id));
    if (sig.lat == null) dist.textContent = t('sinCoordenadas');
    if (conCoords.length) {
      vigilarPosicion((pos) => {
        if (!pos) { dist.textContent = t('sinGPS'); return; }
        if (sig.lat != null) dist.textContent = t('aDistancia', { d: formatoDist(distancia(pos, sig)) });
        const cerca = conCoords.find((s) => distancia(pos, s) <= (s.radio || 60) + Math.min(pos.precision || 0, 60));
        aviso.innerHTML = '';
        if (cerca) aviso.append(h('button.btn', { onclick: (ev) => { ev.stopPropagation(); ir('#/sello/' + cerca.id); } },
          `${t('pareceQueLlegas')} ${cerca.oculto ? t('selloOculto') : tx(cerca.nombre)}`));
      });
    }
  }

  // mapa esquemático (solo si hay coordenadas)
  const mapa = mapaEtapa(e);
  if (mapa) app.append(mapa);

  // lista de sellos
  const lista = h('section.sellos', {}, h('h2.seccion', {}, t('sellos')));
  for (const s0 of e.sellos) {
    const s = { ...s0, etapa: n };
    const hecho = sellado(s.id);
    lista.append(h('a.sello-fila' + (hecho ? '.hecho' : ''), { href: '#/sello/' + s.id },
      hecho ? canvasSello(s, 64) : h('span.hueco-sello', {}, s.oculto ? '?' : ''),
      h('div', {},
        h('strong', {}, s.oculto && !hecho ? t('selloOculto') : tx(s.nombre)),
        h('span.mut', {}, hecho ? fechaCorta(estado.prog.sellos[s.id].ts) : tx(s.pista)))));
  }
  app.append(lista);

  if (pe.inicio && !pe.fin) {
    app.append(h('section.centro', {}, h('button.btn' + (ce.faltan ? '.sec' : ''), {
      onclick: async () => {
        const r = await preguntas(t('preguntasFin'), e.preguntasFin || []);
        if (!r) return;
        pe.fin = Date.now();
        pe.respFin = r;
        const fin = comprobarFinal();
        await guardarProgreso();
        await celebrarEtapa(e, fin);
      },
    }, t('terminarEtapa'))));
  }

  if (pe.fin) {
    app.append(h('section.narrativa', {}, textoAutor(tx(e.narrativa?.cierre))));
    app.append(await bloqueSorpresa(e.sorpresa, true));
  }

  app.append(await bloqueDescarga(n));
}

function mapaEtapa(e) {
  const pts = e.sellos.filter((s) => s.lat != null && s.lon != null && (!s.oculto || sellado(s.id)));
  if (pts.length < 2) return null;
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const kx = Math.cos(((a + b) / 2) * Math.PI / 180);
  const W = 320, H = 200, m = 24;
  const esc = Math.min((W - 2 * m) / (((d - c) * kx) || 1e-6), (H - 2 * m) / ((b - a) || 1e-6));
  const x = (p) => m + (p.lon - c) * kx * esc, y = (p) => H - m - (p.lat - a) * esc;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'mapa');
  const linea = document.createElementNS(ns, 'polyline');
  linea.setAttribute('points', pts.map((p) => `${x(p)},${y(p)}`).join(' '));
  svg.append(linea);
  pts.forEach((p) => {
    const cir = document.createElementNS(ns, 'circle');
    cir.setAttribute('cx', x(p)); cir.setAttribute('cy', y(p)); cir.setAttribute('r', 5);
    cir.setAttribute('class', sellado(p.id) ? 'hecho' : '');
    svg.append(cir);
  });
  return h('section.mapa-wrap', {}, svg);
}

async function celebrarEtapa(e, rutaTerminada) {
  const cont = h('div.celebra', {},
    h('span.mono', {}, `${t('etapa')} ${e.n}`),
    h('h2', {}, t('etapaCompletada')),
    textoAutor(tx(e.narrativa?.cierre)),
    await bloqueSorpresa(e.sorpresa, true));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {}, h('button.btn', {
    onclick: () => { cerrar(); rutaTerminada ? ir('#/final') : pintar(); },
  }, t('continuar'))));
}

// ---------------- SELLO ----------------
async function pantallaSello(id) {
  const s = buscarSello(id);
  if (!s) return ir('#/');
  const e = etapa(s.etapa);
  app.append(cabecera('#/etapa/' + s.etapa));
  const hecho = sellado(id);

  if (!hecho) {
    app.append(h('section.llegada', {},
      h('span.mono', {}, `${t('etapa')} ${s.etapa} · ${t('sello')}`),
      s.oculto
        ? [h('h1', {}, t('selloOculto')), textoAutor(tx(s.pista), 'enigma')]
        : [h('h2.pregunta', {}, `${t('hasLlegado')} ${tx(s.nombre)}?`), h('p.mut', {}, tx(s.pista))],
      h('div.botones', {},
        h('button.btn', { onclick: () => sellar(s) }, s.oculto ? t('loHeEncontrado') : t('si')),
        h('button.btn.sec', { onclick: () => history.back() }, t('aunNo'))),
      await bloqueSorpresa(s.sorpresa, false)));
    return;
  }

  const p = estado.prog.sellos[id];
  app.append(h('section.sello-cab', {},
    canvasSello(s, 180),
    h('h1', {}, tx(s.nombre)),
    h('p.mono', {}, `${t('etapa')} ${s.etapa} · ${fechaCorta(p.ts)}`)));

  // recuerdo del caminante
  const rec = h('section.recuerdo', {}, h('h2.seccion', {}, t('tuRecuerdo')));
  if (p.fotos?.length) {
    const g = h('div.medios');
    for (const f of p.fotos) g.append(h('img', { src: await urlBlob(f), alt: '' }));
    rec.append(g);
  }
  if (p.frase) rec.append(h('p.frase', {}, `“${p.frase}”`));
  if (p.audio) rec.append(h('audio', { controls: true, src: await urlBlob(p.audio) }));
  rec.append(h('button.enlace', { onclick: () => formularioRecuerdo(s) }, t('editarRecuerdo')));
  app.append(rec);

  // lo que Andy cuenta de este lugar: se desbloquea al sellar
  app.append(h('section.andy', {},
    h('h2.seccion', {}, t('sobreEsteLugar')),
    textoAutor(tx(s.texto)),
    await bloqueMedios(s)));
  app.append(await bloqueSorpresa(s.sorpresa, true));
}

async function sellar(s) {
  estado.prog.sellos[s.id] = { ts: Date.now(), frase: '', fotos: [], audio: null };
  const pe = progEtapa(s.etapa);
  if (!pe.inicio) pe.inicio = Date.now();
  await guardarProgreso();
  pedirPersistencia();
  if (navigator.vibrate) navigator.vibrate([30, 60, 90]);

  // momento del sello
  const cv = canvasSello(s, 240);
  const quedan = cuenta().faltan;
  const cont = h('div.momento', {},
    h('div.golpe', {}, cv),
    h('h2', {}, t('teHasGanado')),
    h('p.mono', {}, quedan === 0 ? t('rutaCompletada') : quedan === 1 ? t('faltaSello') : t('faltanSellos', { n: quedan })),
    h('p.lead', {}, t('dejaRecuerdo')));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {},
    h('button.btn', { onclick: () => { cerrar(); formularioRecuerdo(s); } }, t('continuar')),
    h('button.btn.sec', { onclick: () => { cerrar(); pintar(); } }, t('omitir'))));
}

function formularioRecuerdo(s) {
  const p = estado.prog.sellos[s.id];
  const fotos = [...(p.fotos || [])];
  let audio = p.audio;
  const galeria = h('div.miniaturas');
  const pintarFotos = async () => {
    galeria.innerHTML = '';
    for (const f of fotos) {
      galeria.append(h('div.mini', {},
        h('img', { src: await urlBlob(f), alt: '' }),
        h('button', { onclick: () => { fotos.splice(fotos.indexOf(f), 1); pintarFotos(); } }, '×')));
    }
    btnFoto.disabled = fotos.length >= MAX_FOTOS;
  };
  const btnFoto = h('button.btn.sec', {
    onclick: async () => {
      const files = await elegirFotos(true);
      for (const f of files.slice(0, MAX_FOTOS - fotos.length)) {
        fotos.push(await blobs.guardar(await comprimirFoto(f), 'foto'));
      }
      pintarFotos();
    },
  }, '＋ ' + t('unaFoto'));
  const frase = h('textarea', { rows: 3, placeholder: t('fraseMarcador'), value: p.frase || '' });

  const zonaAudio = h('div.audio');
  let grab = null;
  const pintarAudio = async () => {
    zonaAudio.innerHTML = '';
    if (audio) zonaAudio.append(h('audio', { controls: true, src: await urlBlob(audio) }), h('button.enlace', { onclick: () => { audio = null; pintarAudio(); } }, '×'));
    const b = h('button.btn.sec', {
      onclick: async () => {
        if (!grab) {
          try { grab = await grabadora(); } catch { toast('🎙 ✕'); return; }
          b.textContent = '■ ' + t('parar');
          b.classList.add('grabando');
        } else {
          const blob = await grab.parar();
          grab = null;
          audio = await blobs.guardar(blob, 'voz');
          pintarAudio();
        }
      },
    }, '● ' + t('grabar'));
    zonaAudio.append(b);
  };

  const cont = h('div.form-recuerdo', {},
    h('span.mono', {}, tx(s.nombre)),
    h('h2', {}, t('tuRecuerdo')),
    h('h3.mono', {}, `${t('unaFoto')} · ${t('fotosMax', { n: MAX_FOTOS })}`), galeria, btnFoto,
    h('h3.mono', {}, t('unaFrase')), frase,
    h('h3.mono', {}, t('unaNotaVoz')), zonaAudio);
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        // borrar blobs que se han quitado
        for (const f of p.fotos || []) if (!fotos.includes(f)) await blobs.del(f);
        if (p.audio && p.audio !== audio) await blobs.del(p.audio);
        Object.assign(p, { fotos, frase: frase.value.trim(), audio });
        await guardarProgreso();
        cerrar();
        if (location.hash !== '#/sello/' + s.id) ir('#/sello/' + s.id); else pintar();
      },
    }, t('guardar')),
    h('button.btn.sec', { onclick: () => { cerrar(); pintar(); } }, t('cancelar'))));
  pintarFotos();
  pintarAudio();
}

// ---------------- FINAL ----------------
async function pantallaFinal() {
  const R = estado.ruta;
  const P = estado.prog;
  comprobarFinal() && (await guardarProgreso());
  app.append(cabecera('#/'));
  const completa = !!P.completada;

  app.append(h('section.final-cab', {},
    canvasInsignia(260, completa),
    h('span.mono', {}, t('insignia')),
    h('h1', {}, tx(R.insignia?.nombre)),
    h('p.mut', {}, completa ? tx(R.insignia?.lema) : t('insigniaBloqueada'))));

  if (completa) {
    app.append(h('section.narrativa', {}, textoAutor(tx(R.insignia?.texto))));
    app.append(h('section.narrativa', {}, h('span.mono', {}, t('epilogo')), textoAutor(tx(R.epilogo))));
    app.append(await bloqueSorpresa(R.sorpresaFinal, true));
  }

  // entregables
  const ent = h('section.entregables', {}, h('h2.seccion', {}, t('entregables')));
  const nombreRuta = `${R.id}-${(estado.perfil.nombre || 'credencial').toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, '-')}`;
  const fila = (titulo, desc, fn, archivo, activo = true) => {
    const b = barra(0);
    b.hidden = true;
    const btn = h('button.btn' + (activo ? '' : '.sec'), {
      disabled: !activo,
      onclick: async () => {
        btn.disabled = true;
        const txt = btn.textContent;
        btn.textContent = t('generando');
        b.hidden = false;
        try {
          const blob = await fn((f) => (b.firstChild.style.width = f * 100 + '%'));
          await entregarArchivo(blob, archivo);
        } catch (err) {
          console.error(err);
          toast(titulo === t('video') ? t('errorVideo') : String(err.message || err), 5000);
        }
        btn.textContent = txt;
        btn.disabled = false;
        b.hidden = true;
      },
    }, t('generar'));
    return h('div.entregable', {}, h('div', {}, h('strong', {}, titulo), h('span.mut', {}, desc)), btn, b);
  };
  const { certificado, fotobook, videoresumen } = await import('./entregables.js');
  ent.append(
    fila(t('certificado'), 'PDF', () => certificado(), `certificado-${nombreRuta}.pdf`, completa),
    fila(t('fotobook'), 'PDF', (p) => fotobook(p), `fotobook-${nombreRuta}.pdf`, Object.keys(P.sellos).length > 0),
    fila(t('video'), 'MP4 · ' + t('videoTiempo'), (p) => videoresumen(p), `video-${nombreRuta}.mp4`, Object.keys(P.sellos).length > 0));
  app.append(ent);

  // carta al futuro
  if (completa && R.cartaFutura) app.append(await bloqueCarta());
}

async function bloqueCarta() {
  const R = estado.ruta, P = estado.prog;
  const dias = R.cartaFutura.dias || 365;
  const el = h('section.carta', {}, h('span.mono', {}, '✉ ' + t('cartaFutura')));
  if (!P.carta) {
    const area = h('textarea', { rows: 8, placeholder: t('escribeCarta') });
    el.append(h('p.mut', {}, t('cartaFuturaTexto', { n: dias })), area, h('button.btn', {
      onclick: async () => {
        if (!area.value.trim()) return;
        P.carta = { texto: area.value.trim(), cerrada: Date.now() };
        await guardarProgreso();
        pintar();
      },
    }, t('cerrarCarta')));
  } else {
    const d = diasHasta(fechaCarta());
    if (d > 0) el.append(h('div.sobre', {}, h('span.num', {}, d), h('p', {}, t('cartaSeAbre', { n: d }))));
    else el.append(h('h3', {}, t('cartaAbierta')), h('p.frase', {}, P.carta.texto), h('p.mono', {}, fechaCorta(P.carta.cerrada)));
  }
  return el;
}

// ---------------- AJUSTES ----------------
async function pantallaAjustes() {
  app.append(cabecera('#/'));
  const P = estado.prog;
  const nombre = h('input', { type: 'text', value: estado.perfil.nombre || '' });
  const fecha = h('input', { type: 'date', value: P.salida || '' });
  const idioma = h('select', {}, Object.entries(IDIOMAS).map(([k, v]) => h('option', { value: k, selected: k === getIdioma() }, v)));

  app.append(h('section.ajustes', {},
    h('h1', {}, t('ajustes')),
    h('label', {}, h('span.mono', {}, t('tuNombre')), nombre),
    h('label', {}, h('span.mono', {}, t('fechaSalida')), fecha),
    h('label', {}, h('span.mono', {}, t('idioma')), idioma),
    h('button.btn', {
      onclick: async () => {
        estado.perfil.nombre = nombre.value.trim();
        P.salida = fecha.value || P.salida;
        setIdioma(idioma.value);
        await guardarPerfil();
        await guardarProgreso();
        toast('✓');
        ir('#/');
      },
    }, t('guardar'))));

  const est = await espacio();
  app.append(h('section.ajustes', {},
    h('h2.seccion', {}, t('copia')),
    h('div.botones', {},
      h('button.btn.sec', { onclick: exportarCopia }, t('exportarCopia')),
      h('button.btn.sec', { onclick: importarCopia }, t('importarCopia'))),
    h('h2.seccion', {}, t('liberar')),
    h('p.mut', {}, t('liberarTexto')),
    h('button.btn.sec', {
      onclick: async () => { await caches.delete('ruta-' + estado.rutaId); toast('✓'); },
    }, t('liberar')),
    est ? h('p.mono', {}, `${(est.usage / 1048576).toFixed(1)} MB`) : null,
    h('h2.seccion', {}, t('instalar')),
    h('p.mut', {}, t('instalarIOS')),
    h('p.mut', {}, t('instalarAndroid')),
    h('p.privacidad', {}, t('privacidad')),
    h('button.enlace.peligro', {
      onclick: async () => {
        if (!(await confirmar(t('confirmarBorrar'), t('borrarTodo'), t('cancelar')))) return;
        for (const k of await blobs.keys()) await blobs.del(k);
        await kv.del('progreso:' + estado.rutaId);
        await cargarRuta(estado.rutaId);
        ir('#/');
      },
    }, t('borrarTodo'))));
}

// Copia de seguridad: un .zip con el progreso y los blobs del caminante.
async function exportarCopia() {
  const { zipSync, strToU8 } = await import('../vendor/fflate.mjs');
  const P = estado.prog;
  const ids = new Set();
  Object.values(P.sellos).forEach((s) => { (s.fotos || []).forEach((f) => ids.add(f)); if (s.audio) ids.add(s.audio); });
  const files = { 'progreso.json': strToU8(JSON.stringify({ ruta: estado.rutaId, perfil: estado.perfil, prog: P })) };
  for (const id of ids) {
    const b = await blobs.get(id);
    if (b) files['blobs/' + id] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
    if (b) files['tipos/' + id] = strToU8(b.type || '');
  }
  const zip = zipSync(files);
  await entregarArchivo(new Blob([zip], { type: 'application/zip' }), `credencial-${estado.rutaId}-copia.zip`);
}

async function importarCopia() {
  const { elegirArchivo } = await import('./media.js');
  const f = await elegirArchivo('.zip,application/zip');
  if (!f) return;
  const { unzipSync, strFromU8 } = await import('../vendor/fflate.mjs');
  const files = unzipSync(new Uint8Array(await f.arrayBuffer()));
  const datos = JSON.parse(strFromU8(files['progreso.json']));
  for (const [k, v] of Object.entries(files)) {
    if (!k.startsWith('blobs/')) continue;
    const id = k.slice(6);
    const tipo = files['tipos/' + id] ? strFromU8(files['tipos/' + id]) : '';
    await blobs.set(id, new Blob([v], { type: tipo }));
  }
  await kv.set('progreso:' + datos.ruta, datos.prog);
  await kv.set('perfil', datos.perfil);
  await cargarRuta(datos.ruta);
  toast('✓');
  ir('#/');
}

// ---------------- instalación ----------------
async function avisoInstalar() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  let visto = false;
  try { visto = localStorage.getItem('avisoInstalar') === '1'; } catch {}
  if (visto) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const { cerrar } = hoja([
    h('span.mono', {}, MARCA),
    h('h2', {}, t('instalar')),
    h('p.lead', {}, ios ? t('instalarIOS') : t('instalarAndroid')),
    h('div.botones', {}, h('button.btn', {
      onclick: () => { try { localStorage.setItem('avisoInstalar', '1'); } catch {} cerrar(); },
    }, t('entendido'))),
  ], { clase: 'centrada' });
}

// ---------------- arranque ----------------
async function arrancar() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const indice = await (await fetch('rutas/index.json')).json();
  await cargarRuta(new URLSearchParams(location.search).get('ruta') || indice.predeterminada);
  document.documentElement.lang = getIdioma();
  document.title = `${MARCA} · ${tx(estado.ruta.titulo)}`;
  if (new URLSearchParams(location.search).has('autor')) location.hash = '#/autor';
  await pintar();
  setTimeout(avisoInstalar, 1200);
}

arrancar();
