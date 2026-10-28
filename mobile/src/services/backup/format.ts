// Formato del archivo de copia de seguridad del invitado.
//
// Es un JSON versionado que reutiliza la misma forma que ya entiende
// `POST /api/import`, para que restaurar en una cuenta más adelante no necesite
// otro formato. Aquí solo se valida y se normaliza lo mínimo; la conversión de
// tipos vive en `restoreGuest.ts`.
import { ApiError } from '../errors';
import { toLocalKey } from '../../utils/dates';

export const BACKUP_SCHEMA = 'myplan.backup/1';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_ROWS = 20000;
export const MAX_ROWS_PER_LIST = 5000;

export type BackupRow = Record<string, unknown>;

export interface BackupProfile {
  name: string;
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'andean' | 'auto';
  weekStartsOn: 'monday' | 'sunday';
}

export interface BackupData {
  contacts: BackupRow[];
  places: BackupRow[];
  goals: BackupRow[];
  tasks: BackupRow[];
  events: BackupRow[];
  incomes: BackupRow[];
  expenses: BackupRow[];
  goalLogs: BackupRow[];
  contactCategories: { name: string; color: string | null }[];
  expenseCategories: { name: string; color: string | null }[];
  settings: { key: string; value: unknown }[];
}

export interface BackupFile {
  schema: typeof BACKUP_SCHEMA;
  exportedAt: string;
  app: string;
  mode: 'guest' | 'account';
  batchId: string;
  profile?: BackupProfile;
  data: BackupData;
}

export interface BackupCounts {
  contacts: number;
  places: number;
  goals: number;
  tasks: number;
  events: number;
  incomes: number;
  expenses: number;
  goalLogs: number;
  total: number;
}

const LIST_KEYS = [
  'contacts',
  'places',
  'goals',
  'tasks',
  'events',
  'incomes',
  'expenses',
  'goalLogs',
] as const;

const CATEGORY_KEYS = ['contactCategories', 'expenseCategories'] as const;

