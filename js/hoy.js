// "Hoy": la pantalla principal. Progreso del día como un juego, siguiente sello, lo vivido hoy y el diario.
import { h, hoja, toast, textoAutor } from './ui.js';
import { t, tx, getIdioma } from './i18n.js';
import { estado, guardarProgreso, guardarPerfil, todosSellos, sellado, buscarSello, cuenta, diasHasta, fechaCarta } from './core.js';
import { blobs, urlBlob, pedirPersistencia } from './db.js';
import { comprimirFoto, elegirFotos, grabadora, distancia, formatoDist, vigilarPosicion } from './media.js';
import { app, cabecera, pintar, ir, canvasSello, barra } from './piezas.js';
import {
  claveDia, dia, numeroDia, fechaLarga, kmDia, kmTotales, progresoObjetivo, diaSinCerrar, contenidoDia, nuevaEntrada,
  hayTrack, kmEnTrack, registrarActividad, lugarCercano, diasOrdenados,
} from './viaje.js';
import { comprobarLogros, logros } from './logros.js';
import { fichaPersona } from './gente.js';
import { nuevoMensaje, pegarMensaje } from './mensajes.js';
import { fechaCorta } from './graficos.js';

const kmTxt = (n) => (n == null ? '—' : n.toFixed(1).replace('.', ','));
const horaTxt = (ts) => new Date(ts).toLocaleTimeString(getIdioma(), { hour: '2-digit', minute: '2-digit' });

// Anillo de progreso (SVG).
function anillo(frac, centro, pie) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'anillo');
  const C = 2 * Math.PI * 88;
  for (const [cls, len] of [['fondo', C], ['valor', C * Math.max(0, Math.min(1, frac))]]) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', 100); c.setAttribute('cy', 100); c.setAttribute('r', 88);
    c.setAttribute('class', cls);
    c.setAttribute('stroke-dasharray', `${len} ${C}`);
    svg.append(c);
  }
  return h('div.anillo-wrap', {}, svg, h('div.anillo-centro', {}, h('span.num', {}, centro), h('span.mono', {}, pie)));
}

