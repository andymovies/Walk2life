// Mensajes secretos entre caminantes, sin servidor: el mensaje viaja dentro del propio enlace
// (detrás de "#", parte que el navegador nunca envía a ningún servidor).
// El sobre solo se abre al llegar al sitio (GPS). Sin GPS, el caminante confirma que ha llegado.
import { h, hoja, toast } from './ui.js';
import { t, tx } from './i18n.js';
import { estado, guardarProgreso, todosSellos } from './core.js';
import { distancia, formatoDist, vigilarPosicion } from './media.js';
import { app, cabecera, pintar, ir } from './piezas.js';
import { posicionRapida, lugarCercano, registrarActividad } from './viaje.js';
import { comprobarLogros } from './logros.js';
import { fechaCorta } from './graficos.js';

const RADIO = 100; // metros para abrir el sobre

async function codificar(obj) {
  const { deflateSync, strToU8 } = await import('../vendor/fflate.mjs');
  const bytes = deflateSync(strToU8(JSON.stringify(obj)), { level: 9 });
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decodificar(code) {
  const { inflateSync, strFromU8 } = await import('../vendor/fflate.mjs');
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(strFromU8(inflateSync(bytes)));
}

const enlace = (code) => `${location.origin}${location.pathname}#m=${code}`;

// ---------- dejar un mensaje ----------
export async function nuevoMensaje() {
  const R = estado.ruta;
  const estadoPos = h('p.mono', {}, t('buscandoPosicion'));
  const para = h('input', { type: 'text', placeholder: t('paraQuien') });
  const texto = h('textarea', { rows: 5, placeholder: t('textoMensaje') });
  const de = h('input', { type: 'text', value: estado.perfil.nombre || '' });
  const conCoords = todosSellos().filter((s) => s.lat != null);
  const selLugar = h('select', {}, h('option', { value: '' }, t('aquiMismo')), conCoords.map((s) => h('option', { value: s.id }, tx(s.nombre))));
  let pos = null;

  const cont = h('div.form-recuerdo', {},
    h('span.mono', {}, '✉ ' + t('mensajeSecreto')),
    h('h2', {}, t('dejarMensaje')),
    h('p.mut', {}, t('mensajeExplica')),
    estadoPos,
    conCoords.length ? h('label', {}, h('span.mono', {}, t('dondeQueda')), selLugar) : null,
    h('label', {}, h('span.mono', {}, t('paraQuien')), para),
    h('label', {}, h('span.mono', {}, t('mensaje')), texto),
    h('label', {}, h('span.mono', {}, t('firma')), de));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  posicionRapida(12000).then((p) => {
    pos = p;
    estadoPos.textContent = p ? `⌖ ${t('posicionLista')} ±${Math.round(p.precision)} m` : t('sinPosicionElige');
  });

  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        const elegido = selLugar.value ? conCoords.find((s) => s.id === selLugar.value) : null;
        const punto = elegido ? { lat: elegido.lat, lon: elegido.lon } : pos;
        if (!punto) { toast(t('sinPosicionElige'), 4000); return; }
        if (!texto.value.trim()) { toast(t('escribeAlgo')); return; }
        const lugar = elegido || lugarCercano(punto);
        const msg = {
          v: 1, id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          r: R.id, de: de.value.trim(), para: para.value.trim(), t: texto.value.trim(),
          la: +punto.lat.toFixed(5), lo: +punto.lon.toFixed(5), n: lugar ? tx(lugar.nombre) : '', ts: Date.now(),
        };
        const url = enlace(await codificar(msg));
        const quien = msg.de || t('alguien');
        const frase = t('mensajeCompartir', { de: quien, lugar: msg.n || tx(R.subtitulo) });
        let compartido = false;
        try {
          if (navigator.share) { await navigator.share({ title: 'Walk2life', text: frase, url }); compartido = true; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        if (!compartido) {
          try { await navigator.clipboard.writeText(`${frase}\n${url}`); toast(t('enlaceCopiado'), 4000); } catch { prompt(t('copiaEnlace'), url); }
        }
        estado.prog.enviados.push({ ...msg, enviado: Date.now() });
        registrarActividad(pos, lugar);
        await guardarProgreso();
        cerrar();
        await comprobarLogros();
        pintar();
      },
    }, t('enviar')),
    h('button.btn.sec', { onclick: cerrar }, t('cancelar'))));
}

