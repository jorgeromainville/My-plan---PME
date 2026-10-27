// Estadísticas del invitado: puerto de stats/finance controllers.
// La fórmula de productividad es la misma que `backend/src/services/productivity.service.ts`.
import { all } from './db';
import { round2 } from './query';
import { eventsBetween } from './events';
import { countContactsContactedBetween } from './contacts';

export type StatPeriod = 'day' | 'week' | 'month';

function rangeOf(period: string, ref: Date, weekStartsOn: string): { from: Date; to: Date } {
  const from = new Date(ref);
  const to = new Date(ref);
  if (period === 'week') {
    const first = weekStartsOn === 'sunday' ? 0 : 1;
    const diff = (from.getDay() - first + 7) % 7;
    from.setDate(from.getDate() - diff);
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

async function weekStart(weekStartsOn: string): Promise<string> {
  return weekStartsOn === 'sunday' ? 'sunday' : 'monday';
}

function calcProductivity(i: {
  tasksDone: number;
  tasksTotal: number;
  goalsDone: number;
  goalsTotal: number;
  workHours: number;
  studyHours: number;
  eventsDone: number;
}): number {
  const taskRate = i.tasksTotal > 0 ? i.tasksDone / i.tasksTotal : 0;
  const goalRate = i.goalsTotal > 0 ? i.goalsDone / i.goalsTotal : 0;
  const hoursScore = Math.min(1, (i.workHours + i.studyHours) / 8);
  const eventsScore = Math.min(1, i.eventsDone / 5);
  const score = taskRate * 0.4 + goalRate * 0.3 + hoursScore * 0.2 + eventsScore * 0.1;
  return Math.round(score * 100);
}

export async function statsOverview(q: Record<string, string>, weekStartsOn = 'monday') {
  const period = q.period || 'day';
  const ref = q.date ? new Date(q.date) : new Date();
  const { from, to } = rangeOf(period, ref, await weekStart(weekStartsOn));
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const [money] = await all<{ incomes: number | null; expenses: number | null }>(
    `SELECT
       (SELECT SUM(total) FROM incomes WHERE date >= ? AND date <= ?) AS incomes,
       (SELECT SUM(amount) FROM expenses WHERE date >= ? AND date <= ?) AS expenses`,
    [fromIso, toIso, fromIso, toIso],
  );

  const tasks = await all<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'completada' THEN 1 ELSE 0 END) AS done
     FROM tasks WHERE date >= ? AND date <= ?`,
    [fromIso, toIso],
  );
  const tasksTotal = tasks[0]?.total ?? 0;
  const tasksDone = tasks[0]?.done ?? 0;

  const events = await eventsBetween(fromIso, toIso);
  const hours = round2(
    events.reduce((sum, e) => {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0) / 60,
  );

  const contacts = await countContactsContactedBetween(fromIso, toIso);

  const goals = await all<{ id: string }>("SELECT id FROM goals WHERE status = 'activa'");
  const goalsDoneRows = await all<{ n: number }>(
    "SELECT COUNT(*) AS n FROM goals WHERE status = 'completada' AND updatedAt >= ? AND updatedAt <= ?",
    [fromIso, toIso],
  );
  const goalsDone = goalsDoneRows[0]?.n ?? 0;

  const incomeTotal = round2(money?.incomes ?? 0);
  const expenseTotal = round2(money?.expenses ?? 0);

  return {
    period,
    from: fromIso,
    to: toIso,
    incomes: incomeTotal,
    expenses: expenseTotal,
    net: round2(incomeTotal - expenseTotal),
    tasksTotal,
    tasksDone,
    events: events.length,
    contacts,
    hours,
    goalsActive: goals.length,
    goalsDone,
    productivity: calcProductivity({
      tasksDone,
      tasksTotal,
      goalsDone,
      goalsTotal: goals.length + goalsDone,
      workHours: hours,
      studyHours: 0,
      eventsDone: events.length,
    }),
  };
}

export async function expensesByCategory(q: Record<string, string>, weekStartsOn = 'monday') {
  const period = q.period || 'day';
  const ref = q.date ? new Date(q.date) : new Date();
  const { from, to } = rangeOf(period, ref, await weekStart(weekStartsOn));
  const rows = await all<{ category: string; amount: number }>(
    `SELECT category, ROUND(SUM(amount) * 100) / 100 AS amount
     FROM expenses WHERE date >= ? AND date <= ?
     GROUP BY category ORDER BY SUM(amount) DESC`,
    [from.toISOString(), to.toISOString()],
  );
  const total = round2(rows.reduce((s, r) => s + r.amount, 0));
  return {
    total,
    categories: rows.map((r) => ({
      name: r.category,
      amount: round2(r.amount),
      pct: total > 0 ? Math.round((r.amount / total) * 100) : 0,
    })),
  };
}

export async function financeSummary(q: Record<string, string>) {
  const range: string[] = [];
  const params: string[] = [];
  if (q.from) {
    range.push('date >= ?');
    params.push(q.from);
  }
  if (q.to) {
    range.push('date <= ?');
    params.push(q.to);
  }
  const where = range.length ? ` WHERE ${range.join(' AND ')}` : '';
  const [money] = await all<{
    incomes: number | null;
    incomesCount: number;
    expenses: number | null;
    expensesCount: number;
  }>(
    `SELECT
       (SELECT SUM(total) FROM incomes${where}) AS incomes,
       (SELECT COUNT(*) FROM incomes${where}) AS incomesCount,
       (SELECT SUM(amount) FROM expenses${where}) AS expenses,
       (SELECT COUNT(*) FROM expenses${where}) AS expensesCount`,
    [...params, ...params, ...params, ...params],
  );
  const incomeTotal = round2(money?.incomes ?? 0);
  const expenseTotal = round2(money?.expenses ?? 0);
  return {
    incomes: incomeTotal,
    incomesCount: money?.incomesCount ?? 0,
    expenses: expenseTotal,
    expensesCount: money?.expensesCount ?? 0,
    net: round2(incomeTotal - expenseTotal),
  };
}
