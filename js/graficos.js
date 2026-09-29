// Sellos e insignias dibujados en canvas: el mismo dibujo sirve para la pantalla, el PDF y el vídeo.

export const TINTA = '#b8432f';
export const ORO = '#c9a45c';

export async function fuentesListas() {
  try {
    await Promise.all([
      document.fonts.load('200 40px Jost'),
      document.fonts.load('300 40px Jost'),
      document.fonts.load('400 40px Jost'),
      document.fonts.load('40px "Courier Prime"'),
    ]);
  } catch {}
}

// Giro pseudoaleatorio pero estable para cada sello (como un sello de tinta de verdad).
function giro(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((h % 17) - 8) * Math.PI / 180;
}

function textoCircular(ctx, texto, cx, cy, r, tam, fuente, espaciado = 0.12) {
  ctx.save();
  ctx.font = `${fuente.replace('{t}', tam)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...texto];
  const anchos = chars.map((c) => ctx.measureText(c).width + tam * espaciado);
  const total = anchos.reduce((a, b) => a + b, 0);
  let ang = -Math.PI / 2 - total / r / 2;
  chars.forEach((c, i) => {
    const a = ang + anchos[i] / 2 / r;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    ang += anchos[i] / r;
  });
  ctx.restore();
}

function limpiar(s) {
  return String(s || '').replace(/[\[\]]/g, '').toUpperCase();
}

// Sello de tinta: doble círculo, nombre del lugar alrededor, etapa y fecha en el centro.
export function dibujarSello(ctx, cx, cy, r, { id, nombre, etapa, fecha, color = TINTA, alpha = 0.88 }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(giro(id));
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
  let nom = limpiar(nombre);
  if (nom.length > 26) nom = nom.slice(0, 25) + '…';
  const tam = Math.max(7, r * (nom.length > 18 ? 0.13 : 0.16));
  textoCircular(ctx, nom, 0, 0, r * 0.85, tam, '400 {t}px "Courier Prime"', 0.05);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `300 ${r * 0.34}px Jost`;
  ctx.fillText(etapa != null ? String(etapa) : '✦', 0, -r * 0.1);
  if (fecha) {
    ctx.font = `400 ${r * 0.13}px "Courier Prime"`;
    ctx.fillText(fecha, 0, r * 0.3);
  }
  ctx.restore();
}

// Insignia de la ruta: medalla con el nombre alrededor y el código en el centro.
export function dibujarInsignia(ctx, cx, cy, r, { nombre, codigo, ganada }) {
  const color = ganada ? ORO : 'rgba(255,255,255,.22)';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.02;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.008;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.stroke();
  // rayos finos entre los anillos
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r1 = r * 0.5, r2 = r * (i % 6 === 0 ? 0.64 : 0.58);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  textoCircular(ctx, `${limpiar(nombre)} · ${limpiar(codigo)} ·`, 0, 0, r * 0.8, r * 0.1, '300 {t}px Jost', 0.35);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `200 ${r * 0.26}px Jost`;
  ctx.fillText(limpiar(codigo), 0, 0);
  ctx.restore();
}

// Canvas nítido para pantalla.
export function lienzo(tamCss) {
  const c = document.createElement('canvas');
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(tamCss * dpr);
  c.style.width = c.style.height = tamCss + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return { c, ctx };
}

export const fechaCorta = (ts) => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

// Texto en varias líneas dentro de un ancho. Devuelve la altura usada.
export function parrafo(ctx, texto, x, y, ancho, alto) {
  const palabras = String(texto || '').split(/\s+/);
  let linea = '', yy = y;
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      ctx.fillText(linea, x, yy);
      linea = p;
      yy += alto;
    } else linea = prueba;
  }
  if (linea) { ctx.fillText(linea, x, yy); yy += alto; }
  return yy - y;
}

export async function cargarImagen(url) {
  if (!url) return null;
  try {
    const r = await fetch(url);
    return await createImageBitmap(await r.blob(), { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
}

// Dibuja una imagen cubriendo un rectángulo (recorte centrado).
export function cubrir(ctx, img, x, y, w, h) {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k, sh = h / k;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
