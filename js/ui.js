// Utilidades de interfaz mínimas, sin frameworks.

export function h(tag, attrs = {}, ...hijos) {
  const [nombre, ...clases] = tag.split('.');
  const el = document.createElement(nombre || 'div');
  if (clases.length) el.className = clases.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const x of hijos.flat(Infinity)) {
    if (x == null || x === false) continue;
    el.append(x instanceof Node ? x : document.createTextNode(String(x)));
  }
  return el;
}

export function toast(texto, ms = 2600) {
  const el = h('div.toast', {}, texto);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 500); }, ms);
}

// Hoja a pantalla completa que se cierra con cerrar().
export function hoja(contenido, { clase = '' } = {}) {
  const el = h('div.hoja' + (clase ? '.' + clase : ''), {}, h('div.hoja-in', {}, contenido));
  document.body.append(el);
  document.body.classList.add('bloq');
  requestAnimationFrame(() => el.classList.add('on'));
  const cerrar = () => {
    el.classList.remove('on');
    setTimeout(() => {
      el.remove();
      if (!document.querySelector('.hoja')) document.body.classList.remove('bloq');
    }, 450);
  };
  return { el, cerrar };
}

export function confirmar(texto, si, no) {
  return new Promise((ok) => {
    const { cerrar } = hoja([
      h('p.lead', {}, texto),
      h('div.botones', {},
        h('button.btn', { onclick: () => { cerrar(); ok(true); } }, si),
        h('button.btn.sec', { onclick: () => { cerrar(); ok(false); } }, no)),
    ], { clase: 'centrada' });
  });
}

// Arrastrar y soltar no hace falta: todo son listas cortas. Solo un pequeño helper para textos con [huecos].
export function textoAutor(s, clase = 'texto') {
  const el = h('div.' + clase);
  String(s || '').split(/\n{2,}/).forEach((p) => {
    const par = h('p');
    // los [huecos] se marcan para que Andy los vea claramente
    p.split(/(\[[^\]]+\])/).forEach((trozo) => {
      par.append(/^\[.*\]$/.test(trozo) ? h('span.hueco', {}, trozo) : document.createTextNode(trozo));
    });
    el.append(par);
  });
  return el;
}
