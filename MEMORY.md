# MEMORY — Planner Today

> Estado vivo del proyecto. Actualizar al cerrar cada fase o al resolver un bloqueo.
> Última actualización: 2026-10-06 — Fase 1 cerrada y verificada.
>
> Documentos relacionados: `AGENTS.md` (comandos y quirks de entorno),
> `FASES.md` (qué está hecho y qué falta por fase). No duplicar su contenido aquí,
> solo el estado que cambia: versiones fijadas, bloqueos y decisiones del usuario.

## Cómo actualizar este archivo

Al cerrar cada fase o desbloquear algo, anotar: fecha, qué se verificó,
versiones que se fijaron manualmente y por qué, y decisiones pendientes del usuario.

## Dónde estamos

- **Fase 1 terminada** (ver `FASES.md`). App corre en Expo Go, backend `/health` OK.
- **Siguiente:** Fase 8 — Avanzadas (adjuntos, push, offline, producción).
- **Bloqueo abierto:** Postgres local rechaza usuario `planner` → sin `prisma migrate`. Decisión del usuario: omitir DB por ahora.

## Stack real (no el planeado)

- Móvil en **Expo SDK 57** (se subió de 51 porque el Expo Go del dispositivo es 57):
  `expo ~57.0.0`, `expo-router ~57.0.25`, `react-native 0.86.3`, `react 19.2.3`,
  `react-dom 19.2.3` (pin manual), `babel-preset-expo ~57` (dev, obligatorio),
  `@types/react ~19.1.0`, `async-storage 2.2.0`, `maps 1.27.2`, `safe-area ~5.7`, `screens ~4.26`.
- 2026-10-15: `expo ~57.0.29` + `expo install --fix` (linking .13, location .21,
  notifications .23, router .27, `@types/react ~19.2.4`, **typescript ~6.0.3**).
  TS6 retiró `baseUrl` → se eliminó de `mobile/tsconfig.json` (los `paths` relativos
  `./src/*` siguen resolviendo el alias `@/*`); typecheck verde sin `baseUrl`.
- 2026-10-15: **notifications .23 trae `ExpoTopicSubscriptionModule` que el Expo Go
  del teléfono NO incluye → crash al importar**. Fijado en `57.0.22` + carga
  perezosa en `reminders.ts` (si el nativo falta, los avisos se apagan solos).
  Regla: no subir minors de módulos nativos sin probar en el Go del dispositivo.
- 2026-10-16: `expo ~57.0.30` + `expo-router ~57.0.28` (typecheck + bundle OK).
  `expo-notifications` se queda en `57.0.22` a propósito (ver crash arriba).
- 2026-10-16: **importar el paquete raíz `expo-notifications` lanza `Error` en
  Android/Expo Go** (SDK 53 quitó el push remoto): `index.js` → `getExpoPushTokenAsync`
  → `DevicePushTokenAutoRegistration.fx` llama `addPushTokenListener` en ámbito
  global → `warnOfExpoGoPushUsage()` hace `throw` en Android. Regla: **nunca**
  `import 'expo-notifications'`; usar el envoltorio `src/services/notifications.ts`
  con submódulos (`build/scheduleNotificationAsync`, `build/NotificationPermissions`,
  `build/NotificationsHandler`, `build/setNotificationChannelAsync`,
  `build/Notifications.types`, `build/NotificationChannelManager.types`) y cargarlo
  con `import()` perezoso. Verificado en el bundle: `warnOfExpoGoPushUsage` y
  `DevicePushTokenAutoRegistration` ya no aparecen.
- 2026-10-16: **escáner con IA** (`backend/src/services/ai/`): Gemini multimodal
  lee la FOTO (tablas, columnas, girada) y devuelve clases; `normalizeClasses`
  valida días/horas 24h y descarta recesos y duplicados (probado con tsx).
  `AI_PROVIDER=none` → el móvil usa `parseScheduleText`. La respuesta de
  `/api/scanner/ocr` trae `candidates`/`ai`/`aiError`; `GET /api/scanner/ai`
  alimenta el indicador de la pantalla `/escaner`. El OCR de OCR.space se
  mantiene (texto de respaldo + pestaña Texto).
