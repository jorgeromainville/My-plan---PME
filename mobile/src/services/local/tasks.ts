// Tareas en SQLite: mismo contrato que `backend/src/controllers/tasks.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, updateRow } from './db';
import { asString, rangeSql, requireText, toIso } from './query';

type TaskRow = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  priority: string;
  category: string;
  description: string | null;
  status: string;
  contactId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
};

const PRIORITIES = ['baja', 'media', 'alta'];
const STATUSES = ['pendiente', 'en_progreso', 'completada'];

function priority(v: unknown): string {
  const s = asString(v, 'media');
  return PRIORITIES.includes(s) ? s : 'media';
}

function status(v: unknown): string {
  const s = asString(v, 'pendiente');
  return STATUSES.includes(s) ? s : 'pendiente';
}

export async function listTasks(q: Record<string, string>): Promise<{ tasks: TaskRow[] }> {
  const range = rangeSql(q);
  const tasks = await all<TaskRow>(
    `SELECT * FROM tasks WHERE 1 = 1${range.sql}
     ORDER BY date ASC, time IS NULL ASC, time ASC`,
    range.params,
  );
  return { tasks };
}

export async function getTask(id: string): Promise<{ task: TaskRow }> {
  const task = await one<TaskRow>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!task) throw new ApiError(404, 'Tarea no encontrada');
  return { task };
}

export async function createTask(body: Record<string, unknown>): Promise<{ task: TaskRow }> {
  const now = nowIso();
  const task: TaskRow = {
    id: newId(),
    title: requireText(body.title, 'El título'),
    date: toIso(body.date),
    time: body.time ? asString(body.time).slice(0, 5) : null,
    priority: priority(body.priority),
    category: asString(body.category, 'General') || 'General',
    description: body.description == null ? null : asString(body.description),
    status: status(body.status),
    contactId: body.contactId ? asString(body.contactId) : null,
    goalId: body.goalId ? asString(body.goalId) : null,
    createdAt: now,
    updatedAt: now,
  };
  await insertRow('tasks', task);
  return { task };
}

export async function updateTask(id: string, body: Record<string, unknown>): Promise<{ task: TaskRow }> {
  await getTask(id);
  await updateRow('tasks', id, body, {
    title: (v) => requireText(v, 'El título'),
    date: (v) => toIso(v),
    time: (v) => (v == null || v === '' ? null : asString(v).slice(0, 5)),
    priority,
    category: (v) => asString(v, 'General') || 'General',
    description: (v) => (v == null ? null : asString(v)),
    status,
    contactId: (v) => (v == null ? null : asString(v)),
    goalId: (v) => (v == null ? null : asString(v)),
  });
  await run('UPDATE tasks SET updatedAt = ? WHERE id = ?', [nowIso(), id]);
  return getTask(id);
}

export async function deleteTask(id: string): Promise<{ ok: true }> {
  await getTask(id);
  await run('DELETE FROM tasks WHERE id = ?', [id]);
  return { ok: true };
}

// Reutilizado por metas (tareas completadas del período).
export async function countTasksDoneBetween(from: string, to: string): Promise<number> {
  const rows = await all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tasks
     WHERE status = 'completada' AND updatedAt >= ? AND updatedAt <= ?`,
    [from, to],
  );
  return rows[0]?.n ?? 0;
}
