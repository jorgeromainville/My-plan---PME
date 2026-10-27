// Ingresos en SQLite: mismo contrato que `backend/src/controllers/incomes.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, updateRow } from './db';
import { asNumber, asString, rangeSql, requireText, round2, toIso } from './query';

type ClientRef = { id: string; firstName: string; lastName: string | null };

type IncomeRow = {
  id: string;
  date: string;
  title: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  clientId: string | null;
  payMethod: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  client?: ClientRef | null;
};

const PAY_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro'];

function payMethod(v: unknown): string {
  const s = asString(v, 'Efectivo');
  return PAY_METHODS.includes(s) ? s : 'Efectivo';
}

async function clientMap(ids: string[]): Promise<Map<string, ClientRef>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const marks = unique.map(() => '?').join(', ');
  const rows = await all<ClientRef>(
    `SELECT id, firstName, lastName FROM contacts WHERE id IN (${marks})`,
    unique,
  );
  return new Map(rows.map((r) => [r.id, r]));
}

export async function listIncomes(
  q: Record<string, string>,
): Promise<{ incomes: IncomeRow[]; total: number }> {
  const range = rangeSql(q);
  const category = q.category ? ' AND category = ?' : '';
  const rows = await all<IncomeRow>(
    `SELECT * FROM incomes WHERE 1 = 1${category}${range.sql}
     ORDER BY date DESC, createdAt DESC LIMIT 500`,
    [...(q.category ? [q.category] : []), ...range.params],
  );
  const map = await clientMap(rows.map((r) => r.clientId).filter((v): v is string => !!v));
  const incomes = rows.map((r) => ({ ...r, client: r.clientId ? map.get(r.clientId) ?? null : null }));
  const total = round2(incomes.reduce((s, i) => s + i.total, 0));
  return { incomes, total };
}

export async function getIncome(id: string): Promise<{ income: IncomeRow }> {
  const row = await one<IncomeRow>('SELECT * FROM incomes WHERE id = ?', [id]);
  if (!row) throw new ApiError(404, 'Ingreso no encontrado');
  const client = row.clientId ? (await clientMap([row.clientId])).get(row.clientId) ?? null : null;
  return { income: { ...row, client } };
}

async function assertClient(clientId: unknown): Promise<string | null> {
  if (clientId == null || clientId === '') return null;
  const id = asString(clientId);
  const found = await one<{ id: string }>('SELECT id FROM contacts WHERE id = ?', [id]);
  if (!found) throw new ApiError(403, 'Cliente no válido');
  return id;
}

export async function createIncome(body: Record<string, unknown>): Promise<{ income: IncomeRow }> {
  const quantity = asNumber(body.quantity, 1) || 1;
  const unitPrice = Math.max(0, asNumber(body.unitPrice, 0));
  const now = nowIso();
  const id = newId();
  await insertRow('incomes', {
    id,
    date: toIso(body.date),
    title: requireText(body.title, 'El título'),
    category: asString(body.category, 'General') || 'General',
    quantity,
    unitPrice,
    total: round2(quantity * unitPrice),
    clientId: await assertClient(body.clientId),
    payMethod: payMethod(body.payMethod),
    note: body.note ? asString(body.note).slice(0, 500) : null,
    createdAt: now,
    updatedAt: now,
  });
  return getIncome(id);
}

export async function updateIncome(
  id: string,
  body: Record<string, unknown>,
): Promise<{ income: IncomeRow }> {
  const found = await one<IncomeRow>('SELECT * FROM incomes WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Ingreso no encontrado');
  const quantity = body.quantity === undefined ? found.quantity : asNumber(body.quantity, 1) || 1;
  const unitPrice =
    body.unitPrice === undefined ? found.unitPrice : Math.max(0, asNumber(body.unitPrice, 0));
  const clientId = body.clientId === undefined ? undefined : await assertClient(body.clientId);
  await updateRow('incomes', id, body, {
    date: (v) => toIso(v),
    title: (v) => requireText(v, 'El título'),
    category: (v) => asString(v, 'General') || 'General',
    quantity: (v) => asNumber(v, 1) || 1,
    unitPrice: (v) => Math.max(0, asNumber(v, 0)),
    payMethod,
    note: (v) => (v == null ? null : asString(v).slice(0, 500)),
  });
  if (clientId !== undefined) {
    await run('UPDATE incomes SET clientId = ? WHERE id = ?', [clientId, id]);
  }
  await run('UPDATE incomes SET total = ?, updatedAt = ? WHERE id = ?', [
    round2(quantity * unitPrice),
    nowIso(),
    id,
  ]);
  return getIncome(id);
}

export async function deleteIncome(id: string): Promise<{ ok: true }> {
  const found = await one<{ id: string }>('SELECT id FROM incomes WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Ingreso no encontrado');
  await run('DELETE FROM incomes WHERE id = ?', [id]);
  return { ok: true };
}

/** Ingresos del período (para metas y resúmenes). */
export async function incomeTotalBetween(from: string, to: string): Promise<{ total: number; count: number }> {
  const rows = await all<{ total: number | null; n: number }>(
    'SELECT SUM(total) AS total, COUNT(*) AS n FROM incomes WHERE date >= ? AND date <= ?',
    [from, to],
  );
  return { total: round2(rows[0]?.total ?? 0), count: rows[0]?.n ?? 0 };
}

export async function countIncomesForClient(clientId: string): Promise<number> {
  const rows = await all<{ n: number }>('SELECT COUNT(*) AS n FROM incomes WHERE clientId = ?', [
    clientId,
  ]);
  return rows[0]?.n ?? 0;
}