- 2026-10-16: **IA activada con Gemini** (clave gratis del usuario en `backend/.env`):
  `AI_PROVIDER="gemini"`, `GEMINI_MODEL="gemini-flash-lite-latest"` (el más rápido,
  ~8 s) + `GEMINI_MODEL_FALLBACKS="gemini-3-flash-preview,gemini-flash-latest"`.
  Ojo: con esta clave `gemini-2.5-flash` da 404 y los `*-latest` dan 503 a ratos →
  cadena de respaldo que salta al siguiente modelo. Probado con la foto real del
  usuario: 17-20 clases bien agrupadas (antes: 0). **OCR e IA corren en paralelo**
  (`Promise.all` en `scanner.controller.ts`): la espera es la de la IA, no la suma
  (de ~30 s a ~9 s). El texto OCR se conserva para "Ver texto detectado" y como
  respaldo; si el OCR falla pero la IA acierta, se responde igual sin error.
- 2026-10-16: **los horarios girados rompen el OCR**: la foto de prueba real
  (1600x1200) sin girar devolvía una lista de horas suelta + días con materias
  (imposible emparejar); girada 90° el OCR ya agrupa por franja horaria. Por eso
  el escáner tiene el botón **🔄 Girar** antes de leer. Se probó `pollinations.ai`
  como IA sin clave: ahora responde 402 (pago) y el único modelo anónimo no tiene
  visión → descartado.
- 2026-10-19: **"Date value out of bounds" al crear los eventos del escáner** (bug
  del video del usuario): "Repetir hasta" era texto libre y escribió `2027 10 24`
  con espacios → `new Date("2027 10 24T12:00:00")` es fecha inválida y
  `.toISOString()` lanza ese error (mensaje de Hermes). Se eliminaron las fechas
  escritas a mano: ahora se usa **`NativeDate`** (calendario nativo,
  `@react-native-community/datetimepicker` 9.1.0, ya incluido en Expo Go) con
  atajos **+4 meses / +6 meses / Fin de año**. Nuevo helper
  `parseLocalDay()` en `src/utils/dates.ts` (valida `AAAA-MM-DD`, devuelve
  `null` en vez de reventar) aplicado en `escaner.tsx`, `evento.tsx`,
  `ingreso.tsx`, `persona.tsx` y `NativeDate`. `NativeDate` muestra la fecha
  como "31 dic 2027" (`formatShortEs`). Verificado: typecheck + bundle 200 +
  `POST /api/events` con `repeatUntil` responde 201 (el fallo era solo del móvil).
