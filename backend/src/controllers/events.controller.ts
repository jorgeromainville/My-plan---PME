import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

const REPEATS = [
  'none', 'daily', 'weekly', 'monthly',
  'mon_wed', 'tue_thu', 'mon_wed_fri', 'weekdays', 'weekends',
] as const;

const eventSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.string().min(1).max(40).default('Evento'), // la lista editable vive en settings:eventTypes
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex #RRGGBB').optional(),
  isBackup: z.boolean().default(false),
  date: z.string().datetime(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  location: z.string().optional(),
  placeId: z.string().optional(),
  description: z.string().optional(),
  notifyMins: z.number().int().min(0).default(30), // solo se guarda (push en Fase 8)
  repeat: z.enum(REPEATS).default('none'),
  repeatUntil: z.string().datetime().nullable().optional(), // "se repite hasta…"
  goalId: z.string().nullable().optional(), // meta vinculada
  done: z.boolean().optional(), // check manual
  contactIds: z.array(z.string()).default([]),
});

const eventPatch = eventSchema.partial().omit({ contactIds: true }).extend({
  contactIds: z.array(z.string()).optional(),
});

async function assertGoal(userId: string, goalId?: string | null) {
  if (!goalId) return;
  const g = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!g) throw new Error('Meta ajena');
}

async function assertOwnership(userId: string, contactIds: string[], placeId?: string) {
  if (contactIds.length > 0) {
    const n = await prisma.contact.count({ where: { id: { in: contactIds }, userId } });
    if (n !== contactIds.length) throw new Error('Contacto ajeno');
  }
  if (placeId) {
    const p = await prisma.place.findFirst({ where: { id: placeId, userId } });
    if (!p) throw new Error('Lugar ajeno');
  }
}

// GET /api/events?from=ISO&to=ISO&goalId=X
export async function listEvents(req: AuthedRequest, res: Response) {
  const { from, to, goalId } = req.query as { from?: string; to?: string; goalId?: string };
  const events = await prisma.event.findMany({
    where: {
      userId: req.userId!,
      ...(goalId ? { goalId } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { contacts: { select: { id: true, firstName: true } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  res.json({ events });
}

export async function getEvent(req: AuthedRequest, res: Response) {
  const event = await prisma.event.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { contacts: true },
  });
  if (!event) return res.status(404).json({ error: 'Evento no encontrado' });
  res.json({ event });
}

export async function createEvent(req: AuthedRequest, res: Response) {
  const data = eventSchema.parse(req.body);
  try {
    await assertOwnership(req.userId!, data.contactIds, data.placeId);
    await assertGoal(req.userId!, data.goalId);
  } catch {
    return res.status(403).json({ error: 'Contacto, lugar o meta no válido' });
  }
  const event = await prisma.event.create({
    data: {
      title: data.title,
      type: data.type,
      color: data.color,
      isBackup: data.isBackup,
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      placeId: data.placeId,
      description: data.description,
      notifyMins: data.notifyMins,
      repeat: data.repeat,
      repeatUntil: data.repeatUntil ? new Date(data.repeatUntil) : undefined,
      goalId: data.goalId ?? undefined,
      done: data.done ?? false,
      userId: req.userId!,
      contacts: { connect: data.contactIds.map((id) => ({ id })) },
    },
  });
  res.status(201).json({ event });
}

export async function updateEvent(req: AuthedRequest, res: Response) {
  const data = eventPatch.parse(req.body);
  const found = await prisma.event.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Evento no encontrado' });
  try {
    await assertOwnership(req.userId!, data.contactIds ?? [], data.placeId);
    await assertGoal(req.userId!, data.goalId);
  } catch {
    return res.status(403).json({ error: 'Contacto, lugar o meta no válido' });
  }
  const { contactIds, date, repeatUntil, goalId, ...rest } = data;
  const event = await prisma.event.update({
    where: { id: found.id },
    data: {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
      ...(repeatUntil !== undefined ? { repeatUntil: repeatUntil ? new Date(repeatUntil) : null } : {}),
      ...(goalId !== undefined ? { goalId: goalId || null } : {}),
      ...(contactIds ? { contacts: { set: contactIds.map((id) => ({ id })) } } : {}),
    },
  });
  res.json({ event });
}

export async function deleteEvent(req: AuthedRequest, res: Response) {
  const found = await prisma.event.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Evento no encontrado' });
  await prisma.event.delete({ where: { id: found.id } });
  res.json({ ok: true });
}
