# AGENTS.md — My Plan

Dos paquetes independientes, sin workspace raíz. Instalar/ejecutar cada uno por separado.
Anfitrión Windows, PowerShell (`copy`, no `cp`).

## Estructura
- `mobile/` — Expo SDK 57 + TypeScript + Expo Router (basado en archivos). Entrada `expo-router/entry`.
  Rutas en `mobile/app/`: `_layout.tsx` (Stack raíz), `(tabs)/_layout.tsx`, `(tabs)/index|mapa|planificador|estadisticas`, `nuevo-registro.tsx` (modal), `perfil.tsx`, `backup.tsx` (copia del invitado), `(auth)/login|register`. Código compartido en `mobile/src/` (`theme/`, `components/`, `store/useAppStore.ts`, `services/`, `services/local/` para el modo invitado, `services/backup/`, `utils/`, `data/demo.ts`, `types/`).
- `backend/` — Express + TypeScript + Prisma + PostgreSQL. Puntos de entrada `src/index.ts` → `buildApp()` en `src/app.ts`. Rutas en `src/routes/`, lógica en `src/controllers/` + `src/services/`.
- `backend/prisma/schema.prisma` ya está completo (User, Contact, Sale, Expense, Task, Event, Goal, Place, Attachment, Notification, DailyStat, WeeklyStat, Setting). No agregar modelos por fase; reutilizar.

## Comandos
- Móvil: `cd mobile; npm install; npx expo start` (`a` = emulador Android). Verificar: `npm run typecheck` (`tsc --noEmit`) y `npm run test:local` (capa SQLite del invitado con SQL real, sin teléfono). Sin config de lint.
- Backend: `cd backend; copy .env.example .env; npm install; npx prisma generate; npx prisma migrate dev --name init` (requiere Postgres local en `localhost:5432`), luego `npm run dev` (`tsx watch`). Compilar: `npm run build` / `npm start`.
- Base API: `mobile/src/services/api.ts` deriva la IP LAN del PC desde Metro (`Constants.expoConfig.hostUri`) en desarrollo; `EXPO_PUBLIC_API_URL` es respaldo y el último fallback es `http://localhost:4000`. Endpoints: `GET /health`, `/api/auth/*`, `GET /api`.

## Detalles que rompen cosas
- El `+` central de tabs es un `tabBarButton` personalizado en `(tabs)/_layout.tsx`; `(tabs)/plus.tsx` es una ruta fantasma que redirige al modal `/nuevo-registro`. No renderizar pantalla ahí; editar `app/nuevo-registro.tsx`.
- Fechas: siempre hora local del dispositivo vía `mobile/src/utils/dates.ts` (`toLocalKey`, `formatLongEs`). Nunca usar UTC/`toISOString` para agrupar UI.
- Tema: usar tokens de `mobile/src/theme/colors.ts` (fondo crema, tarjetas blancas); no hardcodear paleta. Reutilizar `Card`, `SectionHeader`, `ProgressBar`, `DateSelector` de `mobile/src/components/`.
- Estado: Zustand `useAppStore.ts` con datos demo en `src/data/demo.ts` (ocultables desde Perfil con `demoCleared`). Claves `@planner/*` en `src/services/storage.ts`: `cache:*` (respuestas GET), `pendingOps` (cola de escrituras offline), `idMap` (`tmp_` → id real). Lógica offline pura en `src/services/syncCore.ts`, cola en `sync.ts`, integración en `api.ts`.
- Backend: toda consulta debe filtrar por `userId` (aislamiento por usuario). Auth vía `requireAuth` (`src/middleware/auth.ts`), JWT 15m + refresh 30d, bcrypt en `src/utils/`, validación con `zod`. Montar nuevos routers en `buildApp()` (`src/app.ts`).
- Registro con contraseña **cerrado** por defecto: `POST /api/auth/register` responde 403 salvo `ALLOW_PASSWORD_SIGNUP=true`. Las cuentas nuevas se crean con Google (`POST /api/auth/google`, `googleId`); el login con contraseña se mantiene para cuentas existentes. No agregar un alta con correo sin verificación.
- **Modo invitado** (sin cuenta, 100 % local): `useSession.mode` (`account` | `guest`, persistido en `@planner/mode`) y `api()` corta antes de la red y resuelve en `src/services/local/localApi.ts` contra **SQLite** (`expo-sqlite`, `myplan.db`). Nunca crear filas en PostgreSQL para un invitado. Las rutas locales deben devolver el **mismo JSON** que el backend; si se cambia un controller, actualizar su espejo en `src/services/local/`. Sin cola offline en invitado. Diseño y hitos en `docs/GUEST_MODE.md`.
- **Importación invitado → cuenta**: `POST /api/import` (`src/controllers/import.controller.ts`, autenticado, `importLimiter`) corre en **una transacción** y genera ids nuevos; `batchId` da idempotencia. El cuerpo sube hasta **6 MB** y se monta en `app.ts` **antes** del parser global de 1 MB. El móvil (`src/services/guestImport.ts` + `src/services/local/exportData.ts`) solo borra el SQLite tras `201`/`200`. Ojo: `Event` y `Place` no tienen `createdAt` en Prisma; los vínculos eventos↔contactos van a `_EventContacts` (`A` = contacto, `B` = evento) por bloques. Timeout de `/api/import` en `api.ts`: 180 s. La importación **no** usa la cola offline.
- El puntaje de productividad vive en `backend/src/services/productivity.service.ts` y está **duplicado** en `mobile/src/services/local/stats.ts` (invitado sin servidor) — si cambia la fórmula, cambiar las dos.
- Añadir un módulo nativo (como `expo-sqlite`) exige **nueva dev build EAS**; los cambios de JS posteriores entran por Metro.
- Alias `@/* → mobile/src/*` existe en `mobile/tsconfig.json`, pero las rutas de tabs usan imports relativos `../../src/`; ambas formas valen.
