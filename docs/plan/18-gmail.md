# 18 · Códigos y enlaces de preventa desde el Gmail del propietario

Petición del propietario (2026-11-09): leer sus correos de preventa y poner en la ficha el enlace y el
código que le llegan, en dos cuentas de Gmail suyas. Cada correo es distinto, así que lo lee una IA.

## Cómo funciona

1. En **cada** cuenta de Gmail del propietario se instala `tools/gmail/gira-gmail.gs` (Google Apps
   Script, se ejecuta en su propia cuenta, solo lectura). Cada 5 min busca correos nuevos de preventa
   (últimos 2 días) y manda los nuevos al Worker (`POST /inbox`, clave propia que da `/gmail` en
   Discord, solo a administradores y en mensaje efímero). Los correos ya enviados o duplicados no se
   repiten (lista de ids en las propiedades del script).
2. El Worker filtra (habla de preventa, no es pedido/recibo, nombra a un artista con ficha o registro)
   y la **IA** (Groq → Gemini → Workers AI) dice qué preventa es, de qué artista, y **un** código y **un**
   enlace. Se comprueba contra el correo: el código tiene que estar literal, el enlace tiene que ser uno
   de los del correo (nunca bajas, preferencias, redes ni pases de cola `queueittoken`) y el artista
   tiene que salir en el correo. Sin IA, reglas fijas.
3. Se guarda **uno por artista y tipo de preventa** (`presale_access`): si llegan dos códigos o dos
   enlaces (dos cuentas, correo duplicado, recordatorio), se queda el primero; solo se completa lo que
   faltaba. Lo de hace más de 45 días se sustituye. Los correos no se guardan.
4. La ficha muestra en el bloque de esa preventa `🔐 Tu acceso (de tu correo): [AQUÍ] · código`.
   Si aún no ha llegado, la preventa con enlace único lleva el enlace general de cada fecha.
5. Aviso push a la app al llegar un acceso nuevo (sin el código).

## Privacidad

- El repo y los registros de GitHub Actions son públicos: la vista previa de fichas (`/enrich/preview`)
  oculta las líneas 🔐. Nada del correo se escribe en registros.
- El servidor de Discord es privado: las fichas con 🔐 solo las ve el propietario.
