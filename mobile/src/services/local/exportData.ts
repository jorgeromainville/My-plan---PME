// Exportación del modo invitado para subirlo a una cuenta (`POST /api/import`).
//
// Solo se envían los campos que el backend acepta: los ids locales viajan como
// referencias (el servidor los reescribe) y `createdAt` se conserva donde el
// backend lo tiene (contactos, tareas, metas, ingresos, gastos y sus registros),
// para que el orden de las listas no cambie al migrar. Eventos y lugares no
// tienen `createdAt` en Prisma: se ordenan por su propio `date`/`name`.
import { all } from './db';

type Row = Record<string, unknown>;

export interface GuestExport {
  batchId: string;
  contacts: Row[];
  places: Row[];
  goals: Row[];
  tasks: Row[];
  events: Row[];
  incomes: Row[];
  expenses: Row[];
  goalLogs: Row[];
  contactCategories: { name: string; color: string | null }[];
  expenseCategories: { name: string; color: string | null }[];
  settings: { key: string; value: unknown }[];
}

function parseIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Arma el lote completo. Devuelve colecciones vacías si el invitado no creó nada. */
export async function buildGuestExport(batchId: string): Promise<GuestExport> {
  const [contacts, places, goals, tasks, events, incomes, expenses, goalLogs] = await Promise.all([
    all<Row>('SELECT * FROM contacts ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM places ORDER BY name ASC'),
    all<Row>('SELECT * FROM goals ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM tasks ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM events ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM incomes ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM expenses ORDER BY createdAt ASC'),
    all<Row>('SELECT * FROM goal_logs ORDER BY createdAt ASC'),
  ]);

  const links = await all<{ eventId: string; contactId: string }>(
    'SELECT eventId, contactId FROM event_contacts',
  );
  const linksByEvent = new Map<string, string[]>();
  for (const l of links) {
    const list = linksByEvent.get(l.eventId) ?? [];
    list.push(l.contactId);
    linksByEvent.set(l.eventId, list);
  }

  const contactCategories = await all<{ name: string; color: string | null }>(
    'SELECT name, color FROM contact_categories ORDER BY name ASC',
  );
  const expenseCategories = await all<{ name: string; color: string | null }>(
    'SELECT name, color FROM expense_categories ORDER BY name ASC',
  );
  const settings = await all<{ key: string; value: string }>('SELECT key, value FROM settings');

  return {
    batchId,
    contacts,
    places,
    goals: goals.map(({ members, ...g }) => ({ ...g, members: parseIds(members) })),
    tasks,
    // SQLite no tiene booleanos: `isBackup` y `done` llegan como 0/1 y el
    // backend los valida como boolean, así que se convierten aquí.
    events: events.map(({ id, isBackup, done, ...e }) => ({
      id,
      ...e,
      isBackup: !!isBackup,
      done: !!done,
      contactIds: linksByEvent.get(String(id)) ?? [],
    })),
    incomes,
    expenses,
    goalLogs,
    contactCategories,
    expenseCategories,
    settings: settings.map((s) => ({ key: s.key, value: parseJson(s.value) })),
  };
}
