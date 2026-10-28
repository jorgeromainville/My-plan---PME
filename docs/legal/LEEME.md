# Legal — cómo publicar las páginas

Play Console pide una **URL pública** de la política de privacidad y, desde 2024,
también una URL de **eliminación de cuenta**. El texto vive en dos sitios:

- Dentro de la app: `mobile/src/data/legal.ts` (pantallas `/privacidad` y `/terminos`).
- Para publicar: estos archivos `.md`.

**Si cambias uno, cambia el otro.** La fecha de «Última actualización» está en
`LEGAL_UPDATED` y en los `.md`.

## Publicación actual: el backend en Render

El repo es privado, así que **GitHub Pages no sirve** (Pages en repos privados
requiere plan de pago). Las páginas se publican desde la misma API que ya corre
en Render:

```
https://my-plan-api.onrender.com/legal/privacidad
https://my-plan-api.onrender.com/legal/terminos
https://my-plan-api.onrender.com/legal/eliminar-cuenta
```

Cómo funciona:

1. `backend/scripts/build-legal.mjs` convierte estos `.md` en HTML
   (`backend/public/legal/*.html`) con un diseño compartido y `charset=utf-8`.
2. `npm run build` lo ejecuta antes de `tsc`, así que **cada deploy de Render
   republica las páginas**. No hay que acordarse de nada.
3. `backend/src/app.ts` sirve esa carpeta en `/legal` con
   `express.static(..., { extensions: ['html'] })`, sin sesión y con caché de 1 h.

En local:

```powershell
cd backend
npm run build:legal
npm run dev            # http://localhost:4000/legal/privacidad
```

## Qué pegar en Play Console

| Campo | URL |
|---|---|
| Política de privacidad | `https://my-plan-api.onrender.com/legal/privacidad` |
| Eliminación de cuenta | `https://my-plan-api.onrender.com/legal/eliminar-cuenta` |
| Términos (si lo pide) | `https://my-plan-api.onrender.com/legal/terminos` |

## Antes de publicar

1. **Confirma el correo de contacto.** Ahora es `soporte@myplan.today`. Si ese
   buzón no existe, cámbialo en `mobile/src/data/legal.ts`, en los tres `.md` y
   vuelve a generar.
2. Revisa que la fecha de «Última actualización» sea la correcta.
3. Si algún día se agrega analítica o publicidad, hay que actualizar la política
   **y** el formulario de *Seguridad de los datos*.

## Limitación conocida

Render free duerme a los 15 minutos de inactividad, así que la primera visita
puede tardar ~30 s en responder. Un revisor de Google suele esperar, pero si
alguna vez falla la verificación, la solución es mover estas cuatro páginas a un
**Render Static Site** (no duerme) o a Cloudflare Pages, apuntando a
`backend/public/legal`.
