import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

const priorities = ['baja', 'media', 'alta'] as const;
const statuses = ['pendiente', 'en_progreso', 'completada'] as const;

const taskSchema = z.object({
  title: z.string().min(1).max(120),
  date: z.string().datetime(), // ISO que manda el móvil (día local a las 00:00)
  time: z.string().max(5).optional(), // "08:30"
  priority: z.enum(priorities).default('media'),
  category: z.string().default('General'),
  description: z.string().optional(),
  status: z.enum(statuses).default('pendiente'),
  contactId: z.string().optional(),
  goalId: z.string().optional(),
});

const taskPatch = taskSchema.partial();

// GET /api/tasks?from=ISO&to=ISO — todo va filtrado por userId.
export async function listTasks(req: AuthedRequest, res: Response) {
  const { from, to } = req.query as { from?: string; to?: string };
  const tasks = await prisma.task.findMany({
    where: {
      userId: req.userId!,
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  res.json({ tasks });
}

export async function getTask(req: AuthedRequest, res: Response) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json({ task });
}

export async function createTask(req: AuthedRequest, res: Response) {
  const data = taskSchema.parse(req.body);
  const task = await prisma.task.create({
    data: { ...data, date: new Date(data.date), userId: req.userId! },
  });
  res.status(201).json({ task });
}

export async function updateTask(req: AuthedRequest, res: Response) {
  const data = taskPatch.parse(req.body);
  const found = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Tarea no encontrada' });
  const task = await prisma.task.update({
    where: { id: found.id },
    data: {
      ...data,
      ...(data.date ? { date: new Date(data.date) } : {}),
    },
  });
  res.json({ task });
}

export async function deleteTask(req: AuthedRequest, res: Response) {
  const found = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Tarea no encontrada' });
  await prisma.task.delete({ where: { id: found.id } });
  res.json({ ok: true });
}
