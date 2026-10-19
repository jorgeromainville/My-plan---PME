import type { Response } from 'express';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';
import { calcProductivity } from '../services/productivity.service';

function rangeOf(period: string, ref: Date): { from: Date; to: Date } {
  const from = new Date(ref);
  const to = new Date(ref);
  if (period === 'week') {
    const day = from.getDay();
    from.setDate(from.getDate() + (day === 0 ? -6 : 1 - day));
    from.setHours(0, 0, 0, 0);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(to.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
  } else {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

// GET /api/stats/overview?period=day|week|month&date=ISO
export async function statsOverview(req: AuthedRequest, res: Response) {
  const period = (req.query.period as string) || 'day';
  const ref = req.query.date ? new Date(req.query.date as string) : new Date();
  const { from, to } = rangeOf(period, ref);
  const uid = req.userId!;
  const inRange = { gte: from, lte: to };

  const [incomes, expenses, tasksTotal, tasksDone, events, contacts, goals] = await Promise.all([
    prisma.income.aggregate({ where: { userId: uid, date: inRange }, _sum: { total: true } }),
    prisma.expense.aggregate({ where: { userId: uid, date: inRange }, _sum: { amount: true } }),
    prisma.task.count({ where: { userId: uid, date: inRange } }),
    prisma.task.count({ where: { userId: uid, date: inRange, status: 'completada' } }),
    prisma.event.count({ where: { userId: uid, date: inRange } }),
    prisma.contact.count({ where: { userId: uid, lastContactAt: inRange } }),
    prisma.goal.findMany({ where: { userId: uid, status: 'activa' }, select: { id: true } }),
  ]);

  const evts = await prisma.event.findMany({
    where: { userId: uid, date: inRange },
    select: { startTime: true, endTime: true },
  });
  const hours = Math.round(
    (evts.reduce((s, e) => {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      return s + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0) / 60) * 100,
  ) / 100;

  const goalsDone = await prisma.goal.count({
    where: { userId: uid, status: 'completada', updatedAt: inRange },
  });

  const incomeTotal = Math.round((incomes._sum.total ?? 0) * 100) / 100;
  const expenseTotal = Math.round((expenses._sum.amount ?? 0) * 100) / 100;
  const productivity = calcProductivity({
    tasksDone,
    tasksTotal,
    goalsDone,
    goalsTotal: goals.length + goalsDone,
    workHours: hours,
    studyHours: 0,
    eventsDone: events,
  });

  res.json({
    period,
    from,
    to,
    incomes: incomeTotal,
    expenses: expenseTotal,
    net: Math.round((incomeTotal - expenseTotal) * 100) / 100,
    tasksTotal,
    tasksDone,
    events,
    contacts,
    hours,
    goalsActive: goals.length,
    goalsDone,
    productivity,
  });
}

// GET /api/stats/expenses-by-category?period=day|week|month&date=ISO
export async function expensesByCategory(req: AuthedRequest, res: Response) {
  const period = (req.query.period as string) || 'day';
  const ref = req.query.date ? new Date(req.query.date as string) : new Date();
  const { from, to } = rangeOf(period, ref);
  const rows = await prisma.expense.groupBy({
    by: ['category'],
    where: { userId: req.userId!, date: { gte: from, lte: to } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });
  const total = rows.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  res.json({
    total: Math.round(total * 100) / 100,
    categories: rows.map((r) => ({
      name: r.category,
      amount: Math.round((r._sum.amount ?? 0) * 100) / 100,
      pct: total > 0 ? Math.round(((r._sum.amount ?? 0) / total) * 100) : 0,
    })),
  });
}
