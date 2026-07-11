#!/usr/bin/env bash
#
# Despliegue de producción para Figus Change Hub.
#
#   - Actualiza el código (git pull).
#   - Crea .env con una contraseña de BD segura si todavía no existe.
#   - Levanta la app SIN publicar puertos (se expone públicamente por cloudflared).
#
# Uso:  ./prod.sh
#
set -euo pipefail

# Ubicarse siempre en el directorio del repo (donde vive este script)
cd "$(dirname "$0")"

ENV_FILE=".env"

# --- 1) Actualizar el código -------------------------------------------------
# Rama de despliegue (por defecto main). Se puede sobreescribir con DEPLOY_BRANCH.
BRANCH="${DEPLOY_BRANCH:-main}"
echo "==> Actualizando el código (rama ${BRANCH})…"
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# --- 2) Crear .env con contraseña segura si no existe ------------------------
gen_secret() {
  # 48 caracteres hexadecimales (192 bits). Solo [0-9a-f], seguro para el DSN.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 48
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo "==> No existe $ENV_FILE: generando uno con contraseña de BD segura…"
  DB_PASS="$(gen_secret)"
  umask 077
  cat > "$ENV_FILE" <<EOF
# Generado automáticamente por prod.sh el $(date -u +%Y-%m-%dT%H:%M:%SZ)
# No lo subas al repositorio (está en .gitignore).

# --- Base de datos (Postgres) ---
POSTGRES_USER=figus
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=figus

# --- Cloudflare Tunnel (opcional) ---
# Pegá el token de tu tunnel para que prod.sh levante cloudflared apuntando a
# web:3000 (sin abrir puertos). En Cloudflare, apuntá el hostname a http://web:3000.
# TUNNEL_TOKEN=
EOF
  chmod 600 "$ENV_FILE"
  echo "==> $ENV_FILE creado con una contraseña de BD generada."
else
  echo "==> $ENV_FILE ya existe: lo dejo tal cual (no piso la contraseña)."
fi

# --- 3) Levantar en producción (sin puertos publicados) ---------------------
# Usamos solo docker-compose.yml (ignora docker-compose.override.yml de dev),
# por lo que NO se publica ningún puerto al host.
COMPOSE_ARGS=(-f docker-compose.yml)

# Activar cloudflared solo si hay un TUNNEL_TOKEN con valor en .env
if grep -qE '^[[:space:]]*TUNNEL_TOKEN=[^[:space:]]+' "$ENV_FILE"; then
  echo "==> TUNNEL_TOKEN detectado: se levanta también cloudflared (túnel público)."
  COMPOSE_ARGS+=(--profile tunnel)
else
  echo "==> Sin TUNNEL_TOKEN en $ENV_FILE: se levantan solo web + db."
  echo "    Conectá tu cloudflared a la red de Docker apuntando a http://web:3000,"
  echo "    o completá TUNNEL_TOKEN en $ENV_FILE y volvé a correr ./prod.sh"
fi

echo "==> Construyendo y levantando los contenedores…"
docker compose "${COMPOSE_ARGS[@]}" up -d --build

echo ""
echo "==> Listo. La app corre en la red interna de Docker (web:3000), sin puertos publicados."
docker compose "${COMPOSE_ARGS[@]}" ps
