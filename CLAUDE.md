# Walk2life

App web instalable (PWA) de Andy Navarra, **Walk2life**: credencial de ruta con sellos, recuerdos, narrativa y entregables (certificado PDF, fotobook PDF, vídeo MP4). HTML/JS estático, sin build, sin servidor, sin datos personales.

**Lee `docs/DECISIONES.md` antes de cambiar nada**: ahí está todo lo decidido y lo pendiente.

## Flujo de trabajo (obligatorio)

`main` es la única versión válida. Andy trabaja desde ordenador y móvil y no usa git: nunca le pidas comandos; hazlo tú.

1. Al empezar: `git pull origin main`.
2. Al terminar cada cambio: commit con mensaje claro en español y push a `main`. Si la sesión trabaja en otra rama, fusiónala en `main` antes de terminar.
3. No dejes cambios sin subir.

## Estructura

- `index.html`, `app.css`, `sw.js` (sin conexión; **sube `VERSION` en `sw.js` al cambiar archivos de la app** y añade los nuevos a `ARCHIVOS`).
- `js/app.js` pantallas del caminante · `js/autor.js` modo autor · `js/entregables.js` PDF y MP4 · `js/graficos.js` sellos e insignia · `js/core.js` ruta y progreso · `js/db.js` IndexedDB · `js/media.js` fotos, voz, GPS · `js/i18n.js` textos de interfaz.
- `vendor/`: mediabunny (MP4) y fflate (zip), copiados de npm. `fonts/`: Jost y Courier Prime locales.
- `rutas/index.json` lista de rutas · `rutas/<id>/ruta.json` contenido · `rutas/<id>/media/` fotos y audios de Andy.

## Integrar contenido de Andy

Andy exporta un `.zip` desde el modo autor (`ruta.json` + `media/`). Para publicarlo: descomprimir en `rutas/<id>/`, revisar que las fotos pesen ~150–300 KB (1440 px, JPEG) y los audios estén comprimidos; la música del vídeo debe ser AAC en `.m4a` (convertir con ffmpeg si hace falta). Subir `VERSION` en `sw.js` no es necesario para contenido (ruta.json va por red primero).

## Estilo

- Negro cinematográfico, títulos finos con mucho tracking (Jost), detalles en Courier Prime, mucho aire.
- Tono sobrio. No inventar datos, citas ni fechas: dejar `[huecos]` (la app los resalta en ámbar).

## Probar

`python3 -m http.server` en la raíz y abrir en el navegador. En el modo autor, «Simular ruta completa» rellena un progreso de prueba para ver certificado, fotobook y vídeo. El Chromium de Playwright no trae H.264: allí el vídeo sale en VP9 (último recurso); en iPhone y Chrome Android sale en H.264.
