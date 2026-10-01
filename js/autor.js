// Modo autor: Andy mete su contenido desde el móvil, sobre el terreno.
// Todo se guarda como borrador en este móvil y se exporta en un .zip para publicarlo.
import { h, toast, confirmar } from './ui.js';
import { kv, blobs, urlBlob } from './db.js';
import { estado, medio, cargarRuta } from './core.js';
import { comprimirFoto, elegirFotos, elegirArchivo, grabadora, posicionActual, entregarArchivo } from './media.js';

let R; // borrador en edición
let guardarT;
const guardar = () => {
  clearTimeout(guardarT);
  guardarT = setTimeout(async () => {
    await kv.set('borrador:' + R.id, R);
    estado.ruta = R;
  }, 400);
};

// Los textos pueden ser cadena o { es, en, fr, it }: aquí se edita el idioma elegido.
let lengua = 'es';
const leer = (v) => (v == null ? '' : typeof v === 'string' ? (lengua === 'es' ? v : '') : v[lengua] || '');
function escribir(obj, k, valor) {
  const v = obj[k];
  if (lengua === 'es' && (v == null || typeof v === 'string')) obj[k] = valor;
  else obj[k] = { ...(typeof v === 'string' ? { es: v } : v || {}), [lengua]: valor };
}

function campo(obj, k, etiqueta, { largo = false, tipo = 'text', traducible = true } = {}) {
  const valor = traducible ? leer(obj[k]) : obj[k] ?? '';
  const input = largo
    ? h('textarea', { rows: 4, value: valor })
    : h('input', { type: tipo, value: valor, step: tipo === 'number' ? 'any' : null });
  input.addEventListener('input', () => {
    if (tipo === 'number') obj[k] = input.value === '' ? null : +input.value;
    else if (traducible) escribir(obj, k, input.value);
    else obj[k] = input.value || null;
    guardar();
  });
  return h('label', {}, h('span.mono', {}, etiqueta + (traducible && lengua !== 'es' ? ` (${lengua})` : '')), input);
}

function campoLista(obj, k, etiqueta) {
  const area = h('textarea', { rows: 5, value: (obj[k] || []).map(leer).join('\n') });
  area.addEventListener('input', () => {
    const lineas = area.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (lengua === 'es') {
      obj[k] = lineas.map((l, i) => (obj[k] && typeof obj[k][i] === 'object' ? { ...obj[k][i], es: l } : l));
    } else {
      obj[k] = lineas.map((l, i) => {
        const prev = (obj[k] || [])[i];
        return { ...(typeof prev === 'string' ? { es: prev } : prev || {}), [lengua]: l };
      });
    }
    guardar();
  });
  return h('label', {}, h('span.mono', {}, etiqueta + ' · una por línea'), area);
}

// Foto(s), audio y vídeo de un bloque de contenido.
function campoMedios(obj, { fotos = true, fotoUnica = false } = {}) {
  const el = h('div.medios-autor');
  const pintarM = async () => {
    el.innerHTML = '';
    const lista = fotoUnica ? [obj.foto].filter(Boolean) : obj.fotos || [];
    const g = h('div.miniaturas');
    for (const f of lista) {
      g.append(h('div.mini', {}, h('img', { src: await medio(f), alt: '' }), h('button', {
        onclick: () => {
          if (fotoUnica) obj.foto = null; else obj.fotos = obj.fotos.filter((x) => x !== f);
          guardar(); pintarM();
        },
      }, '×')));
    }
    if (fotos) el.append(g, h('button.btn.sec', {
      onclick: async () => {
        const files = await elegirFotos(!fotoUnica);
        for (const f of files) {
          const id = 'idb:' + (await blobs.guardar(await comprimirFoto(f, 1600, 0.8), 'autor'));
          if (fotoUnica) obj.foto = id; else (obj.fotos ||= []).push(id);
        }
        guardar(); pintarM();
      },
    }, fotoUnica ? '＋ Foto' : '＋ Fotos'));
    // audio: grabar aquí o subir un archivo (entrevista, canción)
    if (obj.audio) el.append(h('div.audio', {}, h('audio', { controls: true, src: await medio(obj.audio) }),
      h('button.enlace', { onclick: () => { obj.audio = null; guardar(); pintarM(); } }, 'Quitar audio')));
    let grab = null;
    const bGrabar = h('button.btn.sec', {
      onclick: async () => {
        if (!grab) {
          try { grab = await grabadora(); } catch { toast('No hay acceso al micrófono'); return; }
          bGrabar.textContent = '■ Parar'; bGrabar.classList.add('grabando');
        } else {
          const b = await grab.parar(); grab = null;
          obj.audio = 'idb:' + (await blobs.guardar(b, 'autor'));
          guardar(); pintarM();
        }
      },
    }, '● Grabar audio');
    const bSubir = h('button.btn.sec', {
      onclick: async () => {
        const f = await elegirArchivo('audio/*');
        if (!f) return;
        obj.audio = 'idb:' + (await blobs.guardar(f, 'autor'));
        guardar(); pintarM();
      },
    }, '↑ Subir audio');
    el.append(h('div.botones', {}, bGrabar, bSubir));
    el.append(campo(obj, 'video', 'Enlace de vídeo (YouTube/Vimeo)', { traducible: true }));
  };
  pintarM();
  return el;
}

