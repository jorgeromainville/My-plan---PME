// Base local del modo invitado (SQLite con expo-sqlite).
//
// Se abre de forma perezosa y tolerante: si el binario de la app no trae el
// módulo nativo (build vieja), el error se explica en español y el resto de la
// app sigue funcionando en modo cuenta.
//
// Fechas: TEXT ISO 8601 UTC (`toISOString()`), igual que el backend. Comparar
// texto ISO equivale a comparar fechas, así que los rangos son `>= ?` / `<= ?`.
import { ApiError } from '../errors';

type Database = import('expo-sqlite').SQLiteDatabase;
export type BindValue = string | number | null;

const DB_NAME = 'myplan.db';
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  priority TEXT NOT NULL DEFAULT 'media',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  contactId TEXT,
  goalId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Evento',
  color TEXT,
  isBackup INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  location TEXT,
  placeId TEXT,
  description TEXT,
  notifyMins INTEGER NOT NULL DEFAULT 30,
  repeat TEXT NOT NULL DEFAULT 'none',
  repeatUntil TEXT,
  goalId TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_goal ON events(goalId);

CREATE TABLE IF NOT EXISTS event_contacts (
  eventId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  PRIMARY KEY (eventId, contactId)
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  quantity REAL NOT NULL DEFAULT 1,
  unitPrice REAL NOT NULL,
  total REAL NOT NULL,
  clientId TEXT,
  payMethod TEXT NOT NULL DEFAULT 'Efectivo',
  note TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Otros',
  amount REAL NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variable',
  note TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'custom',
  filter TEXT,
  members TEXT,
  period TEXT NOT NULL DEFAULT 'day',
  target REAL NOT NULL,
  current REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'u',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'activa',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_logs (
  id TEXT PRIMARY KEY NOT NULL,
  goalId TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_logs_goal ON goal_logs(goalId, date);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY NOT NULL,
  firstName TEXT NOT NULL,
  lastName TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  category TEXT NOT NULL DEFAULT 'Otros',
  notes TEXT,
  lastContactAt TEXT,
  nextContactAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_next ON contacts(nextContactAt);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Personalizado',
  address TEXT,
  latitude REAL,
  longitude REAL,
  note TEXT,
  color TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

const DATA_TABLES = [
  'tasks',
  'events',
  'event_contacts',
  'incomes',
  'expenses',
  'goals',
  'goal_logs',
  'contacts',
  'places',
  'contact_categories',
  'expense_categories',
  'settings',
];

let openPromise: Promise<Database> | null = null;

async function openDatabase(): Promise<Database> {
  let mod: typeof import('expo-sqlite');
  try {
    mod = await import('expo-sqlite');
  } catch {
    throw new ApiError(
      503,
      'Esta versión de la app no incluye la base local. Instala la última versión para usar el modo invitado.',
    );
  }
  const db = await mod.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}

async function migrate(db: Database): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;
  await db.withTransactionAsync(async () => {
    if (version === 0) await db.execAsync(SCHEMA_SQL);
    // Próximas migraciones: `if (version < 2) { ... }` (nunca borrar columnas a mano).
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

/** Conexión lista (abre y migra la primera vez). */
export function db(): Promise<Database> {
  if (injected) return Promise.resolve(injected);
  if (!openPromise) {
    openPromise = openDatabase().catch((e) => {
      openPromise = null;
      throw e;
    });
  }
  return openPromise;
}

// ── Solo para pruebas en Node ────────────────────────────────────────────────
// `scripts/local.test.ts` inyecta un adaptador sobre `node:sqlite` con la misma
// forma que expo-sqlite (getAllAsync/getFirstAsync/runAsync/execAsync/tx).
let injected: Database | null = null;

export function __injectDatabase(database: unknown): void {
  injected = database as Database;
  openPromise = null;
}

export async function all<T>(sql: string, params: BindValue[] = []): Promise<T[]> {
  const d = await db();
  return d.getAllAsync<T>(sql, params as never);
}

export async function one<T>(sql: string, params: BindValue[] = []): Promise<T | null> {
  const d = await db();
  return d.getFirstAsync<T>(sql, params as never);
}

export async function run(sql: string, params: BindValue[] = []): Promise<void> {
  const d = await db();
  await d.runAsync(sql, params as never);
}

export async function tx(fn: () => Promise<void>): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(fn);
}

/** Id local con forma de cuid (nunca empieza por `tmp_`, que es de la cola offline). */
export function newId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Inserta una fila a partir de un objeto plano (claves controladas por nosotros). */
export async function insertRow(table: string, values: Record<string, string | number | null>): Promise<void> {
  const keys = Object.keys(values);
  await run(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => values[k]),
  );
}

/** UPDATE parcial: solo las claves presentes en `body`; `conv` traduce el valor. */
export async function updateRow(
  table: string,
  id: string,
  body: Record<string, unknown>,
  conv: Record<string, (v: unknown) => string | number | null>,
): Promise<void> {
  const sets: string[] = [];
  const params: BindValue[] = [];
  for (const [key, fn] of Object.entries(conv)) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(fn(body[key]));
    }
  }
  if (!sets.length) return;
  params.push(id);
  await run(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Cuántos registros creó el invitado (para ofrecer la migración al crear cuenta). */
export async function countLocalRows(): Promise<number> {
  const rows = await all<{ n: number }>(
    `SELECT (
       (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM events) +
       (SELECT COUNT(*) FROM incomes) + (SELECT COUNT(*) FROM expenses) +
       (SELECT COUNT(*) FROM goals) + (SELECT COUNT(*) FROM contacts) +
       (SELECT COUNT(*) FROM places)
     ) AS n`,
  );
  return rows[0]?.n ?? 0;
}

/** Borra todas las tablas de datos. No abre transacción: lo decide quien llama. */
export async function clearDataTables(): Promise<void> {
  for (const table of DATA_TABLES) {
    await run(`DELETE FROM ${table}`);
  }
}

/** Borra todos los datos locales (equivale a "eliminar mi cuenta" en invitado). */
export async function resetLocalData(): Promise<void> {
  await tx(clearDataTables);
}
