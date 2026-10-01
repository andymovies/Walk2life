// Entregables generados en el propio móvil: certificado (PDF), fotobook (PDF) y videoresumen (MP4).
import { estado, todosSellos, etapa, medio, buscarSello } from './core.js';
import { blobs } from './db.js';
import { tx } from './i18n.js';
import { dibujarSello, dibujarInsignia, fuentesListas, fechaCorta, parrafo, cubrir } from './graficos.js';
import { claveDia, diasOrdenados, numeroDia, fechaLarga, kmDia, contenidoDia } from './viaje.js';
import { logros } from './logros.js';

const A4 = { w: 1240, h: 1754 }; // 150 ppp
const limpio = (s) => String(s || '').trim();

// ---------- PDF mínimo: una imagen JPEG a página completa por página ----------
async function pdfDeCanvases(canvases) {
  const enc = new TextEncoder();
  const partes = [];
  let pos = 0;
  const offsets = [];
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); pos += b.length; };
  const W = 595.28, H = 841.89;
  const n = canvases.length;
  // objetos: 1 catálogo, 2 páginas, luego por página: página, contenido, imagen
  const idPag = (i) => 3 + i * 3;
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  offsets[1] = pos; push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  offsets[2] = pos;
  push(`2 0 obj\n<< /Type /Pages /Count ${n} /Kids [${canvases.map((_, i) => `${idPag(i)} 0 R`).join(' ')}] >>\nendobj\n`);
  for (let i = 0; i < n; i++) {
    const c = canvases[i];
    const jpg = new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86))).arrayBuffer());
    const p = idPag(i), cont = p + 1, img = p + 2;
    offsets[p] = pos;
    push(`${p} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${img} 0 R >> >> /Contents ${cont} 0 R >>\nendobj\n`);
    const flujo = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    offsets[cont] = pos;
    push(`${cont} 0 obj\n<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream\nendobj\n`);
    offsets[img] = pos;
    push(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    push(jpg);
    push('\nendstream\nendobj\n');
  }
  const total = 3 + n * 3;
  const xref = pos;
  let t = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) t += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(t + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: 'application/pdf' });
}

function pagina(fondo) {
  const c = document.createElement('canvas');
  c.width = A4.w; c.height = A4.h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, ctx };
}

function espaciado(ctx, texto, x, y, sep) {
  // texto con tracking amplio, centrado en x
  const chars = [...texto];
  const anchos = chars.map((ch) => ctx.measureText(ch).width + sep);
  let xx = x - (anchos.reduce((a, b) => a + b, 0) - sep) / 2;
  const al = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, xx, y); xx += anchos[i]; });
  ctx.textAlign = al;
}

