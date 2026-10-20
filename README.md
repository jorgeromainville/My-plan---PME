# My Plan

## Qué incluye
- App Expo + TypeScript + Expo Router (tabs: Inicio, Mapa, +, Planificador, Estadísticas)
- Diseño crema original con tarjetas, DateSelector local, metas demo, personas demo
- Backend Express + Prisma + Auth JWT (register/login/me)

## Ejecutar app
```powershell
cd mobile
npm install
npx expo start
# a = Android emulator, w = web (solo debug), escanear QR en Expo Go
```

## Ejecutar backend
```powershell
cd backend
copy .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init  # requiere Postgres local
npm run dev
```

## Offline (Fase 1 preparada)
- `src/services/storage.ts`: AsyncStorage cache genérica
- Estrategia Fase 8: Last-Write-Wins por `updatedAt`, cola `pendingOps`, sync al recuperar red.

## Producción (nube)
- **Backend**: Render free → `https://my-plan-api.onrender.com` (deploy desde GitHub `jorgeromainville/My-plan---PME`).
- **Base de datos**: Neon Postgres `planner` (pooler, `us-east-1`). Las migraciones se aplican solas al arrancar (`prisma migrate deploy` en el start de Render).
- **Config de deploy**: `render.yaml` en la raíz (build, health check `/health`, variables). Los secretos se cargan en el dashboard de Render; el `.env` nunca se sube.
- **Móvil**: `mobile/.env` → `EXPO_PUBLIC_API_URL=https://my-plan-api.onrender.com`. Si la variable está definida, manda incluso en desarrollo.
- **Dormido**: Render free suspende el servicio a los 15 min sin tráfico (primer arranque 30–60 s). Mantenerlo despierto con un monitor gratuito (UptimeRobot / cron-job.org) golpeando `/health` cada 10 min, o pasar a plan Starter.
- **Volver a la DB local**: `Copy-Item backend/.env.local-backup backend/.env` y reiniciar el backend.
