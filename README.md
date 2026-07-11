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

Cómo exponerla con cloudflared. El túnel corre como un contenedor más del stack
(perfil `tunnel`) y enruta el hostname público directo a `web:3000` por la red
interna, sin abrir puertos. Hay dos modos:

**A) Con archivo de config (endpoint definido en el repo) — recomendado**

El endpoint (qué hostname va a qué servicio) se define en `cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
ingress:
  - hostname: figus.tudominio.com
    service: http://web:3000     # <- la app
  - service: http_status:404
```

Pasos (una vez):

```bash
cloudflared tunnel login
cloudflared tunnel create figus-change-hub        # devuelve un UUID + <UUID>.json
cp cloudflared/config.yml.example cloudflared/config.yml
#  editá config.yml: poné el UUID y tu hostname; copiá el <UUID>.json a cloudflared/
cloudflared tunnel route dns figus-change-hub figus.tudominio.com
./prod.sh
```

`prod.sh` detecta `cloudflared/config.yml` y levanta el túnel solo. `config.yml`
y los `*.json` están en `.gitignore` (tienen datos del túnel).

**B) Con token (endpoint definido en el panel de Cloudflare)**

En `.env`:

```bash
TUNNEL_TOKEN=<token-del-tunnel>
CLOUDFLARED_ARGS=tunnel --no-autoupdate run
```

Y en el panel de Cloudflare (Zero Trust → Networks → Tunnels → Public Hostname),
apuntá el hostname a `http://web:3000`. Después `./prod.sh`.

En ambos modos el servicio interno es siempre **`http://web:3000`**.

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

## Ajustar el álbum

La estructura del álbum está en **`data.js`**. Si algún rango de números no
coincide con tu álbum (por ejemplo la sección 🥤), editá los arrays de esa
sección: la app se adapta sola. La sección 🥤 viene con un rango tentativo
(1–10) porque en las listas originales estaba cortado.

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
- `styles.css` — estilos (mobile-first, modo oscuro).
- `data.js` — definición del álbum (secciones, selecciones, emojis, rangos).
- `app.js` — lógica del cliente (estado, export, enlaces, comparación, comunidad).
- `server/` — backend Node/Express + Postgres (API y servido del sitio).
- `Dockerfile` — imagen del servicio web.
- `docker-compose.yml` — stack base, apto para producción (sin puertos publicados).
- `docker-compose.override.yml` — extras de desarrollo (publica el puerto local).
- `prod.sh` — despliegue de producción (git pull, `.env` seguro, sin puertos, cloudflared opcional).
- `cloudflared/config.yml.example` — config del endpoint del túnel (ingress → `http://web:3000`).
- `.env.example` — variables de configuración.
