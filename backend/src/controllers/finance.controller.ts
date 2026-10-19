import type { Response } from 'express';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

// GET /api/finance/summary?from=ISO&to=ISO
// Ingresos, gastos y resultado neto del período (alimenta Fase 6).
export async function financeSummary(req: AuthedRequest, res: Response) {
  const { from, to } = req.query as { from?: string; to?: string };
  const range =
    from || to
      ? { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) }
      : undefined;

  const [incomes, expenses] = await Promise.all([
    prisma.income.aggregate({
      where: { userId: req.userId!, ...(range ? { date: range } : {}) },
      _sum: { total: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { userId: req.userId!, ...(range ? { date: range } : {}) },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const incomeTotal = Math.round((incomes._sum.total ?? 0) * 100) / 100;
  const expenseTotal = Math.round((expenses._sum.amount ?? 0) * 100) / 100;
  res.json({
    incomes: incomeTotal,
    incomesCount: incomes._count,
    expenses: expenseTotal,
    expensesCount: expenses._count,
    net: Math.round((incomeTotal - expenseTotal) * 100) / 100,
  });
}
