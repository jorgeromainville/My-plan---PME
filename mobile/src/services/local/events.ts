// Eventos en SQLite: mismo contrato que `backend/src/controllers/events.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, tx, updateRow } from './db';
import { asBool, asNumber, asString, optionalIso, rangeSql, requireText, toIso } from './query';

type EventDbRow = {
  id: string;
  title: string;
  type: string;
  color: string | null;
  isBackup: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  placeId: string | null;
  description: string | null;
  notifyMins: number;
  repeat: string;
  repeatUntil: string | null;
  goalId: string | null;
  done: number;
  createdAt: string;
  updatedAt: string;
};

export type EventOut = Omit<EventDbRow, 'isBackup' | 'done'> & {
  isBackup: boolean;
  done: boolean;
  contacts?: { id: string; firstName: string; lastName?: string | null }[];
};

export type EventContactRef = { id: string; firstName: string; lastName?: string | null };

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

function toOut(row: EventDbRow): EventOut {
  return { ...row, isBackup: row.isBackup === 1, done: row.done === 1 };
}

function horario(v: unknown, field: string): string {
  const s = asString(v);
  if (!/^\d{2}:\d{2}$/.test(s)) throw new ApiError(400, `${field} debe ser HH:MM`);
  return s;
}

async function setContacts(eventId: string, ids: string[]): Promise<void> {
  await run('DELETE FROM event_contacts WHERE eventId = ?', [eventId]);
  for (const contactId of [...new Set(ids)]) {
    await run('INSERT OR IGNORE INTO event_contacts (eventId, contactId) VALUES (?, ?)', [
      eventId,
      contactId,
    ]);
  }
}

export async function listEvents(q: Record<string, string>): Promise<{ events: EventOut[] }> {
  const range = rangeSql(q);
  const goal = q.goalId ? ' AND goalId = ?' : '';
  const rows = await all<EventDbRow>(
    `SELECT * FROM events WHERE 1 = 1${goal}${range.sql}
     ORDER BY date ASC, startTime ASC, createdAt ASC`,
    [...(q.goalId ? [q.goalId] : []), ...range.params],
  );
  // Un solo query para las referencias de contacto de todos los eventos.
  const links = await all<{ eventId: string; id: string; firstName: string; lastName: string | null }>(
    `SELECT ec.eventId, c.id, c.firstName, c.lastName
     FROM event_contacts ec JOIN contacts c ON c.id = ec.contactId`,
  );
  const byEvent = new Map<string, EventContactRef[]>();
  for (const l of links) {
    const list = byEvent.get(l.eventId) ?? [];
    list.push({ id: l.id, firstName: l.firstName, lastName: l.lastName });
    byEvent.set(l.eventId, list);
  }
  return { events: rows.map((r) => ({ ...toOut(r), contacts: byEvent.get(r.id) ?? [] })) };
}

export async function getEvent(id: string): Promise<{ event: EventOut }> {
  const row = await one<EventDbRow>('SELECT * FROM events WHERE id = ?', [id]);
  if (!row) throw new ApiError(404, 'Evento no encontrado');
  const contacts = await all<EventContactRef>(
    `SELECT c.id, c.firstName, c.lastName FROM event_contacts ec
     JOIN contacts c ON c.id = ec.contactId WHERE ec.eventId = ?`,
    [id],
  );
  return { event: { ...toOut(row), contacts } };
}

