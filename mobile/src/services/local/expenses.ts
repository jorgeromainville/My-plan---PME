// Gastos en SQLite: mismo contrato que `backend/src/controllers/expenses.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, updateRow } from './db';
import { asNumber, asString, rangeSql, requireText, round2, toIso } from './query';

type ExpenseRow = {
  id: string;
  date: string;
  title: string;
  category: string;
  amount: number;
  kind: string;
  note: string | null;
  createdAt: string;
};

function kind(v: unknown): string {
  return asString(v, 'variable') === 'fijo' ? 'fijo' : 'variable';
}

export async function listExpenses(
  q: Record<string, string>,
): Promise<{ expenses: ExpenseRow[]; total: number }> {
  const range = rangeSql(q);
  const category = q.category ? ' AND category = ?' : '';
  const expenses = await all<ExpenseRow>(
    `SELECT * FROM expenses WHERE 1 = 1${category}${range.sql}
     ORDER BY date DESC, createdAt DESC LIMIT 500`,
    [...(q.category ? [q.category] : []), ...range.params],
  );
  return { expenses, total: round2(expenses.reduce((s, e) => s + e.amount, 0)) };
}

export async function getExpense(id: string): Promise<{ expense: ExpenseRow }> {
  const expense = await one<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!expense) throw new ApiError(404, 'Gasto no encontrado');
  return { expense };
}

export async function createExpense(body: Record<string, unknown>): Promise<{ expense: ExpenseRow }> {
  const id = newId();
  await insertRow('expenses', {
    id,
    date: toIso(body.date),
    title: requireText(body.title, 'El título'),
    category: asString(body.category, 'Otros') || 'Otros',
    amount: Math.max(0, asNumber(body.amount, 0)),
    kind: kind(body.kind),
    note: body.note ? asString(body.note).slice(0, 500) : null,
    createdAt: nowIso(),
  });
  return getExpense(id);
}

export async function updateExpense(
  id: string,
  body: Record<string, unknown>,
): Promise<{ expense: ExpenseRow }> {
  await getExpense(id);
  await updateRow('expenses', id, body, {
    date: (v) => toIso(v),
    title: (v) => requireText(v, 'El título'),
    category: (v) => asString(v, 'Otros') || 'Otros',
    amount: (v) => Math.max(0, asNumber(v, 0)),
    kind,
    note: (v) => (v == null ? null : asString(v).slice(0, 500)),
  });
  return getExpense(id);
}

export async function deleteExpense(id: string): Promise<{ ok: true }> {
  await getExpense(id);
  await run('DELETE FROM expenses WHERE id = ?', [id]);
  return { ok: true };
}

export async function expenseTotalBetween(
  from: string,
  to: string,
): Promise<{ total: number; count: number }> {
  const rows = await all<{ total: number | null; n: number }>(
    'SELECT SUM(amount) AS total, COUNT(*) AS n FROM expenses WHERE date >= ? AND date <= ?',
    [from, to],
  );
  return { total: round2(rows[0]?.total ?? 0), count: rows[0]?.n ?? 0 };
}

export async function expensesGroupedByCategory(
  from: string,
  to: string,
): Promise<{ name: string; amount: number }[]> {
  return all<{ name: string; amount: number }>(
    `SELECT category AS name, ROUND(SUM(amount) * 100) / 100 AS amount
     FROM expenses WHERE date >= ? AND date <= ?
     GROUP BY category ORDER BY SUM(amount) DESC`,
    [from, to],
  );
}

export async function countExpensesInCategory(category: string): Promise<number> {
  const rows = await all<{ n: number }>('SELECT COUNT(*) AS n FROM expenses WHERE category = ?', [
    category,
  ]);
  return rows[0]?.n ?? 0;
}