// ---------------- HOY ----------------
export async function pantallaHoy() {
  const R = estado.ruta, P = estado.prog;
  app.append(cabecera());
  const nada = !P.salida && !Object.keys(P.sellos).length && !diasOrdenados().length;

  if (nada) return bienvenida();

  // día anterior sin cerrar
  const pendiente = diaSinCerrar();
  if (pendiente) {
    app.append(h('section.aviso-dia', { onclick: () => cerrarDia(pendiente) },
      h('span.mono', {}, `${t('dia')} ${numeroDia(pendiente)}`),
      h('strong', {}, t('cerramosAyer')),
      h('span.mut', {}, t('cerrarDiaTexto'))));
  }

  const clave = claveDia();
  const d = dia(clave, false);

  // antes de salir: cuenta atrás
  if (!d && P.salida && diasHasta(P.salida) > 0 && !Object.keys(P.sellos).length) {
    const n = diasHasta(P.salida);
    app.append(h('section.cuentaatras', {},
      h('span.num', {}, n > 1 ? n : ''),
      h('span.mono', {}, n > 1 ? t('faltanDias', { n }) : t('faltaDia'))));
  }

  // cabecera del día
  const nDia = numeroDia(clave);
  const c = cuenta();
  app.append(h('section.hoy-cab', {},
    h('span.mono', {}, fechaLarga(clave, getIdioma())),
    h('h1.titulo-dia', {}, `${t('dia')} ${nDia}`),
    h('div.cifras', {},
      h('div', {}, h('span.num', {}, kmTxt(d ? kmDia(d) : null)), h('span.mono', {}, t('kmHoy'))),
      h('div', {}, h('span.num', {}, `${c.hechos}/${c.total}`), h('span.mono', {}, t('sellos'))),
      h('div', {}, h('span.num', {}, String(Object.keys(P.logros).length)), h('span.mono', {}, t('logros'))))));

  // objetivo del día
  const zonaObj = h('section.objetivo');
  app.append(zonaObj);
  const pintarObjetivo = () => {
    zonaObj.innerHTML = '';
    const dd = dia(clave, false);
    if (!dd || !dd.objetivo) {
      const pendientes = todosSellos().filter((s) => !sellado(s.id) && !s.oculto);
      if (!pendientes.length) return;
      const sel = h('select', {}, pendientes.map((s) => h('option', { value: s.id }, `${t('etapa')} ${s.etapa} · ${tx(s.nombre)}`)));
      sel.value = pendientes[Math.min(pendientes.length - 1, 3)].id;
      zonaObj.append(h('span.mono', {}, t('objetivoDia')), h('h2.pregunta.peq', {}, t('hastaDonde')), sel,
        h('button.btn', {
          onclick: async () => {
            const nd = registrarActividad(estado.ultimaPos || null, null);
            nd.objetivo = sel.value;
            await guardarProgreso();
            pedirPersistencia();
            pintar();
          },
        }, t('ponerObjetivo')));
      return;
    }
    const pr = progresoObjetivo(clave);
    if (!pr) return;
    const pie = pr.tipo === 'km' ? `${kmTxt(pr.hecho)} / ${kmTxt(pr.total)} km` : `${pr.hecho} / ${pr.total} ${t('sellos').toLowerCase()}`;
    zonaObj.append(
      anillo(pr.frac, `${Math.round(pr.frac * 100)}%`, pie),
      h('p.hacia', {}, h('span.mono', {}, t('haciaObjetivo')), h('strong', {}, tx(pr.obj.nombre))),
      h('button.enlace', { onclick: async () => { dd.objetivo = null; await guardarProgreso(); pintar(); } }, t('cambiarObjetivo')));
  };
  pintarObjetivo();

  // siguiente sello
  const sig = todosSellos().find((s) => !sellado(s.id) && !s.oculto);
  const distSig = h('span.mono');
  if (sig) {
    app.append(h('section.siguiente', { onclick: () => ir('#/sello/' + sig.id) },
      h('span.mono', {}, `${t('siguienteSello')} · ${t('etapa')} ${sig.etapa}`),
      h('strong', {}, tx(sig.nombre)),
      h('p.mut', {}, tx(sig.pista)),
      distSig));
  }

  // mensajes secretos por abrir
  const sinAbrir = P.mensajes.filter((m) => !m.abierto);
  const zonaMsg = h('section.mensajes-cerca');
  if (sinAbrir.length) {
    zonaMsg.append(h('h2.seccion', {}, t('mensajesCamino')));
    for (const m of sinAbrir) {
      m._el = h('span.mono');
      zonaMsg.append(h('a.msg-fila', { href: '#/mensaje/' + m.id }, h('span.sobre-mini', {}, '✉'),
        h('div', {}, h('strong', {}, t('teHanDejado', { de: m.de || t('alguien') })), h('span.mut', {}, m.n || ''), m._el)));
    }
    app.append(zonaMsg);
  }

  // GPS con la app abierta: distancia al siguiente sello, a los mensajes y progreso por km
  const conCoords = (sig && sig.lat != null) || sinAbrir.length || hayTrack();
  if (conCoords) {
    vigilarPosicion((pos) => {
      if (!pos) return;
      estado.ultimaPos = { ...pos, ts: Date.now() };
      if (sig && sig.lat != null) distSig.textContent = t('aDistancia', { d: formatoDist(distancia(pos, sig)) });
      for (const m of sinAbrir) if (m._el) m._el.textContent = t('aDistancia', { d: formatoDist(distancia(pos, { lat: m.la, lon: m.lo })) });
      if (hayTrack()) pintarObjetivo();
    });
  }

  // lo vivido hoy
  const cont = contenidoDia(clave);
  app.append(h('section.hoy-linea', {}, h('h2.seccion', {}, t('loDeHoy')), await linea(cont, true)));

  if (d && !d.cerrado) app.append(h('section.centro', {}, h('button.btn.sec', { onclick: () => cerrarDia(clave) }, '☾ ' + t('cerrarDia'))));
  if (d && d.cerrado) app.append(h('section.centro', {}, h('a.btn.sec', { href: '#/dia/' + clave }, t('verDiario'))));

  // carta al futuro
  const fc = fechaCarta();
  if (fc) {
    const n = diasHasta(fc);
    app.append(h('section.carta-aviso', { onclick: () => ir('#/final') },
      h('span.mono', {}, '✉ ' + t('cartaFutura')),
      h('p', {}, n > 0 ? t('cartaSeAbre', { n }) : t('cartaAbierta'))));
  }
}