export async function createEvent(body: Record<string, unknown>): Promise<{ event: EventOut }> {
  const now = nowIso();
  const id = newId();
  const repeat = asString(body.repeat, 'none');
  await insertRow('events', {
    id,
    title: requireText(body.title, 'El título'),
    type: asString(body.type, 'Evento') || 'Evento',
    color: body.color ? asString(body.color) : null,
    isBackup: asBool(body.isBackup) ? 1 : 0,
    date: toIso(body.date),
    startTime: horario(body.startTime, 'La hora de inicio'),
    endTime: horario(body.endTime, 'La hora de fin'),
    location: body.location ? asString(body.location) : null,
    placeId: body.placeId ? asString(body.placeId) : null,
    description: body.description ? asString(body.description) : null,
    notifyMins: Math.max(0, Math.round(asNumber(body.notifyMins, 30))),
    repeat: REPEATS.includes(repeat) ? repeat : 'none',
    repeatUntil: optionalIso(body.repeatUntil),
    goalId: body.goalId ? asString(body.goalId) : null,
    done: asBool(body.done) ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });
  const ids = Array.isArray(body.contactIds) ? body.contactIds.map(String) : [];
  if (ids.length) await setContacts(id, ids);
  return getEvent(id);
}

export async function updateEvent(id: string, body: Record<string, unknown>): Promise<{ event: EventOut }> {
  await getEvent(id);
  await updateRow('events', id, body, {
    title: (v) => requireText(v, 'El título'),
    type: (v) => asString(v, 'Evento') || 'Evento',
    color: (v) => (v == null ? null : asString(v)),
    isBackup: (v) => (asBool(v) ? 1 : 0),
    date: (v) => toIso(v),
    startTime: (v) => horario(v, 'La hora de inicio'),
    endTime: (v) => horario(v, 'La hora de fin'),
    location: (v) => (v == null ? null : asString(v)),
    placeId: (v) => (v == null || v === '' ? null : asString(v)),
    description: (v) => (v == null ? null : asString(v)),
    notifyMins: (v) => Math.max(0, Math.round(asNumber(v, 30))),
    repeat: (v) => {
      const s = asString(v, 'none');
      return REPEATS.includes(s) ? s : 'none';
    },
    repeatUntil: (v) => optionalIso(v),
    goalId: (v) => (v == null || v === '' ? null : asString(v)),
    done: (v) => (asBool(v) ? 1 : 0),
  });
  await run('UPDATE events SET updatedAt = ? WHERE id = ?', [nowIso(), id]);
  if (Object.prototype.hasOwnProperty.call(body, 'contactIds')) {
    const ids = Array.isArray(body.contactIds) ? body.contactIds.map(String) : [];
    await setContacts(id, ids);
  }
  return getEvent(id);
}

export async function deleteEvent(id: string): Promise<{ ok: true }> {
  await getEvent(id);
  await tx(async () => {
    await run('DELETE FROM event_contacts WHERE eventId = ?', [id]);
    await run('DELETE FROM events WHERE id = ?', [id]);
  });
  return { ok: true };
}

/** Al borrar un lugar o una meta, sus eventos quedan sin referencia. */
export async function detachPlace(placeId: string): Promise<void> {
  await run('UPDATE events SET placeId = NULL WHERE placeId = ?', [placeId]);
}

export async function detachGoal(goalId: string): Promise<void> {
  await run('UPDATE events SET goalId = NULL WHERE goalId = ?', [goalId]);
}

export async function removeContactLinks(contactId: string): Promise<void> {
  await run('DELETE FROM event_contacts WHERE contactId = ?', [contactId]);
}

/** Suma de minutos de eventos (para estadísticas) en un rango ISO. */
export async function eventsBetween(from: string, to: string): Promise<EventDbRow[]> {
  return all<EventDbRow>('SELECT * FROM events WHERE date >= ? AND date <= ?', [from, to]);
}

export async function eventsForGoal(goalId: string): Promise<EventDbRow[]> {
  return all<EventDbRow>('SELECT * FROM events WHERE goalId = ?', [goalId]);
}

export async function countEventsBetween(goalId: string, from: string, to: string, doneOnly = false): Promise<number> {
  const rows = await all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM events
     WHERE goalId = ? AND date >= ? AND date <= ?${doneOnly ? ' AND done = 1' : ''}`,
    [goalId, from, to],
  );
  return rows[0]?.n ?? 0;
}
