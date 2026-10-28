# MEMORY — My Plan

> Estado vivo del proyecto. Actualizar al cerrar cada fase o al resolver un bloqueo.
> Última actualización: 2026-10-27 — importación invitado → cuenta verificada contra Neon.
>
> Documentos relacionados: `AGENTS.md` (comandos y quirks de entorno),
> `FASES.md` (qué está hecho y qué falta por fase). No duplicar su contenido aquí,
> solo el estado que cambia: versiones fijadas, bloqueos y decisiones del usuario.

## Cómo actualizar este archivo

Al cerrar cada fase o desbloquear algo, anotar: fecha, qué se verificó,
versiones que se fijaron manualmente y por qué, y decisiones pendientes del usuario.

## Dónde estamos

- **Fase 1 terminada** (ver `FASES.md`). App corre en Expo Go, backend `/health` OK.
- **Siguiente:** Fase 8 — Avanzadas (push, pinger de Render, Play Store; verificación de correo si se reabre el alta).
- **Bloqueo abierto:** ninguno. (El problema de Postgres local se resolvió pasando a Neon.)

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
16. Offline (2026-10-19): `syncCore.ts` (puro, probado con tsx: 14/14) + `sync.ts` (cola en `@planner/pendingOps` + `@planner/idMap`). `api.ts` cachea los GET en `@planner/cache:<ruta>` (timeout 8 s; escáner 60 s) y encola POST/PATCH/DELETE de entidades. **Solo cuerpos JSON**: escáner (FormData) y `/api/auth/*` necesitan conexión. Los endpoints derivados (`/api/finance/summary`, `/api/stats/overview`) se cachean pero **no** se recalculan con la cola; `/api/places/map/items` sí tiene overlay propio (`applyMapOverlay`). Al cerrar sesión se borran caché + cola + idMap. Sin LWW por `updatedAt`: un solo dispositivo, la cola FIFO ya deja el último cambio.
17. Mapa en Android: el WebView emite `touchcancel` a los ~500 ms al abrir el menú de selección y mataba el pulsado largo de 650 ms → se quitó ese listener, se puso `-webkit-touch-callout/user-select:none` y umbral de 12 px (ahora 550 ms). El botón "crear punto" vive en `pending` y navega a `/lugar?lat&lng`.
18. `rewritePath` debe mapear **por segmentos**: reemplazar subcadenas hacía que `tmp_1` corrompiera `tmp_15`. La cola deduplica POST idénticos (mismo path+cuerpo) dentro de 15 min: un doble toque por falta de feedback creaba N eventos; Perfil → "Descartar pendientes" vacía la cola. Los datos curiosos del escáner están en `mobile/src/data/funFacts.ts` (8 % de guiños).
19. Adjuntos **descartados** (2026-10-19): el escáner ya no escribe la foto (ni en el PC ni en la BD). `POST /api/scanner/ocr` recibe el `Buffer` en memoria (OCR.space y Gemini lo aceptan así), no devuelve `imageUrl`, y la tabla `Attachment`/`/api/attachments`/`backend/uploads` se eliminaron (migración `20261019000000_drop_attachment`). En el celular, `escaner.tsx` borra la foto temporal al repetir y al desmontar (`FileSystem.deleteAsync`).
20. Mapa sin ciudad fija (2026-10-19): se quitó el atajo **"Lima"** del formulario de lugar y el centro `LIMA` del tab Mapa. Ahora `PERU` (-9.19,-75.0152) es solo el encuadre neutral (zoom 5) hasta que llega la ubicación o los pines. El picker arranca **sin marcador** (`buildPickerHtml(lat,lng,false)` lo crea al tocar); `goMine` pinta al instante la última posición conocida y luego afina con la exacta. Iconos de tabs: 🏠 🗺️ 📅 📈 a 20 px.
21. Moneda y semana (2026-10-19): el símbolo **no** se guarda por registro; `formatMoney` lee `useSession.user.currencySymbol` (fallback `S/`), así que cambiar de moneda solo cambia la etiqueta y **no convierte** importes. El código personalizado se valida con `/^[A-Z0-9]{2,6}$/` y el símbolo con 1–6 caracteres (`PATCH /api/auth/me`, `.strict()` → 400 si sobra un campo). La copia del usuario vive en `@planner/user`; al guardar moneda/semana se limpia `@planner/cache:*` porque `stats/overview` y `goals/progress` se agregan en el servidor. `weekStartsOn` se guarda al tocar el chip; el lunes sigue siendo el valor por defecto.
22. Temas (2026-10-19): `colors` ya **no** es una paleta fija sino un Proxy sobre la paleta activa; los `StyleSheet.create` de módulo se convirtieron a `createStyles(colors)` + `const s = useThemedStyles(createStyles)` en cada componente (si se añade una pantalla, copiar ese patrón o quedará solo en claro). Default `auto` = `useColorScheme`; `light`/`dark`/`andean` fuerzan. El tema del servidor manda al iniciar sesión (`useSession` → `usePrefs.set`). Los acentos capturados en constantes de módulo (`bgByColor`, `PALETTE`) se corrigieron: ahora se resuelven en cada render para seguir al tema. Solo `SLICE_COLORS` (donas de Estadísticas) queda fijo a propósito porque son colores de datos. Tokens nuevos: `onAccent` (texto oscuro/crema sobre botones verde/coral/ocre/azul) y `link` (enlaces legibles en las tres paletas); no usar `colors.primary` como color de texto en oscuro (3.7:1).
23. Seguridad (2026-10-19): el rate limit es **en memoria** (se reinicia al reiniciar y no sirve con varias instancias; para producción, Redis o `express-rate-limit` con store). La clave del login se compone de `req.ip + email`, así un ataque a un correo no bloquea a los demás de la misma red. `DELETE /api/auth/account` borra el `User` y las cascadas de Prisma se llevan todo. **Ojo**: cambiar la contraseña no invalida los refresh tokens ya emitidos (30 d); si se quiere cerrar sesión en otros dispositivos hay que añadir `tokenVersion` al JWT. CORS no bloquea apps nativas (no mandan `Origin`), solo navegadores desconocidos.
24. Rutas legales (2026-10-19): `/privacidad` y `/terminos` están fuera de `(auth)`/`(tabs)` y son **públicas**; el guard de `_layout.tsx` las exceptúa (si se agrega otra pantalla pública, sumarla ahí o rebotará al login). El texto canónico está en `mobile/src/data/legal.ts`; los `.md` de `docs/legal/` son la copia para publicar (Play Console exige URL) y usan front matter para que GitHub Pages los renderice. El correo `soporte@myplan.today` es **provisional**: confirmar que el buzón exista (y el dominio) antes de publicar. La tarjeta Legal vive al final de Perfil, antes de Seguridad/Eliminar cuenta.
25. Contraste y tema típico (2026-10-19): el oscuro tenía texto negro por defecto (inputs, `weekNum`, `miniNum`, `miniCheck`, `$` de Ingresos, checks de Meta/Persona) y botones semánticos con texto blanco sobre acentos claros (verde/coral/ocre/azul, ilegibles). Regla: todo `TextInput` lleva `color: colors.text` + `placeholderTextColor={colors.muted}`; los botones sobre `green/coral/yellow/blue/purple` usan `colors.onAccent`; los botones sobre `primary` usan `colors.onPrimary` (blanco en claro/típico, tinta oscura en oscuro porque el primario es coral vivo); los enlaces usan `colors.link`; nunca `color: '#fff'` fijo en un botón. El tema oscuro sigue las referencias del usuario: fondo negro neutro (`#08090B`), tarjetas `#16171B` con un degradado blanco muy sutil (`expo-linear-gradient`), texto blanco frío, coral vivo `#FF6B57` para CTA/glow y turquesa `#4ED8B0` para datos; el coral ya no tiñe los fondos (eso era lo que se sentía "muy naranja"). El tema típico usa `react-native-svg` (incluido en Expo Go, versión 15.15.4): `AndeanMotifs.tsx` dibuja banda tejida (tab bar + borde superior de Inicio/Perfil/Planificador/Estadísticas/Nuevo registro), trama de rombos escalonados dentro de cada `Card`, chakana en el logo de Inicio, en `SectionHeader` y en el chip "Típico". No hay imágenes de textura: todo es vectorial para no pesar.
26. Identidad y Google (2026-10-20): la app pasa a **My Plan** (`name`, `slug: my-plan`, `scheme: myplan`, `package`/`bundleIdentifier`: `app.myplan.today`). El cambio de package se hizo **antes del primer build** porque Play Store no permite cambiarlo después. Login con Google: `POST /api/auth/google` valida el `idToken` con `google-auth-library` (audiencia = `GOOGLE_CLIENT_ID`, client ID **Web**), crea la cuenta o vincula por correo y deja `passwordHash` en NULL; `login` con contraseña responde 401 si la cuenta es solo Google. `GET /api/auth/google/config` entrega el client ID público en runtime para no recompilar al cambiarlo (en Render `GOOGLE_CLIENT_ID` va con `sync: false`). El móvil usa una **dev build** (Expo Go no soporta OAuth); `@react-native-google-signin/google-signin` se carga de forma perezosa para que Expo Go siga funcionando.
27. Anti-abuso de cuentas (2026-10-27): tras probar que un correo inventado + clave débil creaba cuenta, se cerró el alta con contraseña (`ALLOW_PASSWORD_SIGNUP=false`; `register` responde 403). **No** era una fuga: cada consulta filtra por `req.userId` (63 usos) y el JWT sale del `sub`; un correo falso crea una cuenta vacía, no entra a otra. Cuentas nuevas solo con Google; el login con contraseña se queda para las existentes. Se añadió `app.set('trust proxy', 1)` (sin esto `req.ip` era la IP del proxy de Render y los límites por IP eran globales), `oauthLimiter` 20/15 min por IP para `/api/auth/google` y `allowNewAccount` (5 cuentas nuevas/hora/IP, solo al crear). `registerLimiter` sigue en 20/h por IP si algún día se reabre. **Pendiente**: verificación por correo si se reabre el alta.
28. Modo invitado (2026-10-27): los datos del invitado viven en **SQLite** (`expo-sqlite` 57.0.4, `myplan.db`, WAL, esquema v1 por `PRAGMA user_version`) y **nunca** tocan PostgreSQL. `api()` corta antes de la red/cola si `isGuest()` y resuelve en `src/services/local/localApi.ts`, que imita las rutas y el JSON del backend (por eso las pantallas no cambian). El modo se guarda en `@planner/mode` y también **en memoria** (`sessionMode.ts`), porque `api()` es sincrónico y leer AsyncStorage en cada request abriría una carrera al arrancar; `@planner/guestUser` guarda el perfil local. `expo-sqlite` se importa con `import()` perezoso: sin el módulo nativo la app abre en modo cuenta y el invitado muestra un aviso (build vieja). Sin cola offline en invitado (SQLite ya es la verdad); `flushPending` sale de inmediato. La fórmula de productividad está **duplicada** en `local/stats.ts` (debe seguir a `productivity.service.ts`) y `local/events.ts` replica el regex `HH:MM` del backend **sin** validar rangos (25:99 pasa en ambos; no "arreglar" solo un lado). Pruebas con SQL real: `cd mobile; npm run test:local` (53 comprobaciones, usa `node:sqlite` + `__injectDatabase`, sin React Native). Añadir `expo-sqlite` exige **nueva dev build**. La importación a cuenta ya existe (ver quirk 29).
29. Importación invitado → cuenta (2026-10-27): `POST /api/import` (controller en `backend/src/controllers/import.controller.ts`, cuerpo de hasta 6 MB montado **antes** del parser global de 1 MB en `app.ts`) hace todo en **una transacción** y genera ids uuid nuevos; nunca reutiliza los ids del teléfono. `batchId` uuid se guarda como `Setting` `import:<batchId>`: reenviar devuelve `200 { duplicate: true }` sin duplicar. El móvil (`src/services/guestImport.ts` + `src/services/local/exportData.ts`) conserva el batch en `@planner/importBatchId` y **solo borra el SQLite tras 201/200** (`resetLocalData`). Trampas ya resueltas: (a) SQLite no tiene booleanos → `isBackup`/`done` se convierten a boolean al exportar; (b) `Event` y `Place` **no** tienen `createdAt` en Prisma, no agregarlo a `createMany` (Prisma lanza 500 "Unknown argument"); (c) la tabla puente es `_EventContacts` con `A = Contact.id`, `B = Event.id`, y se inserta en bruto por bloques de 400 con `ON CONFLICT DO NOTHING` (un `create` por evento costaba ~450 ms por la latencia de Neon); (d) el timeout de `api()` para `/api/import` es 180 s, el normal 8 s; (e) `/api/import` **no** entra en la cola offline (`entityFor` no lo reconoce), así que sin red falla con aviso y los datos siguen en el teléfono. Límites: 3000 por colección, 8000 por envío. Verificado E2E con un lote generado por la exportación real del móvil (Neon, usuario temporal borrado en cascada).
30. Copias de seguridad del invitado (2026-10-28): el archivo JSON usa `schema: "myplan.backup/1"` y reutiliza **la misma forma que el cuerpo de `/api/import`** (`data` + `profile` + `batchId`), así que el mismo archivo servirá para subirlo a una cuenta sin convertir nada. `restoreGuest` corre en **una transacción**: `replace` vacía las tablas con `clearDataTables()` (no abre transacción propia para no anidar `withTransactionAsync`) y conserva los ids originales; `merge` genera ids con `newId()` y remapea referencias (contactos de eventos, `clientId`, `placeId`, `goalId`, `members` de metas); los avances cuya meta no venga en el archivo se omiten. En `merge` los ajustes y las categorías usan `INSERT OR IGNORE` (no pisan el teléfono; `name` es UNIQUE). Archivos **sin módulos nuevos**: `expo-file-system` 57.0.7 (ya en el APK) trae `File.pickFileAsync({ mimeTypes })` → `{ canceled, result }` y `Directory.pickDirectoryAsync()` + `createFile`/`write`/`text`; el plan B es pegar el JSON o `Share` (solo < 200 000 caracteres). Límites: 10 MB, 20 000 filas, 5 000 por colección; `parseBackup` rechaza ids repetidos, fechas/horas inválidas y coordenadas fuera de rango antes de tocar la base. El perfil del archivo se devuelve pero **no** se aplica. Tras restaurar se relee `useCatalog` (eventTypes/templates viven en `settings`). Pruebas: `npm run test:local` → 83 comprobaciones (exportar → borrar → restaurar, fusión con remapeo y archivos inválidos). Agregar una ruta nueva obliga a regenerar `.expo/types/router.d.ts` (quirk 9); esta vez se regeneró llamando a `startTypescriptTypeGenerationAsync` del CLI de Expo, sin reiniciar Metro.
31. Salida de EAS (2026-10-28): la app **no** depende de la nube de EAS para producir el AAB. `npx expo prebuild --platform android` genera `android/` con los 6 plugins de `app.json` resueltos (expo-router, datetimepicker, localization, camera, notifications, sqlite) y los módulos de Expo se autolinkean igual que cualquier paquete nativo: el runtime es open source (MIT), solo la nube se deja. `android/` e `ios/` van en `mobile/.gitignore` (CNG); `app.json` sigue siendo la fuente de verdad (versión, `versionCode`, permisos, plugins) y **cambiar `app.json` no toca un `android/` ya generado**: hay que volver a `prebuild`. El release que genera prebuild firma con la **llave debug** (EAS la sustituía en la nube), así que `mobile/scripts/patch-signing.mjs` (idempotente) agrega un `signingConfigs.release` que lee `MYPLAN_KEYSTORE_PATH`, `MYPLAN_KEYSTORE_PASSWORD`, `MYPLAN_KEY_ALIAS` y `MYPLAN_KEY_PASSWORD`, y cae a debug si faltan; debe correr **después de cada prebuild**. Build: `.github/workflows/android-build.yml` (manual, `variant` aab|apk, `version_code` opcional, cache de Gradle, JDK 17 + SDK del runner; ~2000 min/mes gratis en repo privado) y `.github/workflows/android-keystore.yml` para crear el keystore de subida una vez sin instalar Java (el repo es **privado**, los artefactos solo los ve el dueño). En local no se pudo compilar: esta PC no tiene JDK ni Android SDK. Trampas: `prebuild` reescribe los scripts `android`/`ios` de `package.json` a `expo run:*` (se revirtieron a `expo start --*`); avisa que falta `expo-system-ui` para `userInterfaceStyle: automatic` (solo afecta el fondo nativo, el tema de la app es JS); sin `EXPO_PUBLIC_API_URL` en el entorno de build, el bundle apunta a `localhost`. `expo-dev-client` sigue en `dependencies` porque el APK de desarrollo lo necesita. Regla para Google Sign-In: agregar el **SHA-1 de Play App Signing** al cliente Android de Google Cloud o falla en builds de tienda. Guía: `docs/BUILD.md`.