function fail(message: string): never {
  throw new ApiError(400, message);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function listOf(v: unknown, label: string): unknown[] {
  if (v == null) return [];
  if (!Array.isArray(v)) fail(`La copia está dañada: ${label} no es una lista.`);
  if (v.length > MAX_ROWS_PER_LIST) {
    fail(`La copia tiene demasiados registros en ${label} (máximo ${MAX_ROWS_PER_LIST}).`);
  }
  return v;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function dateOk(v: unknown): boolean {
  return !Number.isNaN(new Date(String(v)).getTime());
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

function timeOk(v: unknown): boolean {
  return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
}

// Campos mínimos para que la restauración no reviente a mitad. Preferimos
// rechazar el archivo completo antes que dejar datos a medias.
const RULES: Record<(typeof LIST_KEYS)[number], { label: string; check: (row: BackupRow) => string | null }> = {
  contacts: {
    label: 'contactos',
    check: (r) => (text(r.firstName) ? null : 'no tiene nombre'),
  },
  places: {
    label: 'lugares',
    check: (r) => {
      if (!text(r.name)) return 'no tiene nombre';
      const lat = num(r.latitude);
      const lng = num(r.longitude);
      if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) {
        return 'no tiene una ubicación válida';
      }
      return null;
    },
  },
  goals: {
    label: 'metas',
    check: (r) => {
      if (!text(r.title)) return 'no tiene título';
      if (!(num(r.target) > 0)) return 'no tiene una meta mayor que cero';
      return null;
    },
  },
  tasks: {
    label: 'tareas',
    check: (r) => {
      if (!text(r.title)) return 'no tiene título';
      if (!dateOk(r.date)) return 'no tiene fecha válida';
      return null;
    },
  },
  events: {
    label: 'eventos',
    check: (r) => {
      if (!text(r.title)) return 'no tiene título';
      if (!dateOk(r.date)) return 'no tiene fecha válida';
      if (!timeOk(r.startTime) || !timeOk(r.endTime)) return 'no tiene horas válidas (HH:MM)';
      return null;
    },
  },
  incomes: {
    label: 'ingresos',
    check: (r) => {
      if (!text(r.title)) return 'no tiene título';
      if (!dateOk(r.date)) return 'no tiene fecha válida';
      if (!(num(r.unitPrice) >= 0)) return 'no tiene precio unitario válido';
      return null;
    },
  },
  expenses: {
    label: 'gastos',
    check: (r) => {
      if (!text(r.title)) return 'no tiene título';
      if (!dateOk(r.date)) return 'no tiene fecha válida';
      if (!(num(r.amount) >= 0)) return 'no tiene monto válido';
      return null;
    },
  },
  goalLogs: {
    label: 'avances de metas',
    check: (r) => {
      if (!text(r.goalId)) return 'no tiene meta';
      if (!dateOk(r.date)) return 'no tiene fecha válida';
      if (!(num(r.amount) > 0)) return 'no tiene cantidad válida';
      return null;
    },
  },
};

/** Cuenta los registros de una copia (sin categorías ni ajustes). */
export function backupCounts(data: BackupData): BackupCounts {
  const c: BackupCounts = {
    contacts: data.contacts.length,
    places: data.places.length,
    goals: data.goals.length,
    tasks: data.tasks.length,
    events: data.events.length,
    incomes: data.incomes.length,
    expenses: data.expenses.length,
    goalLogs: data.goalLogs.length,
    total: 0,
  };
  c.total =
    c.contacts +
    c.places +
    c.goals +
    c.tasks +
    c.events +
    c.incomes +
    c.expenses +
    c.goalLogs;
  return c;
}

/** Texto humano para los diálogos: "3 tareas, 2 eventos, 1 ingreso". */
export function describeBackup(counts: BackupCounts): string {
  const parts: string[] = [];
  const labels: [keyof BackupCounts, string][] = [
    ['tasks', 'tarea'],
    ['events', 'evento'],
    ['incomes', 'ingreso'],
    ['expenses', 'gasto'],
    ['goals', 'meta'],
    ['contacts', 'contacto'],
    ['places', 'lugar'],
    ['goalLogs', 'avance'],
  ];
  for (const [key, label] of labels) {
    const n = counts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${label}${n === 1 ? '' : 's'}`);
  }
  return parts.length ? parts.join(', ') : 'sin registros';
}

/** `myplan-2026-10-28.json` (fecha local del dispositivo). */
export function backupFileName(d = new Date()): string {
  return `myplan-${toLocalKey(d)}.json`;
}

/** Valida y normaliza un archivo de copia. Lanza `ApiError` 400 si no sirve. */
export function parseBackup(textContent: string): BackupFile {
  if (textContent.length > MAX_BACKUP_BYTES) {
    fail('El archivo es demasiado grande (máximo 10 MB).');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(textContent);
  } catch {
    fail('El archivo no es un JSON válido.');
  }
  if (!isObject(raw)) fail('La copia está vacía o no tiene el formato esperado.');
  if (raw.schema !== BACKUP_SCHEMA) {
    fail('El archivo no es una copia de My Plan o es de una versión más nueva de la app.');
  }
  const rawData = raw.data;
  if (!isObject(rawData)) fail('La copia no tiene datos.');

  const data = {} as BackupData;

  for (const key of LIST_KEYS) {
    const list = listOf(rawData[key], RULES[key].label);
    const seen = new Set<string>();
    list.forEach((row, i) => {
      if (!isObject(row)) fail(`La copia está dañada: ${RULES[key].label}, registro ${i + 1}.`);
      const problem = RULES[key].check(row);
      if (problem) {
        fail(`La copia está dañada: el ${RULES[key].label.slice(0, -1)} ${i + 1} ${problem}.`);
      }
      const id = text(row.id);
      if (id) {
        if (seen.has(id)) {
          fail(`La copia está dañada: hay ids repetidos en ${RULES[key].label}.`);
        }
        seen.add(id);
      }
    });
    data[key] = list as BackupRow[];
  }

  for (const key of CATEGORY_KEYS) {
    const list = listOf(rawData[key], key === 'contactCategories' ? 'categorías' : 'categorías de gastos');
    data[key] = list.map((row, i) => {
      if (!isObject(row) || !text(row.name)) {
        fail(`La copia está dañada: categoría ${i + 1} sin nombre.`);
      }
      return { name: text(row.name).slice(0, 40), color: row.color == null ? null : String(row.color).slice(0, 9) };
    });
  }

  const settings = listOf(rawData.settings, 'ajustes');
  data.settings = settings.map((row, i) => {
    if (!isObject(row) || !text(row.key)) {
      fail(`La copia está dañada: ajuste ${i + 1} sin nombre.`);
    }
    return { key: text(row.key).slice(0, 40), value: row.value ?? null };
  });

  const counts = backupCounts(data);
  if (counts.total > MAX_BACKUP_ROWS) {
    fail(`La copia tiene demasiados registros (${counts.total}; máximo ${MAX_BACKUP_ROWS}).`);
  }

  const mode = raw.mode === 'account' ? 'account' : 'guest';
  const exportedAt = typeof raw.exportedAt === 'string' && dateOk(raw.exportedAt)
    ? new Date(raw.exportedAt).toISOString()
    : new Date().toISOString();
  const app = text(raw.app).slice(0, 20) || '0.1.0';
  const batchId = text(raw.batchId) || '';

  const backup: BackupFile = {
    schema: BACKUP_SCHEMA,
    exportedAt,
    app,
    mode,
    batchId,
    data,
  };

  if (isObject(raw.profile)) {
    backup.profile = {
      name: text(raw.profile.name).slice(0, 80) || 'Invitado',
      currency: text(raw.profile.currency).toUpperCase().slice(0, 6) || 'PEN',
      currencySymbol: text(raw.profile.currencySymbol).slice(0, 6) || 'S/',
      theme:
        raw.profile.theme === 'light' ||
        raw.profile.theme === 'dark' ||
        raw.profile.theme === 'andean' ||
        raw.profile.theme === 'auto'
          ? raw.profile.theme
          : 'auto',
      weekStartsOn: raw.profile.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    };
  }

  return backup;
}
