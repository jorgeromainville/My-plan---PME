import { api } from './api';
import { storage } from './storage';

export type ExpenseKind = 'fijo' | 'variable';

export interface Expense {
  id: string;
  title: string;
  date: string;
  category: string;
  amount: number;
  kind: ExpenseKind;
  note?: string | null;
}

export interface ExpenseInput {
  title: string;
  date: string;
  category?: string;
  amount: number;
  kind?: ExpenseKind;
  note?: string;
}

export interface ExpenseCategory {
  name: string;
  color: string | null;
}

async function token() {
  return storage.getToken();
}

export async function listExpenses(from: string, to: string): Promise<{ expenses: Expense[]; total: number }> {
  const t = await token();
  return api(`/api/expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, t);
}

export async function getExpense(id: string): Promise<Expense> {
  const t = await token();
  const r = await api<{ expense: Expense }>(`/api/expenses/${id}`, {}, t);
  return r.expense;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const t = await token();
  const r = await api<{ expense: Expense }>('/api/expenses', { method: 'POST', body: JSON.stringify(input) }, t);
  return r.expense;
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>): Promise<Expense> {
  const t = await token();
  const r = await api<{ expense: Expense }>(`/api/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, t);
  return r.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const t = await token();
  await api(`/api/expenses/${id}`, { method: 'DELETE' }, t);
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const t = await storage.getToken();
  const r = await api<{ categories: ExpenseCategory[] }>('/api/expense-categories', {}, t);
  return r.categories;
}

export async function createExpenseCategory(name: string, color?: string): Promise<void> {
  const t = await storage.getToken();
  await api('/api/expense-categories', { method: 'POST', body: JSON.stringify({ name, color }) }, t);
}