function plegable(titulo, contenido, abierto = false) {
  const d = h('details.plegable', { open: abierto }, h('summary', {}, titulo));
  d.append(...[].concat(contenido));
  return d;
}

function formSello(e, s, i) {
  s.sorpresa ||= {};
  const coords = h('p.mono', {}, s.lat != null ? `${s.lat}, ${s.lon}` : 'Sin coordenadas');
  return plegable(`${i + 1}. ${leer(s.nombre) || s.nombre || 'Lugar'}${s.oculto ? ' · oculto' : ''}`, [
    campo(s, 'nombre', 'Nombre del lugar'),
    campo(s, 'pista', s.oculto ? 'Enigma' : 'Pista para reconocerlo', { largo: true }),
    h('label.check', {}, h('input', { type: 'checkbox', checked: !!s.oculto, onchange: (ev) => { s.oculto = ev.target.checked; guardar(); } }), ' Sello oculto'),
    h('div.fila', {}, coords, h('button.btn.sec', {
      onclick: async () => {
        coords.textContent = 'Buscando posición…';
        try {
          const p = await posicionActual();
          s.lat = p.lat; s.lon = p.lon; guardar();
          coords.textContent = `${p.lat}, ${p.lon} · ±${Math.round(p.precision)} m`;
        } catch { coords.textContent = 'No se pudo obtener la posición'; }
      },
    }, '⌖ Usar mi posición')),
    campo(s, 'radio', 'Radio de llegada (metros)', { tipo: 'number', traducible: false }),
    campo(s, 'texto', 'Tu texto en este lugar', { largo: true }),
    campoMedios(s),
    h('h4.mono', {}, '✦ Sorpresa (se abre al sellar)'),
    campo(s.sorpresa, 'titulo', 'Título'),
    campo(s.sorpresa, 'texto', 'Texto', { largo: true }),
    campoMedios(s.sorpresa, { fotoUnica: true }),
    h('div.botones', {},
      h('button.enlace', { onclick: () => mover(e, i, -1) }, '↑ Subir'),
      h('button.enlace', { onclick: () => mover(e, i, 1) }, '↓ Bajar'),
      h('button.enlace.peligro', {
        onclick: async () => {
          if (!(await confirmar('¿Borrar este lugar?', 'Borrar', 'Cancelar'))) return;
          e.sellos.splice(i, 1); guardar(); repintar();
        },
      }, 'Borrar lugar')),
  ]);
}

function mover(e, i, d) {
  const j = i + d;
  if (j < 0 || j >= e.sellos.length) return;
  [e.sellos[i], e.sellos[j]] = [e.sellos[j], e.sellos[i]];
  guardar(); repintar();
}

