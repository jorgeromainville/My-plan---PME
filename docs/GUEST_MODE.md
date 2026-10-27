---
title: Modo invitado — My Plan
---

# Modo invitado (100 % local)

Objetivo: poder usar My Plan **sin cuenta y sin internet**, con los datos guardados
solo en el teléfono. Un invitado **nunca** crea filas en PostgreSQL.

## Decisiones

- **SQLite en el teléfono** (`expo-sqlite`, archivo `myplan.db`) como fuente de verdad
  del invitado. No se usa `.json` en AsyncStorage: crece mal y no permite consultas
  por rango (tareas/eventos/estadísticas).
- **Una sola capa de datos para la UI.** Las pantallas ya llaman a `api()`; en modo
  invitado esas mismas rutas (`/api/tasks`, `/api/events`, …) se resuelven contra
  SQLite con los **mismos formatos de respuesta** que el backend. Así no hay que
  reescribir pantallas ni duplicar tipos.
- **Sin cola offline en invitado**: escribir en SQLite es instantáneo, no hay nada
  que sincronizar. La cola (`sync.ts`) sigue existiendo solo para cuentas.
- **La nube no es requisito** para usar la app. Escáner con IA/OCR y funciones que
  dependen del servidor avisan que necesitan cuenta (no fallan en silencio).
- **Nada de cuentas "invitadas" en el servidor**: eso volvería al problema de llenar
  la base con usuarios basura.

## Arquitectura

```
pantalla  ──►  services/api.ts  ──►  ¿modo invitado?  ──►  services/local/*  ──►  SQLite
                                          │
                                          └── no ──►  fetch(API_BASE) + caché/cola
```

- `src/services/sessionMode.ts`: modo actual (`account` | `guest`), persistido en
  `@planner/mode`.
- `src/services/local/db.ts`: apertura perezosa, migraciones por `PRAGMA user_version`
  y helpers (`all`, `one`, `run`, `tx`).
- `src/services/local/localApi.ts`: enrutador que imita el backend.
- `src/services/local/<entidad>.ts`: tareas, eventos, ingresos, gastos, metas,
  contactos, lugares, catálogos, ajustes y estadísticas.
- `src/services/guestProfile.ts`: perfil del invitado (nombre, moneda, tema, inicio de
  semana) para que Perfil y las estadísticas funcionen igual.

La importación de `expo-sqlite` es **perezosa**: si una build antigua no trae el módulo
nativo, la app sigue abriendo en modo cuenta y el invitado muestra un aviso claro en
vez de romperse.

## Esquema local (v1)

Tablas espejo del backend, sin `userId` (hay un solo dueño: el teléfono):

| Tabla | Notas |
|---|---|
| `tasks` | `date` ISO, `time` "HH:MM", `status`, `priority` |
| `events` + `event_contacts` | `date` ISO, horas "HH:MM", `repeat`, `repeatUntil`, `goalId`, `placeId` |
| `incomes` | `total` calculado (cantidad × precio) |
| `expenses` | `kind` fijo/variable |
| `goals` + `goal_logs` | `members` como JSON, `current` manual si `kind = custom` |
| `contacts` | `lastContactAt`, `nextContactAt` |
| `places` | coordenadas obligatorias (como el backend) |
| `contact_categories`, `expense_categories` | personalizadas; las del sistema viven en código |
| `settings` | clave/valor JSON (`eventTypes`, `templates`) |

Fechas: se guardan como ISO 8601 UTC (`toISOString()`), igual que el backend. Los
filtros por rango comparan texto ISO, que ordena igual que la fecha. La UI sigue
trabajando con la fecha local del dispositivo (`src/utils/dates.ts`).

## Compatibilidad con el backend

El enrutador replica el contrato observable:

- Mismas claves (`{ tasks }`, `{ task }`, `{ goals }`, `{ ok: true }`, …).
- Mismos totales (`incomes.total`, `expenses.total`, `finance/summary`).
- Mismas reglas: una meta calcula su avance del período; contacto con ingresos no se
  borra; categorías del sistema no se eliminan; `touch` limpia el próximo contacto.
- Errores con el mismo `status` y mensajes en español (`ApiError`), para que
  `errorMessage()` siga mostrando algo útil.

La única diferencia deliberada: en invitado **no hay** `productivity` calculada por el
servidor; `stats/overview` usa la misma fórmula (`productivity.service.ts`) portada al
cliente. Si la fórmula cambia en el backend, hay que actualizar `local/stats.ts`.

## Flujo de uso

1. Login → **Entrar sin cuenta**.
2. `useSession.mode = 'guest'`, sin token. `_layout` no exige sesión.
3. Toda lectura/escritura pasa por `localApi` → SQLite.
4. Perfil muestra "Modo invitado" y oculta contraseña/eliminar cuenta; "Salir del modo
   invitado" vuelve al login **sin borrar** los datos locales (se recuperan al volver).
5. "Crear cuenta" lleva al login de Google con los datos locales intactos.

## Migración invitado → cuenta (pendiente, hito 5)

1. Al entrar con Google con datos locales, preguntar: conservar / subir / descartar.
2. `POST /api/import` (nuevo, autenticado) recibe un lote y lo inserta en **una
   transacción**, con ids temporales reescritos y `userId` del token.
3. Solo si el servidor confirma, borrar el SQLite local (o marcarlo como migrado).
4. Nunca subir automáticamente sin confirmación: son datos del usuario.

## Hitos

- [x] Documento y decisión de arquitectura.
- [x] `expo-sqlite` + esquema + helpers.
- [x] Enrutador local: tareas, eventos, ingresos, gastos, contactos, lugares, metas,
      catálogos, ajustes, estadísticas y perfil del invitado.
- [x] `useSession.mode`, ruteo en `api()`, login "Entrar sin cuenta", Perfil invitado.
- [ ] Importación a cuenta (`POST /api/import`) y borrado del local tras migrar.
- [x] Pruebas funcionales de la capa local con SQL real (`npm run test:local`, `node:sqlite`): tareas, contactos, ingresos, gastos, eventos, metas, lugares, categorías, estadísticas y errores. 53 comprobaciones.
- [ ] Pruebas de volumen (5 000 eventos) y de migración de esquema.
- [ ] Copia de seguridad manual a archivo (exportar/importar JSON) — opcional.

## Riesgos y límites

- **Reinstalar la app borra el SQLite.** Avisar en Perfil; el respaldo llega con la
  exportación manual o al crear cuenta.
- **Sin respaldo automático**: si el teléfono se pierde, los datos se pierden. Es el
  precio de "solo en tu celular" y debe estar en la política de privacidad.
- Un build nuevo hace falta al añadir un módulo nativo (`expo-sqlite`). Los cambios de
  JS posteriores siguen entrando por Metro.
- `expo-sqlite` no funciona en web; el modo invitado es solo Android/iOS.