// ---------- recibir un mensaje ----------
export async function recibir(code) {
  let m;
  try { m = await decodificar(code); } catch { toast(t('mensajeRoto'), 4000); return; }
  const P = estado.prog;
  if (P.mensajes.some((x) => x.id === m.id)) { ir('#/mensaje/' + m.id); return; }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const cont = h('div.sobre-nuevo', {},
    h('div.sobre-icono', {}, '✉'),
    h('span.mono', {}, t('mensajeSecreto')),
    h('h2', {}, t('teHanDejado', { de: m.de || t('alguien') })),
    h('p.lead', {}, m.n ? t('enLugar', { lugar: m.n }) : ''),
    h('p.mut', {}, t('seAbreAlLlegar')));
  const { cerrar } = hoja(cont, { clase: 'centrada' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        P.mensajes.push({ ...m, recibido: Date.now(), abierto: null });
        await guardarProgreso();
        cerrar();
        ir('#/mensaje/' + m.id);
      },
    }, t('anadirRuta'))));
  // iPhone: los enlaces abren Safari, no la app instalada (son almacenes separados). Copiar y pegar en la app.
  if (ios && !standalone) {
    cont.append(h('div.aviso-ios', {},
      h('p.mut.peq', {}, t('iosPegar')),
      h('button.btn.sec', {
        onclick: async () => {
          try { await navigator.clipboard.writeText(enlace(code)); toast(t('enlaceCopiado')); } catch { prompt(t('copiaEnlace'), enlace(code)); }
        },
      }, t('copiarMensaje'))));
  }
}

// Pegar un mensaje recibido (iPhone con la app instalada).
export async function pegarMensaje() {
  let txt = '';
  try { txt = await navigator.clipboard.readText(); } catch {}
  const m = /#m=([A-Za-z0-9_-]+)/.exec(txt || '');
  if (m) return recibir(m[1]);
  const area = h('textarea', { rows: 4, placeholder: t('pegaAqui') });
  const cont = h('div', {}, h('h2', {}, t('pegarMensaje')), area);
  const { cerrar } = hoja(cont, { clase: 'centrada' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: () => {
        const x = /#m=([A-Za-z0-9_-]+)/.exec(area.value);
        if (!x) { toast(t('mensajeRoto')); return; }
        cerrar();
        recibir(x[1]);
      },
    }, t('continuar')),
    h('button.btn.sec', { onclick: cerrar }, t('cancelar'))));
}

// ---------- pantalla del mensaje ----------
export async function pantallaMensaje(id) {
  const m = estado.prog.mensajes.find((x) => x.id === id);
  if (!m) return ir('#/');
  app.append(cabecera('#/'));
  const sec = h('section.mensaje', {});
  app.append(sec);
  const abrir = async () => {
    m.abierto = Date.now();
    registrarActividad(estado.ultimaPos || null, lugarCercano({ lat: m.la, lon: m.lo }));
    await guardarProgreso();
    await comprobarLogros();
    pintar();
  };
  if (m.abierto) {
    sec.append(
      h('span.mono', {}, `✉ ${m.n || ''} · ${fechaCorta(m.ts)}`),
      h('h1', {}, m.para ? t('paraNombre', { n: m.para }) : t('mensajeSecreto')),
      h('p.frase.carta-texto', {}, m.t),
      h('p.mono', {}, '— ' + (m.de || t('alguien'))));
    return;
  }
  const dist = h('p.cuenta', {}, t('buscandoPosicion'));
  const accion = h('div.botones');
  sec.append(
    h('div.sobre-icono.cerrado', {}, '✉'),
    h('span.mono', {}, t('mensajeSecreto')),
    h('h1', {}, t('teHanDejado', { de: m.de || t('alguien') })),
    h('p.lead', {}, m.n ? t('enLugar', { lugar: m.n }) : ''),
    dist, accion);
  const ok = vigilarPosicion((pos) => {
    accion.innerHTML = '';
    if (!pos) {
      dist.textContent = t('sinGPSMensaje');
      accion.append(h('button.btn.sec', { onclick: abrir }, t('heLlegado')));
      return;
    }
    estado.ultimaPos = pos;
    const d = distancia(pos, { lat: m.la, lon: m.lo });
    if (d <= RADIO + Math.min(pos.precision || 0, 50)) {
      dist.textContent = t('estasAqui');
      accion.append(h('button.btn', { onclick: abrir }, t('abrirSobre')));
    } else dist.textContent = t('aDistancia', { d: formatoDist(d) });
  });
  if (!ok) { dist.textContent = t('sinGPSMensaje'); accion.append(h('button.btn.sec', { onclick: abrir }, t('heLlegado'))); }
}
