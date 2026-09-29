// Fotos, notas de voz y ubicación.

// Copia ligera de una foto: lado largo máximo `max` px, JPEG. Las originales siguen en la galería.
export async function comprimirFoto(file, max = 1440, calidad = 0.82) {
  let img;
  try {
    img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = URL.createObjectURL(file);
    });
  }
  const w = img.width, h = img.height;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  if (img.close) img.close();
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', calidad));
}

export function elegirFotos(multiple = true) {
  return new Promise((ok) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = 'image/*';
    i.multiple = multiple;
    i.onchange = () => ok([...(i.files || [])]);
    i.click();
  });
}

export function elegirArchivo(accept) {
  return new Promise((ok) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => ok(i.files && i.files[0]);
    i.click();
  });
}

// Grabadora de voz. iPhone graba en mp4/aac, Android en webm/opus: los dos se reproducen en su propio móvil.
export async function grabadora() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const tipos = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  const mimeType = tipos.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined);
  const trozos = [];
  rec.ondataavailable = (e) => e.data.size && trozos.push(e.data);
  rec.start();
  return {
    parar: () => new Promise((ok) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        ok(new Blob(trozos, { type: rec.mimeType || 'audio/mp4' }));
      };
      rec.stop();
    }),
  };
}

// ---- ubicación ----
export function distancia(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const formatoDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

let vigia = null;
export function vigilarPosicion(fn) {
  pararPosicion();
  if (!navigator.geolocation) return false;
  vigia = navigator.geolocation.watchPosition(
    (p) => fn({ lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy }),
    () => fn(null),
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
  );
  return true;
}
export function pararPosicion() {
  if (vigia != null && navigator.geolocation) navigator.geolocation.clearWatch(vigia);
  vigia = null;
}

export function posicionActual() {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error('Sin GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), precision: p.coords.accuracy }),
      ko,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  });
}

// Guardar o compartir un archivo generado (certificado, fotobook, vídeo, copia).
export async function entregarArchivo(blob, nombre) {
  const file = new File([blob], nombre, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: nombre });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