function bienvenida() {
  const R = estado.ruta, P = estado.prog;
  const nombre = h('input', { type: 'text', value: estado.perfil.nombre || '', placeholder: t('tuNombre'), autocomplete: 'name' });
  const fecha = h('input', { type: 'date' });
  app.append(h('section.portada', {},
    h('p.mono', {}, tx(R.recorrido)),
    h('h1.titulo', {}, tx(R.titulo)),
    h('p.subtitulo', {}, tx(R.subtitulo))));
  app.append(h('section.bienvenida', {},
    h('span.mono', {}, t('prologo')),
    textoAutor(tx(R.prologo)),
    h('label', {}, h('span.mono', {}, t('tuNombre')), nombre),
    h('label', {}, h('span.mono', {}, t('fechaSalida')), fecha),
    h('button.btn', {
      onclick: async () => {
        estado.perfil.nombre = nombre.value.trim();
        P.salida = fecha.value || claveDia();
        await guardarPerfil();
        await guardarProgreso();
        pedirPersistencia();
        pintar();
      },
    }, t('comenzarRuta'))));
  app.append(h('p.privacidad', {}, t('privacidad')));
}

// Línea de tiempo de un día: sellos, fotos, notas, voz, gente, figuras y mensajes, por hora.
async function linea(c, vacioHoy = false) {
  const items = [];
  for (const s of c.sellos) items.push({ ts: estado.prog.sellos[s.id].ts, el: () => h('a.item', { href: '#/sello/' + s.id }, canvasSello(s, 44), h('div', {}, h('strong', {}, tx(s.nombre)), h('span.mono', {}, t('sello')))) });
  for (const e of c.entradas) {
    items.push({
      ts: e.ts, el: async () => {
        const cuerpo = h('div');
        if (e.tipo === 'foto') { const g = h('div.medios'); for (const f of e.fotos || []) g.append(h('img', { src: await urlBlob(f), alt: '' })); cuerpo.append(g); }
        if (e.tipo === 'voz' && e.audio) cuerpo.append(h('audio', { controls: true, src: await urlBlob(e.audio) }));
        if (e.texto) cuerpo.append(h('p.frase', {}, e.texto));
        return h('div.item.entrada', {}, h('span.icono', {}, e.tipo === 'foto' ? '◉' : e.tipo === 'voz' ? '●' : '✎'), cuerpo);
      },
    });
  }
  for (const g of c.gente) items.push({ ts: g.ts, el: async () => h('a.item', { href: '#/persona/' + g.id }, g.fotos && g.fotos[0] ? h('img.cara-mini', { src: await urlBlob(g.fotos[0]), alt: '' }) : h('span.icono', {}, '☺'), h('div', {}, h('strong', {}, g.nombre || '—'), h('span.mono', {}, t('nuevaPersonaConocida')))) });
  for (const k of c.capturas) {
    const s = buscarSello(k.id);
    items.push({ ts: k.ts, el: async () => h('a.item', { href: '#/sello/' + k.id }, h('img.cara-mini', { src: await urlBlob(k.foto), alt: '' }), h('div', {}, h('strong', {}, s ? tx(s.nombre) : ''), h('span.mono', {}, '✧ ' + t('figura')))) });
  }
  for (const m of c.mensajes) items.push({ ts: m.abierto, el: () => h('a.item', { href: '#/mensaje/' + m.id }, h('span.icono', {}, '✉'), h('div', {}, h('strong', {}, t('teHanDejado', { de: m.de || t('alguien') })), h('span.mono', {}, m.n || ''))) });
  items.sort((a, b) => a.ts - b.ts);
  const el = h('div.linea');
  if (!items.length) el.append(h('p.mut', {}, vacioHoy ? t('hoyVacio') : '—'));
  for (const it of items) el.append(h('div.momento-linea', {}, h('span.hora', {}, horaTxt(it.ts)), await it.el()));
  return el;
}

