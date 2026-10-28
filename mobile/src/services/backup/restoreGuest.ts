// Restauración de una copia JSON en el modo invitado (SQLite).
//
// Dos modos:
//  - `replace`: borra todas las tablas y deja la base igual que el archivo
//    (conserva los ids, así que los vínculos no cambian).
//  - `merge`: agrega registros con ids nuevos y remapea las referencias, igual
//    que hace el servidor en `POST /api/import`. Nunca borra nada.
//
// Todo ocurre en una transacción: si una fila falla, la base queda como estaba.
// El perfil del archivo se devuelve pero no se aplica (nombre, moneda y tema se
// cambian desde Perfil).
import { clearDataTables, insertRow, newId, nowIso, run, tx } from '../local/db';
import { asBool, asNumber, optionalIso, round2, toIso } from '../local/query';
import type { BackupCounts, BackupFile, BackupProfile, BackupRow } from './format';

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  mode: RestoreMode;
  inserted: BackupCounts;
  profile?: BackupProfile;
}

const PRIORITIES = ['baja', 'media', 'alta'];
const TASK_STATUSES = ['pendiente', 'en_progreso', 'completada'];
const REPEATS = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'mon_wed',
  'tue_thu',
  'mon_wed_fri',
  'weekdays',
  'weekends',
];
const GOAL_KINDS = ['ingresos', 'contactos', 'tareas', 'horas', 'veces', 'custom'];
const GOAL_PERIODS = ['day', 'week', 'month'];
const GOAL_STATUSES = ['activa', 'pausada', 'completada'];
const PAY_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro'];

// ── Coerciones tolerantes ────────────────────────────────────────────────────
// La validación de `format.ts` ya rechazó lo esencial; aquí solo normalizamos
// para que ninguna fila rompa la transacción por un detalle de tipo.

function txt(v: unknown, max = 200): string {
  const raw = typeof v === 'string' ? v : v == null ? '' : String(v);
  return raw.trim().slice(0, max);
}

function opt(v: unknown, max = 200): string | null {
  const s = txt(v, max);
  return s ? s : null;
}

function pick(v: unknown, allowed: string[], fallback: string): string {
  const s = txt(v, 40);
  return allowed.includes(s) ? s : fallback;
}

/** Fecha ISO válida o el respaldo (no revienta por un `createdAt` raro). */
function isoOr(v: unknown, fallback: string): string {
  try {
    return optionalIso(v) ?? fallback;
  } catch {
    return fallback;
  }
}

function isoOrNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  try {
    return optionalIso(v);
  } catch {
    return null;
  }
}

function nonNegative(v: unknown): number {
  return Math.max(0, asNumber(v, 0));
}

function optNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = asNumber(v, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

// ── Ids ──────────────────────────────────────────────────────────────────────

type IdMap = Map<string, string>;

/** Id viejo → id que se usará en SQLite (el mismo en `replace`, nuevo en `merge`). */
function buildMap(rows: BackupRow[], mode: RestoreMode): IdMap {
  const map: IdMap = new Map();
  for (const row of rows) {
    const old = txt(row.id, 60);
    if (!old || map.has(old)) continue;
    map.set(old, mode === 'replace' ? old : newId());
  }
  return map;
}

function idFor(map: IdMap, row: BackupRow): string {
  const old = txt(row.id, 60);
  return (old && map.get(old)) || newId();
}

function refTo(map: IdMap, v: unknown): string | null {
  const old = txt(v, 60);
  return old ? map.get(old) ?? null : null;
}

function refList(map: IdMap, v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const id = refTo(map, item);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

// ── Restauración ─────────────────────────────────────────────────────────────

export async function restoreGuest(
  backup: BackupFile,
  mode: RestoreMode = 'merge',
): Promise<RestoreResult> {
  const data = backup.data;
  const contacts = buildMap(data.contacts, mode);
  const places = buildMap(data.places, mode);
  const goals = buildMap(data.goals, mode);
  const tasks = buildMap(data.tasks, mode);
  const events = buildMap(data.events, mode);
  const incomes = buildMap(data.incomes, mode);
  const expenses = buildMap(data.expenses, mode);
  const goalLogs = buildMap(data.goalLogs, mode);

  const inserted: BackupCounts = {
    contacts: 0,
    places: 0,
    goals: 0,
    tasks: 0,
    events: 0,
    incomes: 0,
    expenses: 0,
    goalLogs: 0,
    total: 0,
  };

  await tx(async () => {
    if (mode === 'replace') await clearDataTables();

    // Contactos
    for (const row of data.contacts) {
      const created = isoOr(row.createdAt, nowIso());
      await insertRow('contacts', {
        id: idFor(contacts, row),
        firstName: txt(row.firstName, 80) || 'Sin nombre',
        lastName: opt(row.lastName, 80),
        phone: opt(row.phone, 30),
        whatsapp: opt(row.whatsapp, 30),
        email: opt(row.email, 120),
        address: opt(row.address, 200),
        latitude: optNumber(row.latitude),
        longitude: optNumber(row.longitude),
        category: txt(row.category, 40) || 'Otros',
        notes: opt(row.notes, 1000),
        lastContactAt: isoOrNull(row.lastContactAt),
        nextContactAt: isoOrNull(row.nextContactAt),
        createdAt: created,
        updatedAt: isoOr(row.updatedAt, created),
      });
      inserted.contacts += 1;
    }

    // Lugares
    for (const row of data.places) {
      await insertRow('places', {
        id: idFor(places, row),
        name: txt(row.name, 120) || 'Sin nombre',
        category: txt(row.category, 40) || 'Personalizado',
        address: opt(row.address, 200),
        latitude: asNumber(row.latitude, 0),
        longitude: asNumber(row.longitude, 0),
        note: opt(row.note, 500),
        color: opt(row.color, 20),
        createdAt: isoOr(row.createdAt, nowIso()),
      });
      inserted.places += 1;
    }

    // Metas (los miembros apuntan a contactos)
    for (const row of data.goals) {
      const created = isoOr(row.createdAt, nowIso());
      const members = refList(contacts, Array.isArray(row.members) ? row.members : row.memberIds);
      await insertRow('goals', {
        id: idFor(goals, row),
        title: txt(row.title, 120) || 'Meta',
        kind: pick(row.kind, GOAL_KINDS, 'custom'),
        filter: opt(row.filter, 60),
        members: members.length ? JSON.stringify(members) : null,
        period: pick(row.period, GOAL_PERIODS, 'day'),
        target: Math.max(0, asNumber(row.target, 0)),
        current: nonNegative(row.current),
        unit: txt(row.unit, 20) || 'u',
        deadline: isoOrNull(row.deadline),
        status: pick(row.status, GOAL_STATUSES, 'activa'),
        createdAt: created,
        updatedAt: isoOr(row.updatedAt, created),
      });
      inserted.goals += 1;
    }

    // Tareas (contacto y meta)
    for (const row of data.tasks) {
      const created = isoOr(row.createdAt, nowIso());
      await insertRow('tasks', {
        id: idFor(tasks, row),
        title: txt(row.title, 120) || 'Tarea',
        date: toIso(row.date),
        time: row.time ? txt(row.time, 5) : null,
        priority: pick(row.priority, PRIORITIES, 'media'),
        category: txt(row.category, 40) || 'General',
        description: opt(row.description, 1000),
        status: pick(row.status, TASK_STATUSES, 'pendiente'),
        contactId: refTo(contacts, row.contactId),
        goalId: refTo(goals, row.goalId),
        createdAt: created,
        updatedAt: isoOr(row.updatedAt, created),
      });
      inserted.tasks += 1;
    }

    // Eventos + vínculos con contactos
    for (const row of data.events) {
      const created = isoOr(row.createdAt, nowIso());
      const eventId = idFor(events, row);
      await insertRow('events', {
        id: eventId,
        title: txt(row.title, 120) || 'Evento',
        type: txt(row.type, 40) || 'Evento',
        color: opt(row.color, 20),
        isBackup: asBool(row.isBackup) ? 1 : 0,
        date: toIso(row.date),
        startTime: txt(row.startTime, 5),
        endTime: txt(row.endTime, 5),
        location: opt(row.location, 200),
        placeId: refTo(places, row.placeId),
        description: opt(row.description, 1000),
        notifyMins: Math.max(0, Math.round(asNumber(row.notifyMins, 30))),
        repeat: pick(row.repeat, REPEATS, 'none'),
        repeatUntil: isoOrNull(row.repeatUntil),
        goalId: refTo(goals, row.goalId),
        done: asBool(row.done) ? 1 : 0,
        createdAt: created,
        updatedAt: isoOr(row.updatedAt, created),
      });
      for (const contactId of refList(contacts, row.contactIds)) {
        await run('INSERT OR IGNORE INTO event_contacts (eventId, contactId) VALUES (?, ?)', [
          eventId,
          contactId,
        ]);
      }
      inserted.events += 1;
    }

    // Ingresos (cliente)
    for (const row of data.incomes) {
      const created = isoOr(row.createdAt, nowIso());
      const quantity = asNumber(row.quantity, 1) || 1;
      const unitPrice = nonNegative(row.unitPrice);
      await insertRow('incomes', {
        id: idFor(incomes, row),
        date: toIso(row.date),
        title: txt(row.title, 120) || 'Ingreso',
        category: txt(row.category, 40) || 'General',
        quantity,
        unitPrice,
        total: round2(quantity * unitPrice),
        clientId: refTo(contacts, row.clientId),
        payMethod: pick(row.payMethod, PAY_METHODS, 'Efectivo'),
        note: opt(row.note, 500),
        createdAt: created,
        updatedAt: isoOr(row.updatedAt, created),
      });
      inserted.incomes += 1;
    }

    // Gastos
    for (const row of data.expenses) {
      await insertRow('expenses', {
        id: idFor(expenses, row),
        date: toIso(row.date),
        title: txt(row.title, 120) || 'Gasto',
        category: txt(row.category, 40) || 'Otros',
        amount: nonNegative(row.amount),
        kind: txt(row.kind, 20) === 'fijo' ? 'fijo' : 'variable',
        note: opt(row.note, 500),
        createdAt: isoOr(row.createdAt, nowIso()),
      });
      inserted.expenses += 1;
    }

    // Avances de metas (si la meta no está en el archivo, no se puede colgar)
    for (const row of data.goalLogs) {
      const goalId = refTo(goals, row.goalId);
      if (!goalId) continue;
      await insertRow('goal_logs', {
        id: idFor(goalLogs, row),
        goalId,
        date: toIso(row.date),
        amount: Math.max(0.01, asNumber(row.amount, 0)),
        note: opt(row.note, 200),
        createdAt: isoOr(row.createdAt, nowIso()),
      });
      inserted.goalLogs += 1;
    }

    // Categorías personalizadas: nunca duplican el nombre (UNIQUE)
    const categories: { table: string; rows: { name: string; color: string | null }[] }[] = [
      { table: 'contact_categories', rows: data.contactCategories },
      { table: 'expense_categories', rows: data.expenseCategories },
    ];
    for (const group of categories) {
      for (const cat of group.rows) {
        await run(
          `INSERT OR IGNORE INTO ${group.table} (id, name, color, createdAt) VALUES (?, ?, ?, ?)`,
          [newId(), txt(cat.name, 40), opt(cat.color, 20), nowIso()],
        );
      }
    }

    // Ajustes: en `merge` solo se agregan los que faltan, para no pisar los del
    // teléfono; en `replace` la base quedó vacía y manda el archivo.
    for (const setting of data.settings) {
      const key = txt(setting.key, 40);
      if (!key) continue;
      const raw = JSON.stringify(setting.value ?? null);
      await run(
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
          : 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        [key, raw],
      );
    }
  });

  inserted.total =
    inserted.contacts +
    inserted.places +
    inserted.goals +
    inserted.tasks +
    inserted.events +
    inserted.incomes +
    inserted.expenses +
    inserted.goalLogs;
  // `goalLogs` puede ser menor que el archivo si había avances huérfanos.

  return { mode, inserted, profile: backup.profile };
}
