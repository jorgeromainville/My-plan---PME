import { api } from './api';
import { storage } from './storage';

export type PayMethod = 'Efectivo' | 'Yape' | 'Plin' | 'Tarjeta' | 'Transferencia' | 'Otro';

export interface Income {
  id: string;
  title: string;
  date: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  clientId?: string | null;
  payMethod: PayMethod;
  note?: string | null;
  client?: { id: string; firstName: string; lastName?: string | null } | null;
}

export interface IncomeInput {
  title: string;
  date: string;
  category?: string;
  quantity?: number;
  unitPrice: number;
  clientId?: string;
  payMethod?: PayMethod;
  note?: string;
}

async function token() {
  return storage.getToken();
}

export async function listIncomes(from: string, to: string): Promise<{ incomes: Income[]; total: number }> {
  const t = await token();
  return api(`/api/incomes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, t);
}

export async function getIncome(id: string): Promise<Income> {
  const t = await token();
  const r = await api<{ income: Income }>(`/api/incomes/${id}`, {}, t);
  return r.income;
}

export async function createIncome(input: IncomeInput): Promise<Income> {
  const t = await token();
  const r = await api<{ income: Income }>('/api/incomes', { method: 'POST', body: JSON.stringify(input) }, t);
  return r.income;
}

export async function updateIncome(id: string, input: Partial<IncomeInput>): Promise<Income> {
  const t = await token();
  const r = await api<{ income: Income }>(`/api/incomes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, t);
  return r.income;
}

export async function deleteIncome(id: string): Promise<void> {
  const t = await token();
  await api(`/api/incomes/${id}`, { method: 'DELETE' }, t);
}

export interface FinanceSummary {
  incomes: number;
  incomesCount: number;
  expenses: number;
  expensesCount: number;
  net: number;
}

export async function financeSummary(from: string, to: string): Promise<FinanceSummary> {
  const t = await token();
  return api(`/api/finance/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, t);
}
