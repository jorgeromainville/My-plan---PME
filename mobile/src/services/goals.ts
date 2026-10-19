import { api } from './api';
import { storage } from './storage';

export type GoalKind = 'ingresos' | 'contactos' | 'tareas' | 'horas' | 'veces' | 'custom';
export type GoalPeriod = 'day' | 'week' | 'month';
export type GoalStatus = 'activa' | 'pausada' | 'completada';

export interface Goal {
  id: string;
  title: string;
  kind: GoalKind;
  filter?: string | null;
  memberIds?: string[];
  touchedIds?: string[];
  period: GoalPeriod;
  target: number;
  current: number;
  unit: string;
  deadline?: string | null;
  status: GoalStatus;
  pct?: number;
  source?: string;
}

export interface GoalInput {
  title: string;
  kind: GoalKind;
  filter?: string | null;
  members?: string[] | null;
  period: GoalPeriod;
  target: number;
  unit?: string;
  deadline?: string;
  status?: GoalStatus;
  current?: number;
}

export interface GoalLog {
  id: string;
  date: string;
  amount: number;
  note?: string | null;
}

export async function addGoalLog(id: string, amount: number, note?: string): Promise<void> {
  const t = await token();
  await api(`/api/goals/${id}/log`, { method: 'POST', body: JSON.stringify({ amount, note }) }, t);
}

export async function listGoalLogs(id: string): Promise<GoalLog[]> {
  const t = await token();
  const r = await api<{ logs: GoalLog[] }>(`/api/goals/${id}/logs`, {}, t);
  return r.logs;
}

export async function deleteGoalLog(logId: string): Promise<void> {
  const t = await token();
  await api(`/api/goals/logs/${logId}`, { method: 'DELETE' }, t);
}

async function token() {
  return storage.getToken();
}

export async function goalsProgress(dateISO?: string, status = 'activa'): Promise<Goal[]> {
  const t = await token();
  const q = `?status=${status}${dateISO ? `&date=${encodeURIComponent(dateISO)}` : ''}`;
  const r = await api<{ goals: Goal[] }>(`/api/goals/progress${q}`, {}, t);
  return r.goals;
}

export async function getGoal(id: string): Promise<Goal> {
  const t = await token();
  const all = await api<{ goals: Goal[] }>('/api/goals', {}, t);
  const g = all.goals.find((x) => x.id === id);
  if (!g) throw new Error('Meta no encontrada');
  return g;
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const t = await token();
  const r = await api<{ goal: Goal }>('/api/goals', { method: 'POST', body: JSON.stringify(input) }, t);
  return r.goal;
}

export async function updateGoal(id: string, input: Partial<GoalInput>): Promise<Goal> {
  const t = await token();
  const r = await api<{ goal: Goal }>(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, t);
  return r.goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const t = await token();
  await api(`/api/goals/${id}`, { method: 'DELETE' }, t);
}