// ---------------- cerrar el día ----------------
export function cerrarDia(clave) {
  const d = dia(clave);
  const n = numeroDia(clave);
  const lista = todosSellos();
  const diario = h('textarea', { rows: 8, value: d.diario || '', placeholder: t('diarioMarcador') });
  const km = h('input', { type: 'number', step: '0.1', min: 0, value: kmDia(d) != null ? kmDia(d).toFixed(1) : '' });
  const finActual = (d.fin && d.fin.lugar) || (d.ultimo && d.ultimo.lugar) || '';
  const sel = h('select', {}, h('option', { value: '' }, '—'), lista.map((s) => h('option', { value: s.id, selected: s.id === finActual }, `${t('etapa')} ${s.etapa} · ${tx(s.nombre)}`)));
  const cont = h('div.form-recuerdo', {},
    h('span.mono', {}, `☾ ${t('dia')} ${n} · ${fechaLarga(clave, getIdioma())}`),
    h('h2', {}, t('cerrarDia')),
    h('p.mut', {}, t('cerrarDiaTexto')),
    h('label', {}, h('span.mono', {}, t('tuDiario')), diario),
    h('label', {}, h('span.mono', {}, t('dondeTerminas')), sel),
    h('label', {}, h('span.mono', {}, t('kmDelDia')), km));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        d.diario = diario.value.trim();
        const estimado = kmDia({ ...d, kmManual: null });
        const v = km.value === '' ? null : +km.value;
        d.kmManual = v != null && (estimado == null || Math.abs(v - estimado) > 0.05) ? v : null;
        const s = sel.value ? buscarSello(sel.value) : null;
        const pos = clave === claveDia() ? estado.ultimaPos || null : null;
        d.fin = { ts: Date.now(), pos, km: (d.ultimo && d.ultimo.km) ?? null, lugar: s ? s.id : finActual || null };
        if (pos && hayTrack()) d.fin.km = kmEnTrack(pos).km;
        d.cerrado = Date.now();
        await guardarProgreso();
        cerrar();
        toast('☾ ' + t('diaCerrado'));
        await comprobarLogros();
        pintar();
      },
    }, t('guardar')),
    h('button.btn.sec', { onclick: cerrar }, t('cancelar'))));
}

// ---------------- un día del diario ----------------
export async function pantallaDia(clave) {
  const d = dia(clave, false);
  if (!d) return ir('#/recuerdos');
  app.append(cabecera('#/recuerdos'));
  const ini = d.inicio && d.inicio.lugar ? buscarSello(d.inicio.lugar) : null;
  const fin = (d.fin && d.fin.lugar && buscarSello(d.fin.lugar)) || (d.ultimo && d.ultimo.lugar && buscarSello(d.ultimo.lugar));
  app.append(h('section.hoy-cab', {},
    h('span.mono', {}, fechaLarga(clave, getIdioma())),
    h('h1.titulo-dia', {}, `${t('dia')} ${numeroDia(clave)}`),
    h('p.mut', {}, `${ini ? tx(ini.nombre) : '…'} → ${fin ? tx(fin.nombre) : '…'} · ${kmTxt(kmDia(d))} km`)));
  if (d.diario) app.append(h('section.narrativa', {}, h('span.mono', {}, t('tuDiario')), h('p.frase.carta-texto', {}, d.diario)));
  app.append(h('section', {}, await linea(contenidoDia(clave))));
  app.append(h('section.centro', {}, h('button.btn.sec', { onclick: () => cerrarDia(clave) }, d.cerrado ? t('editarDiario') : '☾ ' + t('cerrarDia'))));
}

