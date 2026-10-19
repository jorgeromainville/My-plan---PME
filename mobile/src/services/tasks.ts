import { api } from './api';
import { storage } from './storage';

export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';
export type Priority = 'baja' | 'media' | 'alta';

export interface Task {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  priority: Priority;
  category: string;
  description?: string | null;
  status: TaskStatus;
}

async function token() {
  return storage.getToken();
}

// Rango del día en ISO (el móvil trabaja fecha local, el server filtra rango).
export function dayRange(d: Date): { from: string; to: string } {
  const from = new Date(d); from.setHours(0, 0, 0, 0);
  const to = new Date(d); to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function listTasks(from: string, to: string): Promise<Task[]> {
  const t = await token();
  const r = await api<{ tasks: Task[] }>(
    `/api/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {},
    t,
  );
  return r.tasks;
}

export async function createTask(input: Omit<Task, 'id'>): Promise<Task> {
  const t = await token();
  const r = await api<{ task: Task }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  }, t);
  return r.task;
}

export async function updateTask(id: string, input: Partial<Omit<Task, 'id'>>): Promise<Task> {
  const t = await token();
  const r = await api<{ task: Task }>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, t);
  return r.task;
}

export async function deleteTask(id: string): Promise<void> {
  const t = await token();
  await api<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }, t);
}

export async function getTask(id: string): Promise<Task> {
  const t = await token();
  const r = await api<{ task: Task }>(`/api/tasks/${id}`, {}, t);
  return r.task;
}
