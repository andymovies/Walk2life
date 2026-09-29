# Walk2life · decisiones

Documento vivo. Recoge lo decidido con Andy para que cualquier sesión (ordenador o móvil) retome el trabajo.

## La idea

Nombre: **Walk2life**. Repositorio: github.com/andymovies/walk2life. Publicación gratuita con GitHub Pages (repositorio público).


Una credencial digital para rutas de senderismo, como la del Camino de Santiago, pero para rutas que no la tienen. No es una guía turística: es la mirada personal de Andy (textos, fotos, canciones, entrevistas a paisanos) desbloqueándose sello a sello. Lo que más se llevan los caminantes son las experiencias con las personas; la app lo recoge sin exigir mirar el móvil todo el rato.

Primera ruta (MVP): **GR 55 · Ruta do Medievo**, de Betanzos a Santo André de Teixido. Andy la hará a su ritmo, parando mucho; es posible que la haga de ida y vuelta (base y coche en casa de un amigo). Fuente de los datos generales: turismo.cedeira.gal y voltamontana.com (5 etapas de unos 20 km, unos 95 km, diez concellos). **Las cifras exactas y los nombres de etapa se confirman sobre el terreno.**

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Formato | App web instalable (PWA): HTML estático, sin servidor, sin build. Más adelante APK y tiendas con el mismo código (Capacitor). |
| APK | Andy quiere una APK sin tienda para el MVP. Solo sirve en Android: en iPhone no se puede instalar nada fuera de la App Store, así que la web instalable es imprescindible. Pendiente: empaquetar con Capacitor (requiere Android SDK). |
| Datos personales | Ninguno. Todo se queda en el móvil del caminante (IndexedDB). Sin cuentas, sin servidor, sin analítica. Si alguien comparte en su Instagram, lo hace él. |
| Sellos | Por confianza: «¿Has llegado a X?» → «Sí» → «Te has ganado tu sello». **Sin QR** (nadie puede mantenerlos años). GPS solo como ayuda con la app abierta. |
| Aviso al acercarse | No es posible en la versión web (ni iPhone ni Android permiten GPS en segundo plano a una web; iPhone tampoco vibra). Llegará con la app nativa. |
| Recuerdo en cada sello | Opcional: hasta 3 fotos (copia ligera; las originales siguen en la galería), una frase, una nota de voz. |
| Preguntas | Al empezar la etapa (2) y al terminarla (5). Las escribe Andy por etapa; las actuales son provisionales. |
| Gamificación | Una insignia por ruta. Una pantalla por etapa. Cuenta atrás hasta la salida, contador de sellos que faltan, sellos ocultos con enigma, sorpresas que se abren al sellar, al cerrar etapa y al completar la ruta, y carta al yo futuro que se abre a los 365 días. |
| Narrativa | La escribe Andy: prólogo, apertura y cierre de cada etapa, texto en cada lugar, sorpresas, epílogo. |
| Entregables | Certificado (PDF), fotobook (PDF) y videoresumen (MP4 vertical 1080×1920), generados en el propio móvil. |
| Vídeo en iPhone | H.264 con el codificador del sistema (WebCodecs, iOS 16.4+). La música se copia ya codificada en AAC (.m4a) sin recodificar, así funciona aunque Safari no tenga codificador de audio. Probado en navegador: pista AAC copiada correctamente. **Falta probar en un iPhone real.** |
| Vídeos de Andy | Online (YouTube/Vimeo), en es/en/fr/it. No se descargan. |
| Peso | App ~1 MB. Contenido de Andy descargable por etapa (~6–10 MB) o completo (~40–50 MB). Fotos del caminante: ~300 KB cada una. Botón «Liberar espacio». |
| Idiomas | Interfaz en es y en (fr, it caen a inglés hasta traducirlos). Contenido: cualquier texto admite `{ "es": "...", "en": "..." }`. |
| Estética | La de andresnavarra.com: negro cinematográfico, Jost fina con tracking, Courier Prime. Sellos en tinta roja, insignia en oro. |
| Marketing | Aparcado. Idea futura: patrocinio de concellos/Deputación/Turismo de Galicia; botón de donativo. |

## Cómo mete Andy su contenido

1. **Modo autor** en la propia app: siete toques seguidos en «Walk2life» (arriba a la izquierda) o abrir la app con `?autor`.
2. «⌖ Nuevo lugar aquí» guarda las coordenadas GPS del sitio donde está. Se añaden textos, fotos, audios (grabados o subidos), enlaces de vídeo, sorpresas y preguntas.
3. Todo se guarda como borrador en su móvil y ya se ve en la app.
4. «Exportar contenido (.zip)» → se lo pasa a Claude en una sesión (o un enlace de Drive/Dropbox si pesa mucho). Claude lo integra en `rutas/gr55/` y lo publica.

## Pendiente

- [x] Repositorio propio: andymovies/walk2life (público).
- [x] Publicada en GitHub Pages: https://andymovies.github.io/Walk2life/
- [ ] Probar vídeo MP4 y notas de voz en iPhone real y en Android real.
- [ ] APK con Capacitor.
- [ ] Mapa topográfico sin conexión (ahora hay un esquema con los puntos cuando tienen coordenadas).
- [ ] Traducciones fr/it de la interfaz.
- [ ] Contenido real de Andy.