function formEtapa(e) {
  e.narrativa ||= {};
  e.sorpresa ||= {};
  const lista = h('div');
  e.sellos.forEach((s, i) => lista.append(formSello(e, s, i)));
  return plegable(`Etapa ${e.n} · ${leer(e.titulo) || ''}`, [
    campo(e, 'titulo', 'Título'),
    h('div.fila', {}, campo(e, 'origen', 'Origen'), campo(e, 'destino', 'Destino')),
    campo(e, 'km', 'Kilómetros', { tipo: 'number', traducible: false }),
    campo(e.narrativa, 'intro', 'Narrativa de apertura', { largo: true }),
    campoLista(e, 'preguntasInicio', 'Preguntas al empezar'),
    h('h3.seccion', {}, 'Lugares con sello'),
    lista,
    h('div.botones', {},
      h('button.btn', {
        onclick: async (ev) => {
          ev.target.disabled = true;
          const nuevo = { id: `e${e.n}s${Date.now().toString(36)}`, nombre: '', pista: '', lat: null, lon: null, radio: 60, oculto: false, texto: '', fotos: [], audio: null, video: null, sorpresa: {} };
          try { const p = await posicionActual(); nuevo.lat = p.lat; nuevo.lon = p.lon; toast(`Posición guardada ±${Math.round(p.precision)} m`); }
          catch { toast('Sin posición: añádela luego'); }
          e.sellos.push(nuevo); guardar(); repintar(e.n);
        },
      }, '⌖ Nuevo lugar aquí')),
    campoLista(e, 'preguntasFin', 'Preguntas al terminar'),
    campo(e.narrativa, 'cierre', 'Narrativa de cierre', { largo: true }),
    h('h4.mono', {}, '✦ Sorpresa de fin de etapa'),
    campo(e.sorpresa, 'titulo', 'Título'),
    campo(e.sorpresa, 'texto', 'Texto', { largo: true }),
    campoMedios(e.sorpresa, { fotoUnica: true }),
  ], abiertaEtapa === e.n);
}

let abiertaEtapa = null;
let raiz;
function repintar(n = abiertaEtapa) { abiertaEtapa = n; pintarAutor(); }

export async function pantallaAutor(app) {
  raiz = app;
  R = structuredClone(estado.ruta);
  pintarAutor();
}

function pintarAutor() {
  const app = raiz;
  app.innerHTML = '';
  R.insignia ||= {}; R.certificado ||= {}; R.sorpresaFinal ||= {}; R.cartaFutura ||= { dias: 365 };
  const selLengua = h('select', { onchange: (ev) => { lengua = ev.target.value; pintarAutor(); } },
    ['es', 'en', 'fr', 'it'].map((l) => h('option', { value: l, selected: l === lengua }, l.toUpperCase())));

  app.append(
    h('header.barra', {}, h('a.enlace', { href: '#/' }, '← Ver la app'), h('span.mono', {}, 'Modo autor')),
    h('section.autor', {},
      h('h1', {}, 'Modo autor'),
      h('p.mut', {}, 'Lo que escribas aquí se guarda en este móvil como borrador y ya se ve en la app. Cuando quieras publicarlo, pulsa «Exportar» y pásale el archivo a Claude.'),
      h('label', {}, h('span.mono', {}, 'Idioma que estás escribiendo'), selLengua),
      plegable('Ruta', [
        campo(R, 'titulo', 'Código (p. ej. GR 55)'),
        campo(R, 'subtitulo', 'Nombre de la ruta'),
        campo(R, 'recorrido', 'Recorrido'),
        campo(R, 'prologo', 'Prólogo', { largo: true }),
        campo(R, 'epilogo', 'Epílogo', { largo: true }),
      ]),
      plegable('Insignia y certificado', [
        campo(R.insignia, 'nombre', 'Nombre de la insignia'),
        campo(R.insignia, 'lema', 'Lema'),
        campo(R.insignia, 'texto', 'Qué significa', { largo: true }),
        campo(R.certificado, 'texto', 'Texto del certificado ({nombre} = nombre del caminante)', { largo: true }),
        campo(R.certificado, 'firma', 'Firma'),
        campo(R.cartaFutura, 'dias', 'Días hasta que se abre la carta al futuro', { tipo: 'number', traducible: false }),
      ]),
      plegable('Música del vídeo final', [
        h('p.mut', {}, 'Canción en formato .m4a (AAC) para que funcione también en iPhone. Claude puede convertirla si le mandas otro formato.'),
        (() => {
          const obj = { audio: R.musica };
          const el = h('div');
          const pintarMus = async () => {
            el.innerHTML = '';
            if (R.musica) el.append(h('audio', { controls: true, src: await medio(R.musica) }));
            el.append(h('button.btn.sec', {
              onclick: async () => {
                const f = await elegirArchivo('audio/*');
                if (!f) return;
                R.musica = 'idb:' + (await blobs.guardar(f, 'autor'));
                guardar(); pintarMus();
              },
            }, '↑ Subir canción'));
          };
          pintarMus();
          return el;
        })(),
      ]),
      plegable('Sorpresa final', [
        campo(R.sorpresaFinal, 'titulo', 'Título'),
        campo(R.sorpresaFinal, 'texto', 'Texto', { largo: true }),
        campoMedios(R.sorpresaFinal, { fotoUnica: true }),
      ]),
      h('h2.seccion', {}, 'Etapas'),
      R.etapas.map(formEtapa),
      h('h2.seccion', {}, 'Publicar'),
      h('div.botones', {},
        h('button.btn', { onclick: exportar }, '↓ Exportar contenido (.zip)'),
        h('button.btn.sec', { onclick: importar }, '↑ Importar .zip')),
      h('h2.seccion', {}, 'Pruebas'),
      h('div.botones', {},
        h('button.btn.sec', { onclick: simular }, 'Simular ruta completa'),
        h('button.enlace.peligro', {
          onclick: async () => {
            if (!(await confirmar('¿Descartar el borrador y volver al contenido publicado?', 'Descartar', 'Cancelar'))) return;
            await kv.del('borrador:' + R.id);
            await cargarRuta(R.id);
            location.hash = '#/';
          },
        }, 'Descartar borrador'))));
}

