import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

const expenseSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string().datetime(),
  category: z.string().default('Otros'),
  amount: z.number().min(0),
  kind: z.enum(['fijo', 'variable']).default('variable'),
  note: z.string().max(500).optional(),
});

const expensePatch = expenseSchema.partial();

// GET /api/expenses?from=ISO&to=ISO&category=X
export async function listExpenses(req: AuthedRequest, res: Response) {
  const { from, to, category } = req.query as { from?: string; to?: string; category?: string };
  const expenses = await prisma.expense.findMany({
    where: {
      userId: req.userId!,
      ...(category ? { category } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    orderBy: { date: 'desc' },
    take: 500,
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  res.json({ expenses, total: Math.round(total * 100) / 100 });
}

export async function getExpense(req: AuthedRequest, res: Response) {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' });
  res.json({ expense });
}

export async function createExpense(req: AuthedRequest, res: Response) {
  const data = expenseSchema.parse(req.body);
  const expense = await prisma.expense.create({
    data: { ...data, date: new Date(data.date), userId: req.userId! },
  });
  res.status(201).json({ expense });
}

export async function updateExpense(req: AuthedRequest, res: Response) {
  const data = expensePatch.parse(req.body);
  const found = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Gasto no encontrado' });
  const { date, ...rest } = data;
  const expense = await prisma.expense.update({
    where: { id: found.id },
    data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
  });
  res.json({ expense });
}

export async function deleteExpense(req: AuthedRequest, res: Response) {
  const found = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Gasto no encontrado' });
  await prisma.expense.delete({ where: { id: found.id } });
  res.json({ ok: true });
}
