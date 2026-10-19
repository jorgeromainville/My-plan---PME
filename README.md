# Planner Today — Fase 1

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
