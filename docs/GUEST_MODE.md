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

## Migración invitado → cuenta (hito 5, hecha)

Contrato: `POST /api/import` (autenticado, `importLimiter` 10/h/IP, cuerpo hasta 6 MB)
recibe `{ batchId, contacts, places, goals, tasks, events, incomes, expenses,
goalLogs, contactCategories, expenseCategories, settings }`.

1. Al entrar con Google (login o registro) con datos locales, la app pregunta una vez
   por ejecución: **Subir ahora / Ahora no / No preguntar más**. Perfil siempre deja
   la tarjeta "Datos en este teléfono" con subir o borrar.
2. El servidor inserta **todo en una transacción** (`timeout` 120 s) y genera ids
   nuevos (uuid) reescribiendo referencias: `contactId`/`clientId`, `placeId`,
   `goalId`, `members` de metas y la relación eventos↔contactos.
3. `batchId` (uuid) da idempotencia: se guarda en `Setting` como `import:<batchId>`;
   un reenvío responde `200 { duplicate: true }` sin duplicar. El móvil conserva el
   id en `@planner/importBatchId` hasta que la subida confirma.
4. Los ajustes (`eventTypes`, `templates`) solo se crean si la cuenta no los tiene;
   las categorías se insertan con `skipDuplicates` (nunca pisan el color existente).
5. Solo con `201`/`200` se borra el SQLite del teléfono (`resetLocalData`). Si falla,
   los datos siguen ahí y se puede reintentar (sin duplicar).
6. Nunca se sube sin confirmación: son datos del usuario.

Detalles de implementación que importan:

- La tabla puente implícita de Prisma es `_EventContacts` (`A` = `Contact.id`,
  `B` = `Event.id`). Los vínculos se insertan en bruto por bloques de 400 pares
  (`INSERT ... ON CONFLICT DO NOTHING`) porque un `create` por evento costaba ~450 ms
  de ida y vuelta a Neon. Hay comprobación con `to_regclass` y un camino de respaldo
  evento por evento por si el esquema cambiara.
- SQLite no tiene booleanos: `isBackup` y `done` se convierten a `true`/`false` al
  exportar (zod los valida como boolean).
- `Event` y `Place` **no** tienen `createdAt` en Prisma (los demás sí): no enviarlos
  al servidor ni asumirlos en el orden.
- Límites: 3000 por colección y 8000 registros por envío; por encima responde 413/400
  y el móvil muestra el aviso (no borra nada).
- El timeout del móvil para `/api/import` es 180 s (el normal es 8 s).
- Verificado de punta a punta contra Neon: lote generado por la exportación real del
  móvil (contactos, lugar, meta con miembros, tarea, evento con 2 contactos y respaldo,
  ingreso, gasto y registro de meta), remapeo de ids, totales, reenvío idempotente,
  400 inválido y 401 sin token. Usuario de prueba borrado (cascada).

## Copias de seguridad del invitado (hito 6, hecho)

Perfil → **Copia de seguridad** (`/backup`) exporta y restaura todo el SQLite.

- **Formato**: `{ schema: "myplan.backup/1", exportedAt, app, mode: "guest", batchId,
  profile, data }`. `data` tiene la misma forma que el cuerpo de `POST /api/import`
  (contactos, lugares, metas, tareas, eventos con `contactIds`, ingresos, gastos,
  avances, categorías y ajustes), así que el mismo archivo servirá para subirlo a una
  cuenta sin convertir nada. `batchId` permite que el servidor no duplique al reenviar.
- **Límites**: 10 MB, 20 000 filas y 5 000 por colección. `parseBackup` valida
  esquema, tipos, fechas, horas, coordenadas e ids repetidos **antes** de tocar la
  base; un archivo inválido se rechaza entero con un mensaje en español.
- **Guardar**: `expo-file-system` 57 ya trae selector de carpetas
  (`Directory.pickDirectoryAsync`) y de archivos (`File.pickFileAsync`), así que **no
  hace falta una build nueva**. Si una build vieja no los tiene, la pantalla ofrece
  pegar el JSON o compartirlo como texto (RN `Share`, copias pequeñas).
- **Restaurar**: se muestra el resumen (fecha de la copia y registros) y se elige:
  - **Fusionar**: agrega con ids nuevos y remapea referencias; nunca borra ni pisa
    ajustes existentes (categorías por nombre con `INSERT OR IGNORE`).
  - **Reemplazar**: vacía las tablas (`clearDataTables`, sin transacción propia) y
    deja la copia con sus ids originales. Pide confirmación.
  Todo va en una transacción: si algo falla, la base queda como estaba. El perfil del
  archivo (nombre, moneda, tema) se devuelve pero **no** se aplica.
- **Pruebas**: `npm run test:local` incluye exportar → borrar → restaurar, fusión con
  remapeo de vínculos, ajustes que no se pisan y archivos inválidos (83 comprobaciones).

## Hitos

- [x] Documento y decisión de arquitectura.
- [x] `expo-sqlite` + esquema + helpers.
- [x] Enrutador local: tareas, eventos, ingresos, gastos, contactos, lugares, metas,
      catálogos, ajustes, estadísticas y perfil del invitado.
- [x] `useSession.mode`, ruteo en `api()`, login "Entrar sin cuenta", Perfil invitado.
- [x] Importación a cuenta (`POST /api/import`) y borrado del local tras migrar.
- [x] Pruebas funcionales de la capa local con SQL real (`npm run test:local`, `node:sqlite`): tareas, contactos, ingresos, gastos, eventos, metas, lugares, categorías, estadísticas y errores. 83 comprobaciones.
- [ ] Pruebas de volumen (5 000 eventos) y de migración de esquema.
- [x] Copia de seguridad manual a archivo (exportar/restaurar JSON) — ver arriba.
- [ ] Copia desde una cuenta (exportar por API y restaurar con `/api/import`, solo fusionar), ICS y recordatorio a los 30 días.

## Riesgos y límites

- **Reinstalar la app borra el SQLite.** Perfil → "Copia de seguridad" permite guardar
  un archivo antes; si no se guarda, los datos se pierden.
- **Sin respaldo automático**: si el teléfono se pierde, los datos se pierden. La copia
  es manual (recordatorio a los 30 días, pendiente). Es el precio de "solo en tu
  celular" y debe estar en la política de privacidad.
- Un build nuevo hace falta al añadir un módulo nativo (`expo-sqlite`). Los cambios de
  JS posteriores siguen entrando por Metro.
- `expo-sqlite` no funciona en web; el modo invitado es solo Android/iOS.
