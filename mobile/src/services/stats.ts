import { api } from './api';
import { storage } from './storage';

export type StatPeriod = 'day' | 'week' | 'month';

export interface Overview {
  period: StatPeriod;
  from: string;
  to: string;
  incomes: number;
  expenses: number;
  net: number;
  tasksTotal: number;
  tasksDone: number;
  events: number;
  contacts: number;
  hours: number;
  goalsActive: number;
  goalsDone: number;
  productivity: number;
}

export interface ExpenseSlice {
  name: string;
  amount: number;
  pct: number;
}

async function token() {
  return storage.getToken();
}

export async function statsOverview(period: StatPeriod, dateISO?: string): Promise<Overview> {
  const t = await token();
  const q = `period=${period}${dateISO ? `&date=${encodeURIComponent(dateISO)}` : ''}`;
  return api(`/api/stats/overview?${q}`, {}, t);
}

export async function expensesByCategory(period: StatPeriod, dateISO?: string): Promise<{ total: number; categories: ExpenseSlice[] }> {
  const t = await token();
  const q = `period=${period}${dateISO ? `&date=${encodeURIComponent(dateISO)}` : ''}`;
  return api(`/api/stats/expenses-by-category?${q}`, {}, t);
}
