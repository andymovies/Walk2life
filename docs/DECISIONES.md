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

## Ampliación (octubre 2026): credencial + diario + red social offline

Andy lo define como «una mezcla entre una credencial, un diario y una red social offline». Decidido y programado:

| Tema | Decisión |
|---|---|
| Navegación | Pestañas abajo: **Hoy · Ruta · ＋ · Gente · Recuerdos**. Hoy es la pantalla principal y debe sentirse como un juego. La interfaz definitiva será más intuitiva; esto es el armazón. |
| Dos ejes | **Ruta** (etapas y lugares de Andy, fija) y **viaje** (días del caminante, variable). Todo lo que crea el caminante se coloca solo en su día (por fecha) y en el lugar más cercano (por GPS o último sello). |
| Hoy | Día N, km de hoy, sellos y logros. **Objetivo del día** (un lugar de la ruta) con anillo de progreso: por km si hay trazado GPX, si no por sellos. Siguiente sello, mensajes por abrir, línea de tiempo del día. |
| Días | Se abren solos con la primera actividad. «Cerrar el día»: diario antes de dormir, dónde terminas y km (estimados sobre el trazado o a mano). Si un día queda abierto, Hoy pregunta «¿Cerramos el día de ayer?». Sin notificaciones (una web no puede sin servidor). |
| Km | GPS solo con la app abierta (web). Km = posición proyectada sobre el **trazado GPX** de la ruta. **Pendiente: GPX grabado por Andy** (`ruta.track` → `rutas/gr55/track.json`, lista `[[lat, lon], …]`). Sin trazado, km a mano. Andy también puede poner `km` (punto kilométrico) en cada lugar. |
| Gente (orla) | Fichas simples: fotos (cámara o galería), nombre y texto libre de 4–5 líneas (incluido contacto). Aviso «pide permiso antes de la foto». Página de orla en el fotobook y «Con…» en el vídeo. |
| Logros | 14 logros (algunos secretos) calculados con lo que ya hace el caminante. Andy puede renombrarlos en `ruta.json → logros`. |
| Figuras «holograma» | Nivel A: la figura del lugar aparece sobre la foto del caminante; se arrastra y se escala. Solo se captura estando allí (GPS, si el lugar tiene coordenadas). Figura provisional generada; Andy pondrá las suyas (`sello.figura`, PNG transparente). Álbum de figuras en Recuerdos. Niveles B (cámara en vivo) y C (AR real, nativa) para más adelante. |
| Mensajes secretos | Para alguien concreto, **sin servidor**: el mensaje va dentro del enlace (`#m=…`, comprimido). Se comparte por WhatsApp/correo; al abrirlo se añade una parada a la ruta del amigo y el sobre solo se abre al llegar (GPS; sin GPS, por confianza). En iPhone el enlace abre Safari (almacén distinto de la app instalada): botón «Copiar» y en la app ＋ → «Pegar mensaje recibido». Con la app nativa (Capacitor + enlaces universales) se abrirá directo. |
| Mensajes para cualquiera | Requiere servidor y moderación. Alternativa gratis aparcada: «muro del camino» moderado por Andy (le llegan por correo y los publica en la ruta). |
| Flexibilidad | **Nada obliga a hacerlo en el momento.** Se puede sellar después («Estuve aquí otro día», con fecha y hora) y cambiar la fecha de un sello; añadir fotos, notas, voz y personas a cualquier día y lugar (la foto que te mandan por WhatsApp días después va a su día); editar, mover o borrar cualquier entrada; añadir días pasados y escribir su diario; capturar la figura desde la galería en cualquier momento (con cámara, solo estando allí). El objetivo del día es opcional. |
| Credencial en papel | Opcional: al terminar se pueden subir fotos de la credencial de papel; entran en el fotobook y en el vídeo. |
| Entregables | Fotobook y vídeo **ordenados por días**: página de día (diario, notas, gente), sellos, fotos del diario, figuras, orla y logros. |
| App nativa | Capacitor (gratis) envuelve esta misma web. Costes: Apple 99 $/año, Google Play 25 $ una vez, APK gratis; para iPhone hace falta compilar en un Mac (o servicio en la nube). Resuelve: GPS en segundo plano, avisos, enlaces directos, AR real. |
| Ideas futuras | QR para intercambiar fichas entre caminantes sin internet; muro del camino; figuras en cámara en vivo; juego por equipos. |
| Historias (propuesto, pendiente de respuesta) | Modos infantil / adultos humor / adultos histórico, elegibles en Ajustes. Dos capas: episodio diario autoconclusivo repartido en el 0/30/70/100 % del objetivo del día (lo que no se alcanza pasa al día siguiente) e hilo largo anclado al % de la ruta con pistas (misterio tipo Cluedo). Retos con foto tipo geocaching. «Lo que dejaste atrás» para escuchar después. Cuenta atrás en km para niños. En nativa, el audio salta solo al llegar. Pendiente: con qué modo empezar. |

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
- [ ] GPX del GR 55 grabado por Andy (activa km y % por distancia).
- [ ] Figuras definitivas por lugar (PNG transparente).
- [ ] Mapa topográfico sin conexión (ahora hay un esquema con los puntos cuando tienen coordenadas).
- [ ] Traducciones fr/it de la interfaz.
- [ ] Contenido real de Andy.
