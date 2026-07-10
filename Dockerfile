# Imagen del servicio web (sirve el sitio estático + API)
FROM node:20-alpine

WORKDIR /app/server

# Dependencias primero (mejor cacheo)
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Código del servidor
COPY server/ ./

# Archivos estáticos del sitio (en /app, un nivel arriba)
COPY index.html app.js data.js styles.css /app/
ENV STATIC_DIR=/app
ENV PORT=3000

EXPOSE 3000
CMD ["node", "index.js"]
