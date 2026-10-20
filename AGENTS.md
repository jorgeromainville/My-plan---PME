# AGENTS.md — My Plan

Dos paquetes independientes, sin workspace raíz. Instalar/ejecutar cada uno por separado.
Anfitrión Windows, PowerShell (`copy`, no `cp`).

## Estructura
- `mobile/` — Expo 51 + TypeScript + Expo Router (basado en archivos). Entrada `expo-router/entry`.
  Rutas en `mobile/app/`: `_layout.tsx` (Stack raíz), `(tabs)/_layout.tsx`, `(tabs)/index|mapa|planificador|estadisticas`, `nuevo-registro.tsx` (modal), `perfil.tsx`, `(auth)/login|register`. Código compartido en `mobile/src/` (`theme/`, `components/`, `store/useAppStore.ts`, `services/`, `utils/`, `data/demo.ts`, `types/`).
- `backend/` — Express + TypeScript + Prisma + PostgreSQL. Puntos de entrada `src/index.ts` → `buildApp()` en `src/app.ts`. Rutas en `src/routes/`, lógica en `src/controllers/` + `src/services/`.
- `backend/prisma/schema.prisma` ya está completo (User, Contact, Sale, Expense, Task, Event, Goal, Place, Attachment, Notification, DailyStat, WeeklyStat, Setting). No agregar modelos por fase; reutilizar.

## Comandos
- Móvil: `cd mobile; npm install; npx expo start` (`a` = emulador Android). Verificar: `npm run typecheck` (`tsc --noEmit`). Sin config de lint/test.
- Backend: `cd backend; copy .env.example .env; npm install; npx prisma generate; npx prisma migrate dev --name init` (requiere Postgres local en `localhost:5432`), luego `npm run dev` (`tsx watch`). Compilar: `npm run build` / `npm start`.
- Base API: `mobile/src/services/api.ts` deriva la IP LAN del PC desde Metro (`Constants.expoConfig.hostUri`) en desarrollo; `EXPO_PUBLIC_API_URL` es respaldo y el último fallback es `http://localhost:4000`. Endpoints: `GET /health`, `/api/auth/*`, `GET /api`.

## Detalles que rompen cosas
- El `+` central de tabs es un `tabBarButton` personalizado en `(tabs)/_layout.tsx`; `(tabs)/plus.tsx` es una ruta fantasma que redirige al modal `/nuevo-registro`. No renderizar pantalla ahí; editar `app/nuevo-registro.tsx`.
- Fechas: siempre hora local del dispositivo vía `mobile/src/utils/dates.ts` (`toLocalKey`, `formatLongEs`). Nunca usar UTC/`toISOString` para agrupar UI.
- Tema: usar tokens de `mobile/src/theme/colors.ts` (fondo crema, tarjetas blancas); no hardcodear paleta. Reutilizar `Card`, `SectionHeader`, `ProgressBar`, `DateSelector` de `mobile/src/components/`.
- Estado: Zustand `useAppStore.ts` con datos demo en `src/data/demo.ts` (ocultables desde Perfil con `demoCleared`). Claves `@planner/*` en `src/services/storage.ts`: `cache:*` (respuestas GET), `pendingOps` (cola de escrituras offline), `idMap` (`tmp_` → id real). Lógica offline pura en `src/services/syncCore.ts`, cola en `sync.ts`, integración en `api.ts`.
- Backend: toda consulta debe filtrar por `userId` (aislamiento por usuario). Auth vía `requireAuth` (`src/middleware/auth.ts`), JWT 15m + refresh 30d, bcrypt en `src/utils/`, validación con `zod`. Montar nuevos routers en `buildApp()` (`src/app.ts`).
- El puntaje de productividad vive solo en `backend/src/services/productivity.service.ts` — no duplicar la fórmula en el frontend.
- Alias `@/* → mobile/src/*` existe en `mobile/tsconfig.json`, pero las rutas de tabs usan imports relativos `../../src/`; ambas formas valen.
