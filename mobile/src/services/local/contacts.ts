// Contactos en SQLite: mismo contrato que `backend/src/controllers/contacts.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, updateRow } from './db';
import { asString, optionalIso, requireText } from './query';
import { removeContactLinks } from './events';
import { countIncomesForClient } from './incomes';

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string;
  notes: string | null;
  lastContactAt: string | null;
  nextContactAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function dayBounds(): { todayIso: string; tomorrowIso: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { todayIso: today.toISOString(), tomorrowIso: tomorrow.toISOString() };
}

export async function listContacts(q: Record<string, string>): Promise<{ contacts: ContactRow[] }> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (q.category) {
    clauses.push('category = ?');
    params.push(q.category);
  }
  if (q.q) {
    clauses.push('(firstName LIKE ? OR lastName LIKE ? OR phone LIKE ?)');
    const like = `%${q.q}%`;
    params.push(like, like, like);
  }
  if (q.followup) {
    const { todayIso, tomorrowIso } = dayBounds();
    if (q.followup === 'today') {
      clauses.push('nextContactAt >= ? AND nextContactAt < ?');
      params.push(todayIso, tomorrowIso);
    } else if (q.followup === 'overdue') {
      clauses.push('nextContactAt < ?');
      params.push(todayIso);
    } else if (q.followup === 'upcoming') {
      clauses.push('nextContactAt >= ?');
      params.push(todayIso);
    }
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const contacts = await all<ContactRow>(
    `SELECT * FROM contacts${where}
     ORDER BY nextContactAt IS NULL ASC, nextContactAt ASC, firstName ASC LIMIT 500`,
    params,
  );
  return { contacts };
}

export async function getContact(id: string): Promise<{ contact: ContactRow }> {
  const contact = await one<ContactRow>('SELECT * FROM contacts WHERE id = ?', [id]);
  if (!contact) throw new ApiError(404, 'Contacto no encontrado');
  return { contact };
}

function optionalNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createContact(body: Record<string, unknown>): Promise<{ contact: ContactRow }> {
  const now = nowIso();
  const id = newId();
  await insertRow('contacts', {
    id,
    firstName: requireText(body.firstName, 'El nombre', 80),
    lastName: body.lastName ? asString(body.lastName).slice(0, 80) : null,
    phone: body.phone ? asString(body.phone).slice(0, 30) : null,
    whatsapp: body.whatsapp ? asString(body.whatsapp).slice(0, 30) : null,
    email: body.email ? asString(body.email).slice(0, 120) : null,
    address: body.address ? asString(body.address).slice(0, 200) : null,
    latitude: optionalNumber(body.latitude),
    longitude: optionalNumber(body.longitude),
    category: asString(body.category, 'Otros') || 'Otros',
    notes: body.notes ? asString(body.notes).slice(0, 1000) : null,
    lastContactAt: optionalIso(body.lastContactAt),
    nextContactAt: optionalIso(body.nextContactAt),
    createdAt: now,
    updatedAt: now,
  });
  return getContact(id);
}

export async function updateContact(
  id: string,
  body: Record<string, unknown>,
): Promise<{ contact: ContactRow }> {
  await getContact(id);
  await updateRow('contacts', id, body, {
    firstName: (v) => requireText(v, 'El nombre', 80),
    lastName: (v) => (v == null ? null : asString(v).slice(0, 80)),
    phone: (v) => (v == null ? null : asString(v).slice(0, 30)),
    whatsapp: (v) => (v == null ? null : asString(v).slice(0, 30)),
    email: (v) => (v == null ? null : asString(v).slice(0, 120)),
    address: (v) => (v == null ? null : asString(v).slice(0, 200)),
    latitude: optionalNumber,
    longitude: optionalNumber,
    category: (v) => asString(v, 'Otros') || 'Otros',
    notes: (v) => (v == null ? null : asString(v).slice(0, 1000)),
    lastContactAt: (v) => optionalIso(v),
    nextContactAt: (v) => optionalIso(v),
  });
  await run('UPDATE contacts SET updatedAt = ? WHERE id = ?', [nowIso(), id]);
  return getContact(id);
}

export async function deleteContact(id: string): Promise<{ ok: true }> {
  await getContact(id);
  const linked = await countIncomesForClient(id);
  if (linked > 0) {
    throw new ApiError(400, `Tiene ${linked} ingreso(s) asociado(s). Reasígnalos primero.`);
  }
  await removeContactLinks(id);
  await run('DELETE FROM contacts WHERE id = ?', [id]);
  return { ok: true };
}

export async function touchContact(id: string): Promise<{ contact: ContactRow }> {
  await getContact(id);
  await run('UPDATE contacts SET lastContactAt = ?, nextContactAt = NULL, updatedAt = ? WHERE id = ?', [
    nowIso(),
    nowIso(),
    id,
  ]);
  return getContact(id);
}

export async function countContactsInCategory(category: string): Promise<number> {
  const rows = await all<{ n: number }>('SELECT COUNT(*) AS n FROM contacts WHERE category = ?', [
    category,
  ]);
  return rows[0]?.n ?? 0;
}

/** Contactos contactados en el rango (estadísticas). */
export async function countContactsContactedBetween(from: string, to: string): Promise<number> {
  const rows = await all<{ n: number }>(
    'SELECT COUNT(*) AS n FROM contacts WHERE lastContactAt >= ? AND lastContactAt <= ?',
    [from, to],
  );
  return rows[0]?.n ?? 0;
}
