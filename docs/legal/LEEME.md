# Legal — cómo publicar las páginas

Play Console pide una **URL pública** de la política de privacidad (y, desde 2024, también un enlace de eliminación de cuenta). El texto vive en dos sitios:

- Dentro de la app: `mobile/src/data/legal.ts` (pantallas `/privacidad` y `/terminos`).
- Para publicar: estos archivos `.md`.

## Antes de publicar

1. **Confirma el correo de contacto.** Ahora es `soporte@myplan.today`. Si ese buzón no existe, cámbialo en `mobile/src/data/legal.ts` y en los dos `.md`.
2. Revisa que la fecha de «Última actualización» sea la correcta.
3. Si el backend pasa a producción con HTTPS, la frase de seguridad ya es correcta. Si sigue en HTTP, no publiques la política todavía.

## GitHub Pages (opción rápida)

1. Sube el repo a GitHub.
2. Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/docs`.
3. La URL queda como `https://<usuario>.github.io/<repo>/legal/`:
   - Privacidad: `.../legal/privacidad.html`
   - Términos: `.../legal/terminos.html`
4. Pega la URL de privacidad en Play Console → *Contenido de la app* → *Política de privacidad*.

GitHub Pages procesa los `.md` con front matter (por eso cada archivo empieza con `---`).

## Eliminación de cuenta

Play Console pide explicar cómo se elimina la cuenta. La app ya lo hace en **Perfil → Eliminar cuenta** (borra en cascada). Puedes enlazar la misma página de privacidad; la sección 8 lo describe.