// Código de verificación: resumen de los datos del certificado (no depende de ningún servidor).
async function codigo() {
  const datos = JSON.stringify([estado.rutaId, estado.perfil.nombre, Object.entries(estado.prog.sellos).map(([k, v]) => [k, v.ts]).sort()]);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(datos)));
  const hex = [...h.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${estado.rutaId.toUpperCase()}-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

function fechas() {
  const ts = Object.values(estado.prog.sellos).map((s) => s.ts);
  const ini = Math.min(...ts, ...Object.values(estado.prog.etapas).map((e) => e.inicio || Infinity));
  const fin = estado.prog.completada || Math.max(...ts);
  return { ini: fechaCorta(ini), fin: fechaCorta(fin) };
}

// ---------- Certificado ----------
export async function certificado() {
  await fuentesListas();
  const R = estado.ruta;
  const { c, ctx } = pagina('#f3eee4');
  const tinta = '#1d1b18';
  const cx = A4.w / 2;
  ctx.strokeStyle = 'rgba(29,27,24,.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, A4.w - 120, A4.h - 120);
  ctx.lineWidth = 1;
  ctx.strokeRect(74, 74, A4.w - 148, A4.h - 148);

  ctx.fillStyle = tinta;
  ctx.textAlign = 'center';
  ctx.font = '400 22px "Courier Prime"';
  espaciado(ctx, `${limpio(R.titulo)} · ${limpio(tx(R.subtitulo))}`.toUpperCase(), cx, 170, 5);
  ctx.font = '200 96px Jost';
  espaciado(ctx, limpio(tx(R.certificado?.titulo) || 'Certificado').toUpperCase(), cx, 290, 30);

  dibujarInsignia(ctx, cx, 470, 120, { nombre: tx(R.insignia?.nombre) || R.subtitulo, codigo: R.titulo, ganada: true });
  // la insignia en oro sobre papel necesita algo más de contraste
  ctx.fillStyle = tinta;
  ctx.font = '300 64px Jost';
  ctx.fillText(estado.perfil.nombre || '[nombre]', cx, 700);
  ctx.font = '300 28px Jost';
  const texto = tx(R.certificado?.texto).replace('{nombre}', estado.perfil.nombre || '[nombre]');
  parrafo(ctx, texto, cx, 780, 900, 44);

  const f = fechas();
  ctx.font = '400 24px "Courier Prime"';
  ctx.fillText(`${f.ini} — ${f.fin}`, cx, 930);

  // cuadrícula de sellos
  const lista = todosSellos().filter((s) => estado.prog.sellos[s.id]);
  // la cuadrícula se encoge si hay muchos sellos, para que siempre quepa entre el texto y la firma
  const cols = lista.length > 24 ? 7 : 6;
  const filas = Math.max(1, Math.ceil(lista.length / cols));
  const y0 = 1050;
  const gy = Math.min(150, 470 / filas), gx = Math.min(170, 1000 / cols), r = Math.min(62, gy * 0.42);
  lista.forEach((s, i) => {
    const fila = Math.floor(i / cols), col = i % cols;
    const enFila = Math.min(cols, lista.length - fila * cols);
    const x = cx + (col - (enFila - 1) / 2) * gx;
    dibujarSello(ctx, x, y0 + fila * gy, r, { id: s.id, nombre: tx(s.nombre), etapa: s.etapa, fecha: fechaCorta(estado.prog.sellos[s.id].ts) });
  });

  const yf = 1560;
  ctx.fillStyle = tinta;
  ctx.font = '300 30px Jost';
  ctx.fillText(limpio(R.certificado?.firma), cx, yf);
  ctx.strokeStyle = 'rgba(29,27,24,.4)';
  ctx.beginPath(); ctx.moveTo(cx - 160, yf - 40); ctx.lineTo(cx + 160, yf - 40); ctx.stroke();
  ctx.font = '400 18px "Courier Prime"';
  ctx.fillStyle = 'rgba(29,27,24,.6)';
  ctx.fillText(await codigo(), cx, A4.h - 100);
  return pdfDeCanvases([c]);
}

// ---------- Fotobook ----------
async function bitmap(id) {
  const b = id ? await blobs.get(id) : null;
  return b ? createImageBitmap(b) : null;
}

// Días del viaje: los del diario y los de cualquier sello (por si un sello no abrió día).
function clavesViaje() {
  const set = new Set(diasOrdenados());
  Object.values(estado.prog.sellos).forEach((s) => set.add(claveDia(s.ts)));
  return [...set].sort();
}

async function fotosDe(sello) {
  const p = estado.prog.sellos[sello.id];
  const out = [];
  for (const id of (p && p.fotos) || []) {
    const b = await blobs.get(id);
    if (b) out.push(await createImageBitmap(b));
  }
  return out;
}

export async function fotobook(onProgreso = () => {}) {
  await fuentesListas();
  const R = estado.ruta;
  const pags = [];
  const F = '#070707', T = '#f2efe9', M = 'rgba(242,239,233,.5)';
  const cx = A4.w / 2;

  // portada
  {
    const { c, ctx } = pagina(F);
    ctx.fillStyle = T; ctx.textAlign = 'center';
    ctx.font = '400 22px "Courier Prime"'; ctx.fillStyle = M;
    espaciado(ctx, 'FOTOBOOK', cx, 260, 8);
    ctx.fillStyle = T; ctx.font = '200 110px Jost';
    espaciado(ctx, limpio(R.titulo).toUpperCase(), cx, 480, 40);
    ctx.font = '200 44px Jost';
    espaciado(ctx, limpio(tx(R.subtitulo)).toUpperCase(), cx, 560, 18);
    dibujarInsignia(ctx, cx, 860, 170, { nombre: tx(R.insignia?.nombre) || R.subtitulo, codigo: R.titulo, ganada: !!estado.prog.completada });
    ctx.fillStyle = T; ctx.font = '300 48px Jost';
    ctx.fillText(estado.perfil.nombre || '', cx, 1230);
    const f = fechas();
    ctx.fillStyle = M; ctx.font = '400 24px "Courier Prime"';
    ctx.fillText(`${f.ini} — ${f.fin}`, cx, 1290);
    pags.push(c);
  }

  // página de respuestas de una etapa (cuando se cerró)
  const paginaEtapa = (e) => {
    const pe = estado.prog.etapas[e.n];
    const { c, ctx } = pagina(F);
    ctx.textAlign = 'center';
    ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
    espaciado(ctx, `ETAPA ${e.n}`, cx, 300, 8);
    ctx.fillStyle = T; ctx.font = '200 64px Jost';
    parrafo(ctx, limpio(tx(e.titulo)).toUpperCase(), cx, 400, 1000, 80);
    ctx.fillStyle = M; ctx.font = '300 30px Jost';
    ctx.fillText(`${tx(e.origen)} → ${tx(e.destino)}`, cx, 560);
    let y = 720;
    ctx.textAlign = 'left';
    const resp = [
      ...(e.preguntasInicio || []).map((q, i) => [q, pe && pe.respInicio[i]]),
      ...(e.preguntasFin || []).map((q, i) => [q, pe && pe.respFin[i]]),
    ].filter(([, r]) => limpio(r));
    for (const [q, r] of resp) {
      if (y > A4.h - 200) break;
      ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
      y += parrafo(ctx, tx(q), 170, y, 900, 30) + 6;
      ctx.fillStyle = T; ctx.font = '300 30px Jost';
      y += parrafo(ctx, r, 170, y, 900, 42) + 34;
    }
    pags.push(c);
  };

  const paginaSello = async (s) => {
    const p = estado.prog.sellos[s.id];
    const fotos = await fotosDe(s);
    const { c, ctx } = pagina(F);
    const m = 110, w = A4.w - m * 2;
    if (fotos.length === 1) cubrir(ctx, fotos[0], m, m, w, 1100);
    else if (fotos.length === 2) { cubrir(ctx, fotos[0], m, m, w, 540); cubrir(ctx, fotos[1], m, m + 560, w, 540); }
    else if (fotos.length >= 3) {
      cubrir(ctx, fotos[0], m, m, w, 640);
      cubrir(ctx, fotos[1], m, m + 660, (w - 20) / 2, 440);
      cubrir(ctx, fotos[2], m + (w + 20) / 2, m + 660, (w - 20) / 2, 440);
    }
    fotos.forEach((f) => f.close && f.close());
    const yT = fotos.length ? 1310 : 500;
    if (!fotos.length) dibujarSello(ctx, cx, 420, 200, { id: s.id, nombre: tx(s.nombre), etapa: s.etapa, fecha: fechaCorta(p.ts) });
    else dibujarSello(ctx, A4.w - m - 90, yT - 110, 95, { id: s.id, nombre: tx(s.nombre), etapa: s.etapa, fecha: fechaCorta(p.ts) });
    ctx.textAlign = fotos.length ? 'left' : 'center';
    const x = fotos.length ? m : cx;
    ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
    ctx.fillText(`ETAPA ${s.etapa} · ${fechaCorta(p.ts)}`, x, fotos.length ? yT - 40 : 700);
    ctx.fillStyle = T; ctx.font = '300 44px Jost';
    const yN = fotos.length ? yT + 20 : 780;
    const hN = parrafo(ctx, limpio(tx(s.nombre)), x, yN, fotos.length ? w - 230 : w, 54);
    if (limpio(p.frase)) {
      ctx.fillStyle = T; ctx.font = '400 30px "Courier Prime"';
      parrafo(ctx, `“${limpio(p.frase)}”`, x, yN + hN + 30, w, 42);
    }
    pags.push(c);
  };

  // páginas de fotos del diario: hasta 4 por página, con su pie
  const paginasFotos = async (items, etiqueta) => {
    for (let i = 0; i < items.length; i += 4) {
      const grupo = items.slice(i, i + 4);
      const { c, ctx } = pagina(F);
      const m = 110, gap = 20, w = (A4.w - m * 2 - gap) / 2, hh = 640;
      for (let j = 0; j < grupo.length; j++) {
        const img = await bitmap(grupo[j].foto);
        // una sola foto ocupa la página; si hay más, rejilla de 2×2
        const sola = grupo.length === 1;
        const x = sola ? m : m + (j % 2) * (w + gap), y = sola ? m : m + Math.floor(j / 2) * (hh + 120);
        const ww = sola ? A4.w - m * 2 : w, hhh = sola ? 1250 : hh;
        if (img) { cubrir(ctx, img, x, y, ww, hhh); img.close && img.close(); }
        if (grupo[j].pie) {
          ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"'; ctx.textAlign = 'left';
          parrafo(ctx, grupo[j].pie, x, y + hhh + 36, ww, 28);
        }
      }
      ctx.fillStyle = M; ctx.font = '400 20px "Courier Prime"'; ctx.textAlign = 'center';
      ctx.fillText(etiqueta, cx, A4.h - 70);
      pags.push(c);
    }
  };

  const claves = clavesViaje();
  let hecho = 0;
  for (const k of claves) {
    const d = estado.prog.dias[k] || {};
    const cont = contenidoDia(k);
    const etiqueta = `DÍA ${numeroDia(k)} · ${fechaCorta(new Date(k + 'T12:00'))}`;
    // página del día: cifras, diario, notas y gente
    {
      const { c, ctx } = pagina(F);
      ctx.textAlign = 'center';
      ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
      espaciado(ctx, fechaLarga(k).toUpperCase(), cx, 260, 4);
      ctx.fillStyle = T; ctx.font = '200 110px Jost';
      espaciado(ctx, `DÍA ${numeroDia(k)}`, cx, 400, 30);
      const ini = d.inicio && d.inicio.lugar ? buscarSello(d.inicio.lugar) : null;
      const fin = (d.fin && d.fin.lugar && buscarSello(d.fin.lugar)) || (d.ultimo && d.ultimo.lugar && buscarSello(d.ultimo.lugar));
      const km = kmDia(d);
      ctx.fillStyle = M; ctx.font = '300 30px Jost';
      ctx.fillText(`${ini ? limpio(tx(ini.nombre)) : '…'} → ${fin ? limpio(tx(fin.nombre)) : '…'}${km != null ? ` · ${km.toFixed(1).replace('.', ',')} km` : ''}`, cx, 480);
      let y = 600;
      ctx.textAlign = 'left';
      if (limpio(d.diario)) {
        ctx.fillStyle = T; ctx.font = '400 30px "Courier Prime"';
        y += parrafo(ctx, limpio(d.diario), 150, y, A4.w - 300, 44) + 40;
      }
      for (const n of cont.entradas.filter((e) => e.tipo === 'nota' && limpio(e.texto))) {
        if (y > A4.h - 260) break;
        ctx.fillStyle = M; ctx.font = '400 20px "Courier Prime"';
        ctx.fillText(new Date(n.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }), 150, y);
        ctx.fillStyle = T; ctx.font = '300 28px Jost';
        y += parrafo(ctx, limpio(n.texto), 260, y, A4.w - 410, 38) + 24;
      }
      if (cont.gente.length && y < A4.h - 200) {
        ctx.fillStyle = M; ctx.font = '400 20px "Courier Prime"';
        ctx.fillText('HOY CONOCISTE A', 150, y + 20);
        ctx.fillStyle = T; ctx.font = '300 30px Jost';
        parrafo(ctx, cont.gente.map((g) => g.nombre || '—').join(' · '), 150, y + 64, A4.w - 300, 42);
      }
      pags.push(c);
    }
    // etapas cerradas este día
    for (const e of R.etapas) {
      const pe = estado.prog.etapas[e.n];
      if (pe && pe.fin && claveDia(pe.fin) === k) paginaEtapa(e);
    }
    for (const s of cont.sellos) await paginaSello(s);
    const fotosDia = cont.entradas.filter((e) => e.tipo === 'foto').flatMap((e) => (e.fotos || []).map((f, i) => ({ foto: f, pie: i === 0 ? e.texto : '' })));
    await paginasFotos(fotosDia, etiqueta);
    await paginasFotos(cont.capturas.map((x) => ({ foto: x.foto, pie: '✧ ' + limpio(tx((buscarSello(x.id) || {}).nombre)) })), etiqueta);
    onProgreso(++hecho / (claves.length + 2));
  }

  // la orla
  const gente = [...estado.prog.gente].sort((a, b) => a.ts - b.ts);
  for (let i = 0; i < gente.length; i += 12) {
    const { c, ctx } = pagina(F);
    ctx.textAlign = 'center';
    ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
    espaciado(ctx, 'GENTE DEL CAMINO', cx, 170, 8);
    const grupo = gente.slice(i, i + 12);
    for (let j = 0; j < grupo.length; j++) {
      const g = grupo[j];
      const x = 240 + (j % 3) * 380, y = 360 + Math.floor(j / 3) * 360, r = 120;
      const img = g.fotos && g.fotos[0] ? await bitmap(g.fotos[0]) : null;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#151513'; ctx.fill();
      if (img) { ctx.clip(); cubrir(ctx, img, x - r, y - r, r * 2, r * 2); img.close && img.close(); }
      ctx.restore();
      ctx.fillStyle = T; ctx.font = '300 30px Jost';
      ctx.fillText(g.nombre || '—', x, y + r + 50);
      ctx.fillStyle = M; ctx.font = '400 18px "Courier Prime"';
      ctx.fillText(`DÍA ${numeroDia(claveDia(g.ts))}`, x, y + r + 82);
    }
    pags.push(c);
  }

  // logros conseguidos
  const ganados = logros().filter((l) => estado.prog.logros[l.id]);
  if (ganados.length) {
    const { c, ctx } = pagina(F);
    ctx.textAlign = 'center';
    ctx.fillStyle = M; ctx.font = '400 22px "Courier Prime"';
    espaciado(ctx, 'LOGROS', cx, 170, 8);
    ganados.forEach((l, j) => {
      const x = 240 + (j % 3) * 380, y = 360 + Math.floor(j / 3) * 300;
      ctx.strokeStyle = '#c9a45c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c9a45c'; ctx.font = '300 60px Jost'; ctx.textBaseline = 'middle';
      ctx.fillText(l.simbolo, x, y + 4);
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = T; ctx.font = '300 28px Jost';
      ctx.fillText(limpio(tx(l.nombre)), x, y + 115);
    });
    pags.push(c);
  }
  onProgreso((claves.length + 1) / (claves.length + 2));

  // cierre
  {
    const { c, ctx } = pagina(F);
    ctx.textAlign = 'center';
    dibujarInsignia(ctx, cx, 700, 200, { nombre: tx(R.insignia?.nombre) || R.subtitulo, codigo: R.titulo, ganada: !!estado.prog.completada });
    ctx.fillStyle = M; ctx.font = '300 30px Jost';
    parrafo(ctx, tx(R.epilogo), cx, 1050, 900, 44);
    ctx.font = '400 20px "Courier Prime"';
    ctx.fillText('WALK2LIFE · ' + limpio(R.certificado?.firma).toUpperCase(), cx, A4.h - 120);
    pags.push(c);
  }
  return pdfDeCanvases(pags);
}

