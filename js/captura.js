// Capturas "holograma": al llegar a un lugar, la figura de ese sitio aparece sobre la foto del caminante.
// Nivel A del plan: figura 2D colocada sobre la foto (funciona en iPhone y Android, sin conexión).
// Andy puede poner su propia figura por lugar en ruta.json → sello.figura = "figuras/x.png" (PNG con transparencia).
import { h, hoja, toast } from './ui.js';
import { t, tx } from './i18n.js';
import { estado, guardarProgreso, buscarSello, medio } from './core.js';
import { blobs } from './db.js';
import { elegirFotos, distancia, formatoDist } from './media.js';
import { pintar } from './piezas.js';
import { posicionRapida, registrarActividad } from './viaje.js';
import { comprobarLogros } from './logros.js';

const CIAN = '#7fe3e8';

// Figura provisional: un emblema luminoso distinto para cada lugar.
export function figuraProvisional(id, tam = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const x = c.getContext('2d');
  let semilla = 0;
  for (const ch of String(id)) semilla = (semilla * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const r = tam * 0.36, cx = tam / 2, cy = tam / 2;
  x.translate(cx, cy);
  x.shadowColor = CIAN;
  x.shadowBlur = tam * 0.04;
  x.strokeStyle = CIAN;
  x.lineWidth = tam * 0.008;
  // anillos
  for (let i = 0; i < 3; i++) { x.globalAlpha = 0.9 - i * 0.25; x.beginPath(); x.arc(0, 0, r * (1 - i * 0.18), 0, Math.PI * 2); x.stroke(); }
  // estrella de n puntas con giro propio
  const n = 5 + Math.floor(rnd() * 4), giro = rnd() * Math.PI;
  x.globalAlpha = 1;
  x.lineWidth = tam * 0.012;
  x.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = giro + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.28 : r * 0.62;
    i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  x.stroke();
  x.fillStyle = 'rgba(127,227,232,.18)';
  x.fill();
  // rayas de holograma
  x.shadowBlur = 0;
  x.globalAlpha = 0.12;
  x.fillStyle = CIAN;
  for (let y = -r; y < r; y += tam * 0.018) x.fillRect(-r, y, r * 2, tam * 0.004);
  return c;
}

async function figuraDe(s) {
  if (s.figura) {
    try {
      const b = await (await fetch(await medio(s.figura))).blob();
      return await createImageBitmap(b);
    } catch {}
  }
  return figuraProvisional(s.id);
}

// Comprueba que el caminante está en el lugar (si el lugar tiene coordenadas y hay GPS).
async function estaAqui(s) {
  if (s.lat == null) return { ok: true };
  const pos = await posicionRapida(10000);
  if (!pos) return { ok: true, sinGps: true };
  const d = distancia(pos, s);
  return { ok: d <= Math.max(150, (s.radio || 60) * 2), d, pos };
}

export async function capturar(selloId) {
  const s = buscarSello(selloId);
  if (!s) return;
  const aqui = await estaAqui(s);
  if (!aqui.ok) { toast(t('acercate', { d: formatoDist(aqui.d) }), 4000); return; }
  const files = await new Promise((ok) => {
    const i = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    i.onchange = () => ok([...(i.files || [])]);
    i.click();
  });
  if (!files.length) return;
  await editor(s, files[0], aqui.pos);
}

// Desde la galería se puede capturar en cualquier momento (con una foto hecha allí): sin prisas ni obligaciones.
export async function capturarDesdeGaleria(selloId) {
  const s = buscarSello(selloId);
  const files = await elegirFotos(false);
  if (files.length) await editor(s, files[0], null);
}

async function editor(s, file, pos) {
  const foto = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const fig = await figuraDe(s);
  const k = Math.min(1, 1440 / Math.max(foto.width, foto.height));
  const W = Math.round(foto.width * k), H = Math.round(foto.height * k);
  const c = h('canvas.editor-captura', { width: W, height: H });
  const ctx = c.getContext('2d');
  const f = { x: W / 2, y: H * 0.45, s: Math.min(W, H) * 0.5 };
  let t0 = 0, animando = true;

  const dibujar = (brillo = 1) => {
    ctx.drawImage(foto, 0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.92 * brillo;
    ctx.shadowColor = CIAN;
    ctx.shadowBlur = f.s * 0.08;
    ctx.drawImage(fig, f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
    ctx.restore();
  };
  const latido = (ts) => {
    if (!animando) return;
    t0 ||= ts;
    dibujar(0.85 + 0.15 * Math.sin((ts - t0) / 400));
    requestAnimationFrame(latido);
  };
  requestAnimationFrame(latido);

  // arrastrar la figura con el dedo
  let arrastre = null;
  const aCanvas = (ev) => {
    const r = c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  };
  c.addEventListener('pointerdown', (ev) => { arrastre = aCanvas(ev); c.setPointerCapture(ev.pointerId); });
  c.addEventListener('pointermove', (ev) => {
    if (!arrastre) return;
    const p = aCanvas(ev);
    f.x += p.x - arrastre.x; f.y += p.y - arrastre.y;
    arrastre = p;
  });
  c.addEventListener('pointerup', () => (arrastre = null));
  const tam = h('input', { type: 'range', min: 15, max: 100, value: 50, oninput: (ev) => (f.s = Math.min(W, H) * ev.target.value / 100) });

  const cont = h('div.captura', {},
    h('span.mono', {}, '✧ ' + tx(s.nombre)),
    h('h2', {}, t('figuraEncontrada')),
    c,
    h('p.mut.peq', {}, t('muevela')),
    h('label', {}, h('span.mono', {}, t('tamano')), tam));
  const { cerrar } = hoja(cont, { clase: 'completa' });
  cont.append(h('div.botones', {},
    h('button.btn', {
      onclick: async () => {
        animando = false;
        dibujar(1);
        const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
        const prev = estado.prog.capturas[s.id];
        if (prev && prev.foto) await blobs.del(prev.foto);
        estado.prog.capturas[s.id] = { ts: Date.now(), foto: await blobs.guardar(blob, 'captura') };
        registrarActividad(pos || null, s);
        await guardarProgreso();
        cerrar();
        toast('✧ ' + t('figuraGuardada'));
        await comprobarLogros();
        pintar();
      },
    }, t('guardar')),
    h('button.btn.sec', { onclick: () => { animando = false; cerrar(); } }, t('cancelar'))));
}