// Exporta ruta.json + medios en un .zip. Los medios "idb:" pasan a media/<id>.<ext>.
async function exportar() {
  const { zipSync, strToU8 } = await import('../vendor/fflate.mjs');
  const files = {};
  const copia = structuredClone(R);
  const ext = (tipo) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/aac': 'aac', 'audio/wav': 'wav' }[(tipo || '').split(';')[0]] || 'bin');
  const recorrer = async (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && v.startsWith('idb:')) {
        const b = await blobs.get(v.slice(4));
        if (!b) { o[k] = null; continue; }
        const nombre = `media/${v.slice(4)}.${ext(b.type)}`;
        files[nombre] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
        o[k] = nombre;
      } else if (typeof v === 'object') await recorrer(v);
    }
  };
  await recorrer(copia);
  // los medios ya publicados (media/...) se quedan como referencia: ya están en el repositorio
  files['ruta.json'] = strToU8(JSON.stringify(copia, null, 1));
  const zip = zipSync(files);
  const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  await entregarArchivo(new Blob([zip], { type: 'application/zip' }), `autor-${R.id}-${fecha}.zip`);
}

async function importar() {
  const f = await elegirArchivo('.zip,application/zip');
  if (!f) return;
  const { unzipSync, strFromU8 } = await import('../vendor/fflate.mjs');
  const files = unzipSync(new Uint8Array(await f.arrayBuffer()));
  const nueva = JSON.parse(strFromU8(files['ruta.json']));
  const tipos = { jpg: 'image/jpeg', png: 'image/png', m4a: 'audio/mp4', mp3: 'audio/mpeg', webm: 'audio/webm', aac: 'audio/aac', wav: 'audio/wav' };
  const recorrer = async (o) => {
    for (const k of Object.keys(o || {})) {
      const v = o[k];
      if (typeof v === 'string' && files[v] && v.startsWith('media/')) {
        const id = await blobs.guardar(new Blob([files[v]], { type: tipos[v.split('.').pop()] || '' }), 'autor');
        o[k] = 'idb:' + id;
      } else if (v && typeof v === 'object') await recorrer(v);
    }
  };
  await recorrer(nueva);
  R = nueva;
  await kv.set('borrador:' + R.id, R);
  estado.ruta = R;
  toast('Contenido importado');
  pintarAutor();
}

