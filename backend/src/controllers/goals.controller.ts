import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

// Kinds con cálculo automático; 'custom' usa el current manual.
// 'veces' cuenta eventos vinculados en el rango (ej. ir al gym 2 veces).
const KINDS = ['ingresos', 'contactos', 'tareas', 'horas', 'veces', 'custom'] as const;
const PERIODS = ['day', 'week', 'month'] as const;
const STATUSES = ['activa', 'completada'] as const;

const goalSchema = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(KINDS).default('custom'),
  filter: z.string().max(40).nullable().optional(), // ej. categoría a contar
  members: z.array(z.string()).max(100).nullable().optional(), // ids elegidos
  period: z.enum(PERIODS).default('day'),
  target: z.number().positive(),
  unit: z.string().max(10).default('u'),
  deadline: z.string().datetime().optional(),
  status: z.enum(STATUSES).default('activa'),
  current: z.number().min(0).default(0), // solo se usa si kind=custom
});

const goalPatch = goalSchema.partial();

export function periodRange(
  period: 'day' | 'week' | 'month',
  ref: Date,
  weekStartsOn = 'monday',
): { from: Date; to: Date } {
  const from = new Date(ref);
  const to = new Date(ref);
  if (period === 'day') {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    const first = weekStartsOn === 'sunday' ? 0 : 1;
    const diff = (from.getDay() - first + 7) % 7;
    from.setDate(from.getDate() - diff);
    from.setHours(0, 0, 0, 0);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(to.getMonth() + 1, 0);
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

// Calcula el actual de una meta automática en el rango.
// Horas: si la meta tiene eventos vinculados, suma los realizados
// (hora ya pasada o check manual); si no, todas las horas en eventos.
// Devuelve { auto, detail } para mostrar el origen en la app.
async function computeCurrent(
  userId: string,
  goalId: string,
  kind: string,
  filter: string | null,
  memberIds: string[],
  from: Date,
  to: Date,
): Promise<{ auto: number; detail: string; touchedIds?: string[] }> {
  if (kind === 'ingresos') {
    const r = await prisma.income.aggregate({
      where: { userId, date: { gte: from, lte: to } },
      _sum: { total: true },
      _count: true,
    });
    const total = Math.round((r._sum.total ?? 0) * 100) / 100;
    return { auto: total, detail: `${r._count} ingreso(s) sumados` };
  }
  if (kind === 'contactos') {
    // Si hay lista elegida, cuenta solo esos; si no, por categoría o todos.
    const scope = memberIds.length > 0
      ? { id: { in: memberIds } }
      : filter
        ? { category: filter }
        : {};
    const touched = await prisma.contact.findMany({
      where: { userId, lastContactAt: { gte: from, lte: to }, ...scope },
      select: { id: true, firstName: true },
    });
    const label = memberIds.length > 0 ? 'elegido(s)' : filter ? `de ${filter}` : 'contactado(s)';
    return { auto: touched.length, detail: `${touched.length} ${label}`, touchedIds: touched.map((c) => c.id) };
  }
  if (kind === 'tareas') {
    const n = await prisma.task.count({
      where: { userId, status: 'completada', updatedAt: { gte: from, lte: to } },
    });
    return { auto: n, detail: `${n} tarea(s) completadas` };
  }
  if (kind === 'horas') {
    const linked = await prisma.event.findMany({
      where: { userId, goalId },
      select: { date: true, startTime: true, endTime: true, done: true, title: true },
    });
    const pool = linked.length > 0
      ? linked
      : await prisma.event.findMany({
          where: { userId, date: { gte: from, lte: to } },
          select: { date: true, startTime: true, endTime: true, done: true, title: true },
        });
    const now = new Date();
    let mins = 0;
    let done = 0;
    for (const e of pool) {
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      const dur = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      const d = new Date(e.date);
      const endDt = new Date(d);
      endDt.setHours(eh, em, 0, 0);
      const ok = e.done || endDt <= now;
      if (ok) {
        mins += dur;
        done += 1;
      }
    }
    const hs = Math.round((mins / 60) * 100) / 100;
    const scope = linked.length > 0 ? `${done}/${linked.length} vinculado(s)` : `${pool.length} evento(s)`;
    return { auto: hs, detail: `${hs} h en ${scope}` };
  }
  if (kind === 'veces') {
    const inRange = { userId, goalId, date: { gte: from, lte: to } };
    const n = await prisma.event.count({ where: inRange });
    const doneN = await prisma.event.count({ where: { ...inRange, done: true } });
    return { auto: n, detail: `${doneN}/${n} vinculado(s) realizados` };
  }
  return { auto: 0, detail: 'manual' };
}

export function withMembers<T extends { members?: string | null }>(g: T): T & { memberIds: string[] } {
  let memberIds: string[] = [];
  try {
    const v = g.members ? JSON.parse(g.members) : [];
    if (Array.isArray(v)) memberIds = v.filter((x) => typeof x === 'string');
  } catch {
    memberIds = [];
  }
  return { ...g, memberIds };
}

export async function listGoals(req: AuthedRequest, res: Response) {
  const { period, status } = req.query as { period?: string; status?: string };
  const goals = await prisma.goal.findMany({
    where: {
      userId: req.userId!,
      ...(period ? { period } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ goals: goals.map(withMembers) });
}

// GET /api/goals/progress?date=ISO — metas activas con actual calculado y %.
// current = automático del período + manual del log. Incluye el origen.
export async function goalsProgress(req: AuthedRequest, res: Response) {
  const ref = req.query.date ? new Date(req.query.date as string) : new Date();
  const status = (req.query.status as string) || 'activa';
  const userRow = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { weekStartsOn: true },
  });
  const ws = userRow?.weekStartsOn === 'sunday' ? 'sunday' : 'monday';
  const goals = await prisma.goal.findMany({
    where: { userId: req.userId!, ...(status === 'all' ? {} : { status }) },
    take: 200,
  });
  const out = await Promise.all(
    goals.map(async (g) => {
      const { from, to } = periodRange(g.period as 'day' | 'week' | 'month', ref, ws);
      const logs = await prisma.goalLog.aggregate({
        where: { goalId: g.id, userId: req.userId!, date: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: true,
      });
      const manual = Math.round((logs._sum.amount ?? 0) * 100) / 100;
      const base = g.kind === 'custom' ? g.current : 0;
      const { auto, detail, touchedIds } = g.kind === 'custom'
        ? { auto: 0, detail: `${logs._count} registro(s) manual(es)`, touchedIds: undefined as string[] | undefined }
        : await computeCurrent(req.userId!, g.id, g.kind, g.filter, withMembers(g).memberIds, from, to);
      const current = Math.round((base + auto + manual) * 100) / 100;
      const pct = g.target > 0 ? Math.min(100, Math.round((current / g.target) * 100)) : 0;
      const parts = [detail];
      if (manual > 0) parts.push(`+${manual} manual`);
      if (g.kind === 'custom' && base > 0) parts.push(`base ${base}`);
      return { ...withMembers(g), current, pct, from, to, source: parts.join(' · '), touchedIds };
    }),
  );
  res.json({ goals: out });
}

export async function createGoal(req: AuthedRequest, res: Response) {
  const data = goalSchema.parse(req.body);
  const { deadline, members, ...rest } = data;
  const goal = await prisma.goal.create({
    data: {
      ...rest,
      members: members ? JSON.stringify(members) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      userId: req.userId!,
    },
  });
  res.status(201).json({ goal: withMembers(goal) });
}

export async function updateGoal(req: AuthedRequest, res: Response) {
  const data = goalPatch.parse(req.body);
  const found = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Meta no encontrada' });
  const { deadline, members, ...rest } = data;
  const goal = await prisma.goal.update({
    where: { id: found.id },
    data: {
      ...rest,
      ...(deadline !== undefined ? { deadline: deadline ? new Date(deadline) : null } : {}),
      ...(members !== undefined ? { members: members ? JSON.stringify(members) : null } : {}),
    },
  });
  res.json({ goal: withMembers(goal) });
}

export async function deleteGoal(req: AuthedRequest, res: Response) {
  const found = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Meta no encontrada' });
  await prisma.goal.delete({ where: { id: found.id } });
  res.json({ ok: true });
}

const logSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
  date: z.string().datetime().optional(),
});

// POST /api/goals/:id/log — registra avance manual ("corrí 1.5 h").
export async function addLog(req: AuthedRequest, res: Response) {
  const data = logSchema.parse(req.body);
  const found = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Meta no encontrada' });
  const log = await prisma.goalLog.create({
    data: {
      goalId: found.id,
      userId: req.userId!,
      amount: data.amount,
      note: data.note,
      date: data.date ? new Date(data.date) : new Date(),
    },
  });
  res.status(201).json({ log });
}

// GET /api/goals/:id/logs — historial de avances manuales.
export async function listLogs(req: AuthedRequest, res: Response) {
  const found = await prisma.goal.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Meta no encontrada' });
  const logs = await prisma.goalLog.findMany({
    where: { goalId: found.id, userId: req.userId! },
    orderBy: { date: 'desc' },
    take: 200,
  });
  res.json({ logs });
}

// DELETE /api/goals/logs/:logId — quita un registro manual.
export async function deleteLog(req: AuthedRequest, res: Response) {
  const found = await prisma.goalLog.findFirst({
    where: { id: req.params.logId, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Registro no encontrado' });
  await prisma.goalLog.delete({ where: { id: found.id } });
  res.json({ ok: true });
}