// ---------- Videoresumen MP4 (vertical 1080×1920, para redes) ----------
// Primera configuración H.264 que acepte este móvil: 1080p en High/Main/Baseline y, si no, 720p.
const CANDIDATOS = [
  { w: 1080, h: 1920, codec: 'avc1.640028' },
  { w: 1080, h: 1920, codec: 'avc1.4d0028' },
  { w: 1080, h: 1920, codec: 'avc1.420028' },
  { w: 720, h: 1280, codec: 'avc1.64001f' },
  { w: 720, h: 1280, codec: 'avc1.4d001f' },
  { w: 720, h: 1280, codec: 'avc1.42001f' },
  // último recurso (navegadores sin H.264): VP9 dentro de MP4. Android lo reproduce; iPhone no siempre.
  { w: 1080, h: 1920, codec: 'vp09.00.40.08', mb: 'vp9' },
];

async function configVideo() {
  if (!window.VideoEncoder) return null;
  for (const c of CANDIDATOS) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec: c.codec, width: c.w, height: c.h, bitrate: 4e6, framerate: 30 });
      if (r.supported) return c;
    } catch {}
  }
  return null;
}

export async function puedeVideo() {
  return !!(await configVideo());
}

export async function videoresumen(onProgreso = () => {}) {
  await fuentesListas();
  const mb = await import('../vendor/mediabunny.mjs');
  const R = estado.ruta;
  const cfg = await configVideo();
  if (!cfg) throw new Error('Sin codificador de vídeo');
  const { w: W, h: H, codec: fullCodecString, mb: codecMb = 'avc' } = cfg;
  const k = W / 1080;
  const FPS = 30;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const T = '#f2efe9', M = 'rgba(242,239,233,.55)';

  // Guion: lista de planos { dur, dibujar(t) } con t de 0 a 1.
  const planos = [];
  const f = fechas();
  planos.push({
    dur: 3.2, dibujar: (t) => {
      ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = T; ctx.textAlign = 'center';
      ctx.font = `200 ${110 * k}px Jost`;
      espaciado(ctx, limpio(R.titulo).toUpperCase(), W / 2, H * 0.42, 40 * k);
      ctx.font = `200 ${46 * k}px Jost`;
      espaciado(ctx, limpio(tx(R.subtitulo)).toUpperCase(), W / 2, H * 0.42 + 90 * k, 16 * k);
      ctx.fillStyle = M; ctx.font = `400 ${30 * k}px "Courier Prime"`;
      ctx.fillText(estado.perfil.nombre || '', W / 2, H * 0.62);
      ctx.fillText(`${f.ini} — ${f.fin}`, W / 2, H * 0.62 + 50 * k);
    },
  });

  const planoFoto = (img, i, arriba, titulo, pie) => ({
    dur: 3.2, liberar: img, dibujar: (t) => {
      ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
      const z = 1.04 + 0.08 * t, dx = (i % 2 ? -1 : 1) * 30 * k * t;
      ctx.save(); ctx.translate(W / 2 + dx, H / 2); ctx.scale(z, z); cubrir(ctx, img, -W / 2, -H / 2, W, H); ctx.restore();
      const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
      g.addColorStop(0, 'rgba(7,7,7,0)'); g.addColorStop(1, 'rgba(7,7,7,.85)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
      ctx.textAlign = 'left';
      ctx.fillStyle = M; ctx.font = `400 ${26 * k}px "Courier Prime"`;
      ctx.fillText(arriba, 80 * k, H - 330 * k);
      ctx.fillStyle = T; ctx.font = `300 ${50 * k}px Jost`;
      const hN = titulo ? parrafo(ctx, titulo, 80 * k, H - 260 * k, W - 160 * k, 60 * k) : 0;
      if (pie) { ctx.font = `400 ${32 * k}px "Courier Prime"`; parrafo(ctx, pie, 80 * k, H - 250 * k + hN + 10 * k, W - 160 * k, 44 * k); }
    },
  });

  for (const clave of clavesViaje()) {
    const cont = contenidoDia(clave);
    const d = estado.prog.dias[clave] || {};
    const km = kmDia(d);
    const nDia = numeroDia(clave);
    const etiqueta = `DÍA ${nDia} · ${fechaCorta(new Date(clave + 'T12:00'))}`;
    planos.push({
      dur: 2, dibujar: () => {
        ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.fillStyle = M; ctx.font = `400 ${28 * k}px "Courier Prime"`;
        ctx.fillText(fechaLarga(clave).toUpperCase(), W / 2, H * 0.4);
        ctx.fillStyle = T; ctx.font = `200 ${120 * k}px Jost`;
        espaciado(ctx, `DÍA ${nDia}`, W / 2, H * 0.4 + 150 * k, 36 * k);
        if (km != null) { ctx.fillStyle = M; ctx.font = `300 ${40 * k}px Jost`; ctx.fillText(`${km.toFixed(1).replace('.', ',')} km`, W / 2, H * 0.4 + 240 * k); }
      },
    });
    for (const s of cont.sellos) {
      const p = estado.prog.sellos[s.id];
      const fotos = await fotosDe(s);
      const tomas = fotos.length ? fotos : [null];
      tomas.forEach((img, i) => {
        planos.push({
          dur: img ? 3.4 : 2.6, liberar: img, dibujar: (t) => {
            ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
            if (img) {
              // movimiento lento de cámara (Ken Burns)
              const z = 1.04 + 0.08 * t;
              const dx = (i % 2 ? -1 : 1) * 30 * k * t;
              ctx.save();
              ctx.translate(W / 2 + dx, H / 2);
              ctx.scale(z, z);
              cubrir(ctx, img, -W / 2, -H / 2, W, H);
              ctx.restore();
              const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
              g.addColorStop(0, 'rgba(7,7,7,0)'); g.addColorStop(1, 'rgba(7,7,7,.85)');
              ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
            }
            if (i === 0) {
              // el sello "cae" sobre la imagen
              const a = Math.min(1, Math.max(0, (t - 0.15) / 0.12));
              const esc = 1 + (1 - a) * 0.6;
              ctx.save();
              ctx.globalAlpha = a;
              ctx.translate(W - 200 * k, img ? H - 520 * k : H * 0.4);
              ctx.scale(esc, esc);
              dibujarSello(ctx, 0, 0, (img ? 120 : 220) * k, { id: s.id, nombre: tx(s.nombre), etapa: s.etapa, fecha: fechaCorta(p.ts), color: img ? '#e8c3b5' : undefined });
              ctx.restore();
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = M; ctx.font = `400 ${26 * k}px "Courier Prime"`;
            ctx.fillText(`${etiqueta} · ETAPA ${s.etapa}`, 80 * k, H - 330 * k);
            ctx.fillStyle = T; ctx.font = `300 ${50 * k}px Jost`;
            const hN = parrafo(ctx, limpio(tx(s.nombre)), 80 * k, H - 260 * k, W - 160 * k, 60 * k);
            if (limpio(p.frase) && i === 0) {
              ctx.font = `400 ${32 * k}px "Courier Prime"`;
              parrafo(ctx, `“${limpio(p.frase)}”`, 80 * k, H - 250 * k + hN + 10 * k, W - 160 * k, 44 * k);
            }
          },
        });
      });
    }
    // hasta 3 fotos del diario por día, y las figuras capturadas
    const fotosDia = cont.entradas.filter((e) => e.tipo === 'foto').flatMap((e) => (e.fotos || []).map((f) => ({ f, pie: e.texto }))).slice(0, 3);
    for (const [i, x] of fotosDia.entries()) {
      const img = await bitmap(x.f);
      if (img) planos.push(planoFoto(img, i, etiqueta, '', limpio(x.pie)));
    }
    for (const [i, x] of cont.capturas.entries()) {
      const img = await bitmap(x.foto);
      if (img) planos.push(planoFoto(img, i + 1, '✧ FIGURA', limpio(tx((buscarSello(x.id) || {}).nombre)), ''));
    }
  }

  // "Con…": la gente del camino
  const gente = [...estado.prog.gente].sort((a, b) => a.ts - b.ts).slice(0, 12);
  if (gente.length) {
    planos.push({
      dur: 1.6, dibujar: () => {
        ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center'; ctx.fillStyle = T; ctx.font = `200 ${70 * k}px Jost`;
        espaciado(ctx, 'CON', W / 2, H * 0.5, 30 * k);
      },
    });
    for (const g of gente) {
      const img = g.fotos && g.fotos[0] ? await bitmap(g.fotos[0]) : null;
      planos.push({
        dur: 1.5, liberar: img, dibujar: (t) => {
          ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
          const r = 300 * k, y = H * 0.42;
          ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y, r, 0, Math.PI * 2); ctx.closePath();
          ctx.fillStyle = '#151513'; ctx.fill();
          if (img) { ctx.clip(); const z = 1 + 0.05 * t; cubrir(ctx, img, W / 2 - r * z, y - r * z, r * 2 * z, r * 2 * z); }
          ctx.restore();
          ctx.textAlign = 'center'; ctx.fillStyle = T; ctx.font = `300 ${60 * k}px Jost`;
          ctx.fillText(g.nombre || '—', W / 2, y + r + 110 * k);
        },
      });
    }
  }

  planos.push({
    dur: 4, dibujar: (t) => {
      ctx.fillStyle = '#070707'; ctx.fillRect(0, 0, W, H);
      dibujarInsignia(ctx, W / 2, H * 0.42, 260 * k, { nombre: tx(R.insignia?.nombre) || R.subtitulo, codigo: R.titulo, ganada: !!estado.prog.completada });
      ctx.textAlign = 'center';
      ctx.fillStyle = T; ctx.font = `300 ${48 * k}px Jost`;
      ctx.fillText(estado.perfil.nombre || '', W / 2, H * 0.66);
      ctx.fillStyle = M; ctx.font = `400 ${26 * k}px "Courier Prime"`;
      ctx.fillText('WALK2LIFE · ' + limpio(R.certificado?.firma).toUpperCase(), W / 2, H - 140 * k);
    },
  });

  const duracion = planos.reduce((a, p) => a + p.dur, 0);
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
  const fuente = new mb.CanvasSource(c, { codec: codecMb, fullCodecString, bitrate: Math.round(4.5e6 * k * k), keyFrameInterval: 2 });
  output.addVideoTrack(fuente, { frameRate: FPS });

  // Música: se copia tal cual (AAC ya codificado), sin recodificar. Así funciona también en iPhone sin codificador de audio.
  let paquetesAudio = null;
  if (R.musica) {
    try {
      const url = await medio(R.musica);
      const blob = await (await fetch(url)).blob();
      const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
      const pista = await input.getPrimaryAudioTrack();
      if (pista && pista.codec) {
        const src = new mb.EncodedAudioPacketSource(pista.codec);
        output.addAudioTrack(src);
        paquetesAudio = { src, pista };
      }
    } catch (e) {
      console.warn('Música no disponible', e);
    }
  }

  await output.start();
  let tiempo = 0, frames = 0;
  const totalFrames = Math.ceil(duracion * FPS);
  const FUNDIDO = 0.35;
  for (const p of planos) {
    const n = Math.round(p.dur * FPS);
    for (let i = 0; i < n; i++) {
      const tt = i / n;
      p.dibujar(tt);
      // fundido a negro al entrar y salir de cada plano
      const s = i / FPS, resta = (n - i) / FPS;
      const a = Math.max(0, 1 - Math.min(s, resta) / FUNDIDO);
      if (a > 0) { ctx.fillStyle = `rgba(7,7,7,${a})`; ctx.fillRect(0, 0, W, H); }
      await fuente.add(tiempo, 1 / FPS);
      tiempo += 1 / FPS;
      if (++frames % 10 === 0) { onProgreso(frames / totalFrames); await new Promise((r) => setTimeout(r)); }
    }
    if (p.liberar && p.liberar.close) p.liberar.close();
  }
  fuente.close();

  if (paquetesAudio) {
    const { src, pista } = paquetesAudio;
    const sink = new mb.EncodedPacketSink(pista);
    const decoderConfig = await pista.getDecoderConfig();
    let primero = true;
    for await (const paquete of sink.packets()) {
      if (paquete.timestamp >= tiempo) break;
      await src.add(paquete, primero ? { decoderConfig } : undefined);
      primero = false;
    }
    src.close();
  }

  await output.finalize();
  onProgreso(1);
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}
