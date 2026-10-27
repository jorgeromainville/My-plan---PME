// Metas en SQLite: puerto de `backend/src/controllers/goals.controller.ts`.
// La fórmula de avance automático debe coincidir con la del servidor.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, tx, updateRow } from './db';
import { asNumber, asString, optionalIso, requireText, round2, toIso } from './query';
import { countTasksDoneBetween } from './tasks';
import { detachGoal } from './events';
import { incomeTotalBetween } from './incomes';

type GoalRow = {
  id: string;
  title: string;
  kind: string;
  filter: string | null;
  members: string | null;
  period: string;
  target: number;
  current: number;
  unit: string;
  deadline: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalOut = Omit<GoalRow, 'members'> & { memberIds: string[] };

export type GoalProgress = GoalOut & {
  pct: number;
  from: string;
  to: string;
  source: string;
  touchedIds?: string[];
};

type GoalLogRow = {
  id: string;
  goalId: string;
  date: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

const KINDS = ['ingresos', 'contactos', 'tareas', 'horas', 'veces', 'custom'];
const PERIODS = ['day', 'week', 'month'];
const STATUSES = ['activa', 'pausada', 'completada'];

function withMembers(row: GoalRow): GoalOut {
  let memberIds: string[] = [];
  try {
    const parsed = row.members ? JSON.parse(row.members) : [];
    if (Array.isArray(parsed)) memberIds = parsed.filter((x) => typeof x === 'string');
  } catch {
    memberIds = [];
  }
  const { members: _ignored, ...rest } = row;
  void _ignored;
  return { ...rest, memberIds };
}

export function periodRange(
  period: 'day' | 'week' | 'month',
  ref: Date,
  weekStartsOn = 'monday',
): { from: Date; to: Date } {
  const from = new Date(ref);
  const to = new Date(ref);
  if (period === 'day') {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    const first = weekStartsOn === 'sunday' ? 0 : 1;
    const diff = (from.getDay() - first + 7) % 7;
    from.setDate(from.getDate() - diff);
    from.setHours(0, 0, 0, 0);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(to.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

function durationMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

async function computeCurrent(
  goal: GoalOut,
  from: string,
  to: string,
): Promise<{ auto: number; detail: string; touchedIds?: string[] }> {
  if (goal.kind === 'ingresos') {
    const r = await incomeTotalBetween(from, to);
    return { auto: r.total, detail: `${r.count} ingreso(s) sumados` };
  }
  if (goal.kind === 'contactos') {
    const clauses = ['lastContactAt IS NOT NULL', 'lastContactAt >= ?', 'lastContactAt <= ?'];
    const params: string[] = [from, to];
    if (goal.memberIds.length) {
      clauses.push(`id IN (${goal.memberIds.map(() => '?').join(', ')})`);
      params.push(...goal.memberIds);
    } else if (goal.filter) {
      clauses.push('category = ?');
      params.push(goal.filter);
    }
    const touched = await all<{ id: string }>(
      `SELECT id FROM contacts WHERE ${clauses.join(' AND ')}`,
      params,
    );
    const label = goal.memberIds.length ? 'elegido(s)' : goal.filter ? `de ${goal.filter}` : 'contactado(s)';
    return {
      auto: touched.length,
      detail: `${touched.length} ${label}`,
      touchedIds: touched.map((c) => c.id),
    };
  }
  if (goal.kind === 'tareas') {
    const n = await countTasksDoneBetween(from, to);
    return { auto: n, detail: `${n} tarea(s) completadas` };
  }
  if (goal.kind === 'horas') {
    const linked = await all<{
      startTime: string;
      endTime: string;
      date: string;
      done: number;
    }>('SELECT startTime, endTime, date, done FROM events WHERE goalId = ?', [goal.id]);
    const pool = linked.length
      ? linked
      : await all<{ startTime: string; endTime: string; date: string; done: number }>(
          'SELECT startTime, endTime, date, done FROM events WHERE date >= ? AND date <= ?',
          [from, to],
        );
    const now = new Date();
    let mins = 0;
    let done = 0;
    for (const e of pool) {
      const endDt = new Date(e.date);
      const [eh, em] = e.endTime.split(':').map(Number);
      endDt.setHours(eh, em, 0, 0);
      if (e.done === 1 || endDt <= now) {
        mins += durationMins(e.startTime, e.endTime);
        done += 1;
      }
    }
    const hs = round2(mins / 60);
    const scope = linked.length ? `${done}/${linked.length} vinculado(s)` : `${pool.length} evento(s)`;
    return { auto: hs, detail: `${hs} h en ${scope}` };
  }
  if (goal.kind === 'veces') {
    const rows = await all<{ n: number; d: number }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS d
       FROM events WHERE goalId = ? AND date >= ? AND date <= ?`,
      [goal.id, from, to],
    );
    const n = rows[0]?.n ?? 0;
    const doneN = rows[0]?.d ?? 0;
    return { auto: n, detail: `${doneN}/${n} vinculado(s) realizados` };
  }
  return { auto: 0, detail: 'manual' };
}

export async function listGoals(q: Record<string, string>): Promise<{ goals: GoalOut[] }> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (q.period) {
    clauses.push('period = ?');
    params.push(q.period);
  }
  if (q.status) {
    clauses.push('status = ?');
    params.push(q.status);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const rows = await all<GoalRow>(
    `SELECT * FROM goals${where} ORDER BY createdAt DESC LIMIT 200`,
    params,
  );
  return { goals: rows.map(withMembers) };
}

export async function goalsProgress(
  q: Record<string, string>,
  weekStartsOn = 'monday',
): Promise<{ goals: GoalProgress[] }> {
  const ref = q.date ? new Date(q.date) : new Date();
  const status = q.status || 'activa';
  const ws = weekStartsOn === 'sunday' ? 'sunday' : 'monday';
  const rows = await all<GoalRow>(
    `SELECT * FROM goals${status === 'all' ? '' : ' WHERE status = ?'} ORDER BY createdAt DESC LIMIT 200`,
    status === 'all' ? [] : [status],
  );

  const goals: GoalProgress[] = [];
  for (const row of rows) {
    const goal = withMembers(row);
    const { from, to } = periodRange(goal.period as 'day' | 'week' | 'month', ref, ws);
    const fromIso = from.toISOString();
    const toIsoStr = to.toISOString();
    const manualRows = await all<{ total: number | null; n: number }>(
      `SELECT SUM(amount) AS total, COUNT(*) AS n FROM goal_logs
       WHERE goalId = ? AND date >= ? AND date <= ?`,
      [goal.id, fromIso, toIsoStr],
    );
    const manual = round2(manualRows[0]?.total ?? 0);
    const logCount = manualRows[0]?.n ?? 0;
    const base = goal.kind === 'custom' ? goal.current : 0;
    const computed =
      goal.kind === 'custom'
        ? { auto: 0, detail: `${logCount} registro(s) manual(es)`, touchedIds: undefined }
        : await computeCurrent(goal, fromIso, toIsoStr);
    const current = round2(base + computed.auto + manual);
    const pct = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
    const parts = [computed.detail];
    if (manual > 0) parts.push(`+${manual} manual`);
    if (goal.kind === 'custom' && base > 0) parts.push(`base ${base}`);
    goals.push({
      ...goal,
      current,
      pct,
      from: fromIso,
      to: toIsoStr,
      source: parts.join(' · '),
      touchedIds: computed.touchedIds,
    });
  }
  return { goals };
}

function cleanKind(v: unknown): string {
  const s = asString(v, 'custom');
  return KINDS.includes(s) ? s : 'custom';
}

function cleanPeriod(v: unknown): string {
  const s = asString(v, 'day');
  return PERIODS.includes(s) ? s : 'day';
}

function cleanStatus(v: unknown): string {
  const s = asString(v, 'activa');
  return STATUSES.includes(s) ? s : 'activa';
}

export async function createGoal(body: Record<string, unknown>): Promise<{ goal: GoalOut }> {
  const now = nowIso();
  const target = asNumber(body.target, 0);
  if (target <= 0) throw new ApiError(400, 'La meta debe ser mayor que cero');
  const id = newId();
  const members = Array.isArray(body.members) ? JSON.stringify(body.members.map(String)) : null;
  await insertRow('goals', {
    id,
    title: requireText(body.title, 'El título'),
    kind: cleanKind(body.kind),
    filter: body.filter ? asString(body.filter) : null,
    members,
    period: cleanPeriod(body.period),
    target,
    current: Math.max(0, asNumber(body.current, 0)),
    unit: asString(body.unit, 'u') || 'u',
    deadline: optionalIso(body.deadline),
    status: cleanStatus(body.status),
    createdAt: now,
    updatedAt: now,
  });
  const row = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  return { goal: withMembers(row!) };
}

export async function updateGoal(id: string, body: Record<string, unknown>): Promise<{ goal: GoalOut }> {
  const found = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Meta no encontrada');
  await updateRow('goals', id, body, {
    title: (v) => requireText(v, 'El título'),
    kind: cleanKind,
    filter: (v) => (v == null || v === '' ? null : asString(v)),
    members: (v) => (v == null ? null : JSON.stringify(Array.isArray(v) ? v.map(String) : [])),
    period: cleanPeriod,
    target: (v) => {
      const n = asNumber(v, 0);
      if (n <= 0) throw new ApiError(400, 'La meta debe ser mayor que cero');
      return n;
    },
    current: (v) => Math.max(0, asNumber(v, 0)),
    unit: (v) => asString(v, 'u') || 'u',
    deadline: (v) => optionalIso(v),
    status: cleanStatus,
  });
  await run('UPDATE goals SET updatedAt = ? WHERE id = ?', [nowIso(), id]);
  const row = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  return { goal: withMembers(row!) };
}

export async function deleteGoal(id: string): Promise<{ ok: true }> {
  const found = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Meta no encontrada');
  await tx(async () => {
    await detachGoal(id);
    await run('DELETE FROM goal_logs WHERE goalId = ?', [id]);
    await run('DELETE FROM goals WHERE id = ?', [id]);
  });
  return { ok: true };
}

export async function addGoalLog(id: string, body: Record<string, unknown>): Promise<{ log: GoalLogRow }> {
  const found = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Meta no encontrada');
  const amount = asNumber(body.amount, 0);
  if (amount <= 0) throw new ApiError(400, 'El avance debe ser mayor que cero');
  const log: GoalLogRow = {
    id: newId(),
    goalId: id,
    date: optionalIso(body.date) ?? nowIso(),
    amount,
    note: body.note ? asString(body.note).slice(0, 200) : null,
    createdAt: nowIso(),
  };
  await insertRow('goal_logs', log);
  return { log };
}

export async function listGoalLogs(id: string): Promise<{ logs: GoalLogRow[] }> {
  const found = await one<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  if (!found) throw new ApiError(404, 'Meta no encontrada');
  const logs = await all<GoalLogRow>(
    'SELECT * FROM goal_logs WHERE goalId = ? ORDER BY date DESC LIMIT 200',
    [id],
  );
  return { logs };
}

export async function deleteGoalLog(logId: string): Promise<{ ok: true }> {
  const found = await one<GoalLogRow>('SELECT * FROM goal_logs WHERE id = ?', [logId]);
  if (!found) throw new ApiError(404, 'Registro no encontrado');
  await run('DELETE FROM goal_logs WHERE id = ?', [logId]);
  return { ok: true };
}