## Pendientes concretos

- [x] `npx prisma migrate dev --name init` — hecho 2026-10-06 (previo: reset clave vía `trust` en pg_hba + `ALTER USER planner CREATEDB` para la shadow DB)
- [ ] Conectar login/registro del móvil al JWT — hecho en Fase 2 (gate en `_layout` + `useSession`)
- [x] Datos demo eliminables desde la app (2026-10-19): Perfil → "Datos de prueba" (ver Fase 8 en `FASES.md`).
- [ ] Iniciar git en la raíz (`git init`, primer commit de Fase 1)
- [x] Acceso invitado local (decidido 2026-10-06, hecho 2026-10-27): SQLite en el teléfono + "Entrar sin cuenta". Importación a cuenta (`POST /api/import`) hecha y verificada el mismo día (quirk 29).
- [x] Copia de seguridad del invitado (2026-10-28): exportar/restaurar JSON desde Perfil → "Copia de seguridad" (quirk 30). Pendiente: copia de la cuenta, ICS y recordatorio a los 30 días.
- [x] IP LAN automática (2026-10-16): `api.ts` deriva el host de Metro (`expoConfig.hostUri`) → la app sigue al Wi-Fi sin tocar `.env`. La IP se ve en Perfil ("Servidor: …").
- [x] APIs externas en planner: Nager.Date (feriados) + Open-Meteo (clima). Resto (Fixer, Nominatim, validación, GCal) en Fase 8/9.
- [x] Mapa: **MapLibre GL + OpenFreeMap** en WebView (`mobile/src/components/mapHtml.ts`). OpenFreeMap = gratis, sin API key, sin límite de peticiones y **con uso comercial permitido** (lo que hace falta para Play Store). Se descartaron: **Esri World Street Map** y **MapTiler free** (ambos solo uso NO comercial; MapTiler comercial = $30/mes) y **CARTO** (pide key). La key de Google **ya existe** en `mobile/.env` (`EXPO_PUBLIC_GOOGLE_MAPS_KEY`), pero el proyecto de Cloud **no tiene facturación**: Google responde "You must enable Billing on the Google Cloud Project" → Google Maps imposible hasta activarla. Si algún día hay dinero: Google/MapTiler y solo se cambia la URL del estilo. Package `app.myplan.today` (antes `com.plannertoday.app`; renombrado el 2026-10-20 **antes** del primer build porque Play Store no permite cambiarlo después).
- [x] Escáner: `OCRSPACE_KEY` configurada en `backend/.env` (2026-10-15) y verificada con HTTP 200 real.