// ---------------- botón ＋ ----------------
export function menuMas() {
  const opcion = (icono, texto, fn) => h('button.opcion', { onclick: () => { cerrar(); setTimeout(fn, 350); } }, h('span.icono', {}, icono), h('span', {}, texto));
  const sig = lugarCercano(estado.ultimaPos);
  const cont = h('div.menu-mas', {},
    h('span.mono', {}, fechaLarga(claveDia(), getIdioma())),
    h('div.opciones', {},
      opcion('◉', t('foto'), fotoRapida),
      opcion('✎', t('nota'), notaRapida),
      opcion('●', t('notaVoz'), vozRapida),
      opcion('☺', t('persona'), () => fichaPersona()),
      sig && sellado(sig.id) ? opcion('✧', t('capturarFigura'), async () => (await import('./captura.js')).capturar(sig.id)) : null,
      opcion('✉', t('mensajeSecreto'), nuevoMensaje),
      opcion('⎘', t('pegarMensaje'), pegarMensaje)));
  const { cerrar } = hoja(cont, { clase: 'centrada' });
  cont.append(h('button.enlace', { onclick: cerrar }, t('cerrar')));
}

async function guardarEntrada(datos) {
  await nuevaEntrada(datos);
  toast('✓ ' + t('guardadoEnDia'));
  await comprobarLogros();
  pintar();
}

function fotoRapida() {
  const i = h('input', { type: 'file', accept: 'image/*', multiple: true });
  i.onchange = async () => {
    const files = [...(i.files || [])].slice(0, 6);
    if (!files.length) return;
    const fotos = [];
    for (const f of files) fotos.push(await blobs.guardar(await comprimirFoto(f), 'diario'));
    const pie = h('input', { type: 'text', placeholder: t('pieFoto') });
    const cont = h('div', {}, h('h2', {}, t('foto')), h('p.mut', {}, t('fotosN', { n: fotos.length })), pie);
    const { cerrar } = hoja(cont, { clase: 'centrada' });
    cont.append(h('div.botones', {},
      h('button.btn', { onclick: async () => { cerrar(); await guardarEntrada({ tipo: 'foto', fotos, texto: pie.value.trim() }); } }, t('guardar')),
      h('button.btn.sec', { onclick: async () => { for (const f of fotos) await blobs.del(f); cerrar(); } }, t('cancelar'))));
  };
  i.click();
}

function notaRapida() {
  const area = h('textarea', { rows: 6, placeholder: t('notaMarcador') });
  const cont = h('div', {}, h('h2', {}, t('nota')), area);
  const { cerrar } = hoja(cont, { clase: 'centrada' });
  cont.append(h('div.botones', {},
    h('button.btn', { onclick: async () => { if (!area.value.trim()) return; cerrar(); await guardarEntrada({ tipo: 'nota', texto: area.value.trim() }); } }, t('guardar')),
    h('button.btn.sec', { onclick: cerrar }, t('cancelar'))));
  setTimeout(() => area.focus(), 350);
}

function vozRapida() {
  let grab = null;
  const estadoTxt = h('p.cuenta', {}, t('pulsaGrabar'));
  const b = h('button.btn', {
    onclick: async () => {
      if (!grab) {
        try { grab = await grabadora(); } catch { toast(t('sinMicro')); return; }
        b.textContent = '■ ' + t('parar'); b.classList.add('grabando'); estadoTxt.textContent = t('grabando');
      } else {
        const blob = await grab.parar(); grab = null;
        cerrar();
        await guardarEntrada({ tipo: 'voz', audio: await blobs.guardar(blob, 'voz') });
      }
    },
  }, '● ' + t('grabar'));
  const cont = h('div', {}, h('h2', {}, t('notaVoz')), estadoTxt, h('div.botones', {}, b));
  const { cerrar } = hoja(cont, { clase: 'centrada' });
  cont.append(h('button.enlace', { onclick: async () => { if (grab) await grab.parar(); cerrar(); } }, t('cancelar')));
}