// Rellena un progreso de prueba para ver Hoy, Recuerdos, certificado, fotobook y vídeo sin caminar.
async function simular() {
  const P = estado.prog;
  const { figuraProvisional } = await import('./captura.js');
  const { logros } = await import('./logros.js');
  const colores = ['#3b4a3f', '#5b4a3a', '#2f3d4f', '#6b5a45', '#40443a'];
  const fotoPrueba = async (color, texto, figura = null) => {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1080, 1350);
    g.addColorStop(0, color); g.addColorStop(1, '#111');
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.font = '300 48px Jost'; x.textAlign = 'center';
    x.fillText(texto, 540, 1150);
    if (figura) x.drawImage(figura, 290, 300, 500, 500);
    return blobs.guardar(await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8)), 'prueba');
  };
  const clave = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const hoy = new Date(); hoy.setHours(8, 0, 0, 0);
  const base0 = hoy.getTime() - R.etapas.length * 86400000;
  const nombres = ['Marta', 'Xosé', 'Lucía', 'Pierre', 'Carmen', 'Tom', 'Uxía', 'Giulia', 'Ramón', 'Ana'];
  let ng = 0;
  for (const [i, e] of R.etapas.entries()) {
    let ts = base0 + i * 86400000;
    const color = colores[e.n % 5];
    P.etapas[e.n] = { inicio: ts, respInicio: ['Con ganas'], fin: ts + 9 * 3600000, respFin: (e.preguntasFin || []).map(() => 'Respuesta de prueba') };
    for (const s of e.sellos) {
      ts += 2 * 3600000;
      P.sellos[s.id] = { ts, frase: 'Frase de prueba', fotos: [await fotoPrueba(color, 'foto de prueba')], audio: null };
    }
    const k = clave(base0 + i * 86400000);
    P.dias[k] = {
      inicio: { ts: base0 + i * 86400000, pos: null, km: null, lugar: e.sellos[0].id },
      ultimo: null,
      fin: { ts: ts + 3600000, pos: null, km: null, lugar: e.sellos[e.sellos.length - 1].id },
      objetivo: e.sellos[e.sellos.length - 1].id, diario: 'Diario de prueba: hoy hemos estado en… hemos comido con… he conocido a…',
      kmManual: 15 + (i * 3.7) % 8, cerrado: ts + 4 * 3600000,
    };
    P.entradas.push({ id: 'np' + i, ts: base0 + i * 86400000 + 3 * 3600000, tipo: 'nota', texto: 'Nota de prueba a media mañana.', pos: null, lugar: e.sellos[1].id });
    P.entradas.push({ id: 'fp' + i, ts: base0 + i * 86400000 + 5 * 3600000, tipo: 'foto', fotos: [await fotoPrueba(color, 'foto del diario')], texto: 'Pie de foto de prueba', pos: null, lugar: e.sellos[2].id });
    for (let j = 0; j < 2; j++) {
      const n = nombres[ng++ % nombres.length];
      P.gente.push({ id: 'gp' + ng, ts: base0 + i * 86400000 + (6 + j) * 3600000, nombre: n, texto: 'Ficha de prueba.', fotos: [await fotoPrueba(colores[(e.n + j + 1) % 5], n)], pos: null, lugar: e.sellos[1].id });
    }
    const s0 = e.sellos[0];
    P.capturas[s0.id] = { ts: base0 + i * 86400000 + 4 * 3600000, foto: await fotoPrueba(color, 'figura capturada', figuraProvisional(s0.id, 500)) };
  }
  P.completada = null;
  // logros sin celebraciones (es una simulación)
  if (!estado.perfil.nombre) { estado.perfil.nombre = 'Nombre de prueba'; await kv.set('perfil', estado.perfil); }
  const completa = R.etapas.every((e) => e.sellos.every((s) => P.sellos[s.id]));
  if (completa) P.completada = Date.now();
  for (const l of logros()) { try { if (!P.logros[l.id] && l.ok(P, R)) P.logros[l.id] = Date.now(); } catch {} }
  await kv.set('progreso:' + R.id, P);
  toast('Progreso de prueba creado');
  location.hash = '#/recuerdos';
}
