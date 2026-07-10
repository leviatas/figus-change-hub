# Figus Change Hub ⚽

Sitio para llevar tu álbum de figuritas **Usa Mex Can 26**, marcar lo que tenés,
lo que te falta y tus repetidas, y **intercambiar con otras personas**.

No necesita servidor ni base de datos: todo se guarda en tu propio navegador
(localStorage) y para intercambiar se usan enlaces o texto que van directo de
persona a persona.

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

## Cómo usarlo

Es un sitio estático. Abrí `index.html` en el navegador, o publicalo en cualquier
hosting estático (por ejemplo GitHub Pages) sirviendo la raíz del repo.

## Ajustar el álbum

La estructura del álbum está en **`data.js`**. Si algún rango de números no
coincide con tu álbum (por ejemplo la sección 🥤), editá los arrays de esa
sección: la app se adapta sola. La sección 🥤 viene con un rango tentativo
(1–10) porque en las listas originales estaba cortado.

## Archivos

- `index.html` — estructura de la página.
- `styles.css` — estilos (mobile-first, modo oscuro).
- `data.js` — definición del álbum (secciones, selecciones, emojis, rangos).
- `app.js` — toda la lógica (estado, export, enlaces, comparación de cambios).
