# Figus Change Hub

## Versionado (regla permanente)

El sitio muestra la versión en el footer (`index.html`, dentro de
`.foot-credit`) con el formato **Mayor.Minor.Patch** (SemVer), por ejemplo
`v1.0.0`.

**Cada vez que se hace un cambio en el proyecto hay que actualizar esta
versión**, reflejando el tipo de cambio:

- **Mayor** (`X.0.0`): cambios grandes o incompatibles con lo anterior
  (rediseños, cambios de estructura de datos, features que rompen el flujo
  existente).
- **Minor** (`x.Y.0`): funcionalidad nueva compatible hacia atrás
  (una feature, una sección, una opción nueva).
- **Patch** (`x.y.Z`): correcciones, ajustes menores, textos, estilos, fixes.

### Cómo aplicarla

1. Antes de terminar cualquier cambio, subir la versión en el footer de
   `index.html` según el tipo de cambio (Mayor / Minor / Patch).
2. Incrementar un solo nivel por cambio y reiniciar a `0` los niveles
   inferiores (ej: de `1.2.3` → Minor → `1.3.0`; → Mayor → `2.0.0`;
   → Patch → `1.2.4`).
3. Mencionar en el mensaje del commit la nueva versión y por qué
   (ej: `v1.1.0 - agrega filtro por selección`).

Versión actual: **v1.0.0**.
