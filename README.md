# Figus Change Hub ⚽

Sitio para llevar tu álbum de figuritas **Usa Mex Can 26**, marcar lo que tenés,
lo que te falta y tus repetidas, y **intercambiar con otras personas**.

Funciona de dos maneras:

- **Solo el sitio** (sin servidor): todo se guarda en tu navegador (localStorage)
  y para intercambiar se usan enlaces o texto que van directo de persona a persona.
- **Con servidor + base de datos** (Docker): además se habilita un muro de
  **Comunidad** donde cada persona publica su lista y las demás la encuentran y
  comparan al instante. Ver [Con Docker](#2-con-docker-web--base-de-datos).

## Qué hace

- **Mi álbum**: todas las figuritas del álbum agrupadas por selección (con banderas)
  y las secciones especiales (🏆 🌎 📜 🥤).
  - Tocá una figurita para marcarla como *la tengo* ✓.
  - Tocá de nuevo para marcarla como *repetida* (y sumar cuántas: ×2, ×3…).
  - Mantené presionado (o clic derecho) para restar.
  - Filtros rápidos: **Todas / Me faltan / Repetidas / Las que tengo** y buscador
    por selección. Ideal para revisar el álbum y setear rápido lo que ya conseguiste.
  - Barra de progreso general y por sección.

- **Importar** tu lista sin marcar todo a mano:
  - Pegá **tu propio enlace** del hub o tu texto de **Me faltan / Repetidas**
    (el mismo formato que genera *Exportar*) y se carga en tu álbum.
  - Elegí **Combinar** (aplica sobre lo que ya tenías) o **Reemplazar todo**
    (reconstruye el álbum: lo listado como faltante queda faltante, lo de
    repetidas como repetida y el resto como *la tengo*).
  - **Vista previa** antes de aplicar: te muestra cuántas figuritas cambian.
  - También podés importar un **archivo** `.json` (respaldo) o `.txt` exportado.
  - Desde acá se **instala la app** en el teléfono (ver *Instalar como app*).

- **Exportar** tu lista de varias formas:
  - **Me faltan**, **Repetidas** o **ambas**, en el mismo formato de texto de las
    listas de WhatsApp.
  - **Copiar** al portapapeles, **Descargar .txt** o **Compartir** (usa el menú
    nativo del teléfono).
  - **Enlace para compartir**: genera un link que lleva adentro toda tu colección
    y tu contacto. Quien lo abra puede comparar y ver los cambios al instante.
  - **Respaldo**: bajá/restaurá tu álbum como archivo por si cambiás de teléfono.

- **Intercambiar**:
  - Cargás tu **nombre y un contacto** (opcional) para que te puedan avisar.
  - Pegás el **enlace o la lista** que te pasó otra persona y la app calcula
    automáticamente:
    - 📥 **Le pedís**: lo que a vos te falta y a la otra persona le sobra.
    - 📤 **Le das**: tus repetidas que la otra persona necesita.
  - Si la otra persona dejó un teléfono, aparece un enlace directo a WhatsApp;
    si dejó un mail, un enlace de correo.

## Aviso no intrusivo

Cuando alguien te comparte su enlace y lo abrís, aparece un **banner discreto**
arriba (no un pop-up molesto) avisándote cuántas figuritas hay para cambiar, con
un botón *Ver intercambios*. Podés cerrarlo con la ✕. Nada de notificaciones
invasivas ni cuentas obligatorias.

## Instalar como app (PWA) 📲

El sitio es una **PWA**: se puede instalar en el teléfono y abrir desde el ícono,
y funciona sin conexión (el álbum vive en tu dispositivo).

- **Android (Chrome/Edge):** entrá al sitio y usá el botón **⬇️ Instalar app**
  del tab *Importar*, o el menú ⋮ → *Instalar app* / *Agregar a la pantalla
  principal*.
- **iPhone (Safari):** botón *Compartir* → *Agregar a inicio*.

Requisitos: servir el sitio por **HTTPS** (por ejemplo detrás del Cloudflare
Tunnel de producción). La instalación se apoya en `manifest.webmanifest`,
`sw.js` (service worker que cachea el sitio para uso offline) y los íconos
`icon-192.png` / `icon-512.png`.

## Dos formas de usarlo

### 1) Solo el sitio (sin servidor)
Abrí `index.html` en el navegador, o publicalo en cualquier hosting estático
(por ejemplo GitHub Pages) sirviendo la raíz del repo. Funciona todo salvo el
muro de **Comunidad** (que necesita la base de datos).

### 2) Con Docker (web + base de datos)
Levanta la página **y** una base Postgres con un solo comando. Esto habilita el
muro de **Comunidad**: cada persona publica su lista y las demás la ven y
comparan al instante.

**Desarrollo local** (publica el puerto para abrir en tu máquina):

```bash
cp .env.example .env      # opcional: ajustá puerto y contraseña
docker compose up -d --build
```

Luego abrí **http://localhost:8080** (o el `WEB_PORT` que hayas puesto).
`docker compose up` aplica automáticamente `docker-compose.override.yml`, que es
el que publica el puerto (solo para desarrollo).

- `web`: servidor Node/Express que sirve el sitio y expone la API (`/api/...`).
- `db`: Postgres 16, con los datos persistidos en un volumen (`db-data`).

Para apagarlo: `docker compose down` (agregá `-v` si querés borrar también la BD).

### 3) Producción con `./prod.sh` (detrás de Cloudflare Tunnel)
Para el servidor público usá el script `prod.sh`, que:

1. Actualiza el código (`git pull`).
2. Crea `.env` con una **contraseña de BD segura** si todavía no existe (no pisa
   una existente).
3. Levanta la app **sin publicar ningún puerto** — queda solo en la red interna
   de Docker. La idea es exponerla públicamente por **Cloudflare Tunnel**, no
   abriendo puertos al mundo.

```bash
./prod.sh
```

Cómo exponerla con cloudflared (dos opciones):

- **Integrado**: pegá el token de tu tunnel en `.env` como `TUNNEL_TOKEN=...` y
  volvé a correr `./prod.sh`. Levanta también un contenedor `cloudflared` que
  conecta el túnel directo a `web:3000` por la red interna. En el panel de
  Cloudflare, apuntá el hostname público del túnel a `http://web:3000`.
- **Externo**: si ya tenés cloudflared corriendo aparte, conectalo a la red de
  Docker de este stack y apuntalo a `http://web:3000`.

Producción usa `docker compose -f docker-compose.yml up` (lo hace el script), que
**ignora** `docker-compose.override.yml`, por eso no se publica ningún puerto.

`prod.sh` despliega desde la rama **`main`** (se puede cambiar con la variable de
entorno `DEPLOY_BRANCH`): hace `git fetch`, se para en esa rama y hace
`git pull --ff-only`.

### 4) Deploy automático con GitHub Actions
El workflow `.github/workflows/deploy.yml` corre en cada push a `main` (o a mano
con *Run workflow*) sobre un **runner self-hosted** en el propio servidor, y
ejecuta `./prod.sh` en el directorio del repo.

- Necesita un **self-hosted runner** configurado en el repo, con Docker.
- Configurá la variable `DEPLOY_DIR` en *Settings → Secrets and variables →
  Actions → Variables* con la ruta del checkout en el server (por defecto
  `$HOME/proyectos/sanga/figus-change-hub`).
- Un solo deploy a la vez (`concurrency: deploy-main`), sin cancelar el que esté
  en curso.

Variables (en `.env`):

| Variable | Default | Para qué |
|---|---|---|
| `WEB_PORT` | `8080` | Puerto local en desarrollo (en producción no se publica) |
| `POSTGRES_USER` | `figus` | Usuario de la BD |
| `POSTGRES_PASSWORD` | `figus` | Contraseña de la BD (en producción la genera `prod.sh`) |
| `POSTGRES_DB` | `figus` | Nombre de la BD |
| `TUNNEL_TOKEN` | — | Token del Cloudflare Tunnel; si está, `prod.sh` levanta `cloudflared` |

#### API
- `GET  /api/health` — chequeo.
- `GET  /api/collections` — lista de colecciones publicadas.
- `GET  /api/collections/:id` — una colección.
- `POST /api/collections` — publicar (devuelve `id` + `editToken`).
- `PUT  /api/collections/:id` — actualizar (requiere `editToken`).
- `DELETE /api/collections/:id` — quitar (requiere `editToken`).

El `editToken` se guarda en tu navegador; nadie puede editar/borrar tu
publicación sin él.

## Versionado 🏷️

La versión de la app vive en **`version.js`** (una sola línea: `self.APP_VERSION`)
y es la **fuente única**:

- Se muestra en el **pie de página** (`vX.Y.Z`), así sabés qué versión estás usando.
- Nombra la **caché del service worker** (`fch-shell-vX.Y.Z`). Al subir el número,
  el `sw.js` borra la caché vieja y sirve los archivos nuevos, en vez de quedar
  pegado a la primera instalación de la PWA.
- Cuando hay una versión nueva y tenés la app abierta, aparece un aviso discreto
  **"✨ Hay una versión nueva · Actualizar"**. Al tocarlo, el service worker
  activa la versión nueva y la página se recarga una vez.

**Al publicar cambios**, subí el número en `version.js` siguiendo *semver*
(`mayor.menor.parche`): parche para arreglos, menor para funciones nuevas
compatibles, mayor para cambios grandes. Es el único lugar que hay que tocar.

## Ajustar el álbum

La estructura del álbum está en **`data.js`**. Si algún rango de números no
coincide con tu álbum (por ejemplo la sección 🥤), editá los arrays de esa
sección: la app se adapta sola.

La sección **🥤 Coca-Cola** tiene 14 figuritas y es **opcional**: está marcada
con `optional: true`. Arriba del álbum aparece un checkbox **"Contar 🥤
Coca-Cola en los faltantes"** para decidir si esas figuritas cuentan o no en el
total, en el progreso y en la lista de *Me faltan* al exportar. Por defecto no
se cuentan. Cualquier sección que marques como `optional: true` se suma a ese
control automáticamente.

## Comunidad (modo en línea)

En la pestaña **Intercambiar**, cuando el sitio corre con el servidor detrás,
aparece el panel **Comunidad 🌐**:

- **Publicar / actualizar mi lista**: sube tu nombre, contacto y álbum a la BD.
- La lista muestra a todas las personas publicadas con cuántos **cambios**
  tenés con cada una; tocás una y ves el detalle (qué le pedís / qué le das).
- **Quitar mi publicación** cuando quieras.

Si el sitio se abre como archivo estático (sin servidor), este panel
simplemente no aparece y el resto sigue funcionando.

## Archivos

- `index.html` — estructura de la página.
- `version.js` — versión de la app (fuente única); la usan la página y el `sw.js`.
- `styles.css` — estilos (mobile-first, modo oscuro).
- `data.js` — definición del álbum (secciones, selecciones, emojis, rangos).
- `app.js` — lógica del cliente (estado, import/export, enlaces, comparación, comunidad, PWA).
- `manifest.webmanifest` — manifiesto de la PWA (nombre, íconos, colores).
- `sw.js` — service worker (cachea el sitio para instalarlo y usarlo offline).
- `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` — íconos de la app.
- `server/` — backend Node/Express + Postgres (API y servido del sitio).
- `Dockerfile` — imagen del servicio web.
- `docker-compose.yml` — stack base, apto para producción (sin puertos publicados).
- `docker-compose.override.yml` — extras de desarrollo (publica el puerto local).
- `prod.sh` — despliegue de producción (git pull, `.env` seguro, sin puertos, cloudflared opcional).
- `.env.example` — variables de configuración.