- 2026-10-19: **key de Google Maps recibida pero inutilizable**: la key es válida
  (formato `AIza…`), pero su proyecto de Google Cloud **no tiene facturación** →
  Geocoding responde `REQUEST_DENIED` ("You must enable Billing on the Google
  Cloud Project") y Static Maps 403; el JS API cargaría con
  `BillingNotEnabledMapError`. Se guardó en `mobile/.env`
  (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`) para cuando se active. Se probó **CARTO
  Voyager** como alternativa gratis: ya no lo es (el tile devuelve un PNG con
  "API KEY REQUIRED"). Basemap cambiado a **Esri World Street Map** (sin key,
  look tipo Google, atribución © Esri/HERE/Garmin/OSM). Ojo: Esri es gratis para
  uso no comercial; para publicar → MapTiler o Google.
- `mobile/tsconfig.json` usa `moduleResolution: bundler` (lo exige `expo/tsconfig.base` de SDK 57).
- Backend sin cambios: Express + Prisma 5.22 + JWT + bcrypt + zod. `tsc` en verde.

## Entorno verificado (2026-10-06)

- Windows + PowerShell, Node v24.19.0, npm 11.17.0.
- Puertos: API `4000`, Metro `8081`. Expo Go del dispositivo: SDK 57.
- Postgres corre en `localhost:5432`. Usuarios: `postgres` (clave definida 2026-10-06) y
  `planner`/`planner` con CREATEDB. DB `planner` migrada (`20261006221812_init`).
  Backend **sin DB migrada sí arranca**: `/health` y `GET /api` responden; todo `/api/auth/*` falla hasta el migrate.
- El repo **no es git** (sin control de versiones a la fecha).

## Contrato auth actual (para conectar el login en Fase 2+)

- `POST /api/auth/register` `{name, email, password≥8}` → `201 {user, access, refresh}`
- `POST /api/auth/login` `{email, password}` → `{user:{id,name,email,currency}, access, refresh}`
- `GET /api/auth/me` con `Authorization: Bearer <access>` → `{user}`
- Access expira en 15m, refresh en 30d. Validación con zod, errores `{error: string}`.
- Verificado 2026-10-06 contra DB real: register → access → `/me` OK.
  (Existe usuario de prueba `jorge@test.com`, borrar cuando estorbe.)

## Decisiones del usuario (log)

- 2026-10-06: omitir Postgres por ahora; probar solo el móvil con datos demo.
- 2026-10-06: docs del repo en español (`AGENTS.md`, `FASES.md`, `MEMORY.md`).
- 2026-10-06: subir a Expo SDK 57 (obligado por su Expo Go) en vez de instalar Go viejo.
- 2026-10-06: un solo archivo de memoria (`MEMORY.md`), eliminar duplicado.
- 2026-10-06: planificador como la referencia del video (3 vistas, drag+deshacer, recurrencia sin anual/custom, sin campo Privado).
- 2026-10-06: acceso con invitado persistente-local + Google después (PENDIENTE implementar, va antes o con Fase 3).

## Quirks descubiertos (no repetir el diagnóstico)

1. Tras subir a SDK 57 hubo que borrar `node_modules` + `package-lock` e instalar limpio
   (quedaba `expo-router@3.5` fantasma que rompía la resolución).
2. `react-native@0.86.3` exige `@types/react ^19.1.1` → no fijar `~19.0.0`.
3. `react-dom` sin fijar resuelve a 19.3.x y choca con `react 19.2.3` → pin `react-dom@19.2.3`.
4. Sin `babel-preset-expo` en devDependencies, Metro falla con `Cannot find module` y luego
   el engañoso `Cannot read properties of undefined (reading 'transformFile')`.
5. Ante errores raros de Metro tras cambios de deps: matar procesos `expo start`,
   borrar `mobile/.expo` y arrancar con `npx expo start --clear`.
6. No correr dos instancias de Expo (pelean el puerto 8081). Los servidores de prueba
   en segundo plano hay que matarlos antes de entregar al usuario.
7. Backend `.env` se crea con `copy .env.example .env` (PowerShell). Servidor dev: `npm run dev`.
8. Express 4 no captura throws en handlers async → envolver todo en `asyncHandler`
   (`backend/src/middleware/asyncHandler.ts`); si no, un 400 de zod tumba el server.
9. Tras crear pantallas en `mobile/app/`, arrancar Expo una vez para regenerar
   `.expo/types/router.d.ts` (typedRoutes); si no, `tsc` falla con rutas desconocidas.
10. Access JWT 15 min: el móvil renueva solo vía `POST /api/auth/refresh` (`api.ts`);
    sin esto, todo falla a los 15 min con 401. `setOnSessionExpired` se conecta en `_layout`.
11. En el celular, `localhost` es el teléfono. La app deriva la IP LAN del PC
    desde el servidor de Metro (`Constants.expoConfig.hostUri`) en `api.ts`
    (`resolveBase`), así que **ya no hay que editar `mobile/.env`** al cambiar de
    Wi-Fi; el `.env` es solo respaldo (túnel/localhost). Falta regla de firewall
    para el puerto 4000.
12. `Event.backupOfId` eliminado; respaldo es `isBackup` boolean (migración manual con `migrate diff` + `deploy` porque `dev` pedía confirmación interactiva; ojo con BOM en el SQL).
13. Pager de 3 páginas + zoom con `PanResponder` de 2 dedos (sin librerías); `layoutDay` acepta `zoom`.
14. Gestos nativos (`gesture-handler` 2.32 + `reanimated` 4.5 + `worklets`, incluidos en Expo Go): regla de oro — nunca `ref.current =` en objetos capturados por worklets, todo mutable en `useSharedValue`; `GestureHandlerRootView` en `_layout`.
15. REVERT 2026-10-08: los WARN de worklets (`ref.current` y `shared.value` en render) no compensaban → fuera las 4 libs; pager manual + candado, zoom con botones, `PanResponder` con captura y salvavidas. Reintentarlo solo con planeación dedicada.
16. Offline (2026-10-19): `syncCore.ts` (puro, probado con tsx: 14/14) + `sync.ts` (cola en `@planner/pendingOps` + `@planner/idMap`). `api.ts` cachea los GET en `@planner/cache:<ruta>` (timeout 8 s; escáner 60 s) y encola POST/PATCH/DELETE de entidades. **Solo cuerpos JSON**: escáner/adjuntos (FormData) y `/api/auth/*` necesitan conexión. Los endpoints derivados (`/api/finance/summary`, `/api/stats/overview`) se cachean pero **no** se recalculan con la cola; `/api/places/map/items` sí tiene overlay propio (`applyMapOverlay`). Al cerrar sesión se borran caché + cola + idMap. Sin LWW por `updatedAt`: un solo dispositivo, la cola FIFO ya deja el último cambio.
17. Mapa en Android: el WebView emite `touchcancel` a los ~500 ms al abrir el menú de selección y mataba el pulsado largo de 650 ms → se quitó ese listener, se puso `-webkit-touch-callout/user-select:none` y umbral de 12 px (ahora 550 ms). El botón "crear punto" vive en `pending` y navega a `/lugar?lat&lng`.
18. `rewritePath` debe mapear **por segmentos**: reemplazar subcadenas hacía que `tmp_1` corrompiera `tmp_15`. La cola deduplica POST idénticos (mismo path+cuerpo) dentro de 15 min: un doble toque por falta de feedback creaba N eventos; Perfil → "Descartar pendientes" vacía la cola. Los datos curiosos del escáner están en `mobile/src/data/funFacts.ts` (8 % de guiños).

## Pendientes concretos

- [x] `npx prisma migrate dev --name init` — hecho 2026-10-06 (previo: reset clave vía `trust` en pg_hba + `ALTER USER planner CREATEDB` para la shadow DB)
- [ ] Conectar login/registro del móvil al JWT — hecho en Fase 2 (gate en `_layout` + `useSession`)
- [x] Datos demo eliminables desde la app (2026-10-19): Perfil → "Datos de prueba" (ver Fase 8 en `FASES.md`).
- [ ] Iniciar git en la raíz (`git init`, primer commit de Fase 1)
- [ ] Acceso invitado local + botón Google "Próximamente" (decidido 2026-10-06)
- [x] IP LAN automática (2026-10-16): `api.ts` deriva el host de Metro (`expoConfig.hostUri`) → la app sigue al Wi-Fi sin tocar `.env`. La IP se ve en Perfil ("Servidor: …").
- [x] APIs externas en planner: Nager.Date (feriados) + Open-Meteo (clima). Resto (Fixer, Nominatim, adjuntos, validación, GCal) en Fase 8/9.
- [x] Mapa: **MapLibre GL + OpenFreeMap** en WebView (`mobile/src/components/mapHtml.ts`). OpenFreeMap = gratis, sin API key, sin límite de peticiones y **con uso comercial permitido** (lo que hace falta para Play Store). Se descartaron: **Esri World Street Map** y **MapTiler free** (ambos solo uso NO comercial; MapTiler comercial = $30/mes) y **CARTO** (pide key). La key de Google **ya existe** en `mobile/.env` (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`), pero el proyecto de Cloud **no tiene facturación**: Google responde "You must enable Billing on the Google Cloud Project" → Google Maps imposible hasta activarla. Si algún día hay dinero: Google/MapTiler y solo se cambia la URL del estilo. Package `com.plannertoday.app`.
- [x] Escáner: `OCRSPACE_KEY` configurada en `backend/.env` (2026-10-15) y verificada con HTTP 200 real.
