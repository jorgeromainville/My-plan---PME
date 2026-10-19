import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

const contactSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  email: z.string().email().max(120).optional().or(z.literal('').transform(() => undefined)),
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: z.string().default('Otros'),
  notes: z.string().max(1000).optional(),
  lastContactAt: z.string().datetime().optional(),
  nextContactAt: z.string().datetime().optional(),
});

const contactPatch = contactSchema.partial();

// GET /api/contacts?category=X&followup=today|overdue|upcoming
export async function listContacts(req: AuthedRequest, res: Response) {
  const { category, followup, q } = req.query as { category?: string; followup?: string; q?: string };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const contacts = await prisma.contact.findMany({
    where: {
      userId: req.userId!,
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : {}),
      ...(followup === 'today'
        ? { nextContactAt: { gte: today, lt: tomorrow } }
        : followup === 'overdue'
          ? { nextContactAt: { lt: today } }
          : followup === 'upcoming'
            ? { nextContactAt: { gte: today } }
            : {}),
    },
    orderBy: [{ nextContactAt: 'asc' }, { firstName: 'asc' }],
    take: 500,
  });
  res.json({ contacts });
}

export async function getContact(req: AuthedRequest, res: Response) {
  const contact = await prisma.contact.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
  res.json({ contact });
}

function toDate(v?: string): Date | undefined {
  return v ? new Date(v) : undefined;
}

export async function createContact(req: AuthedRequest, res: Response) {
  const data = contactSchema.parse(req.body);
  const { lastContactAt, nextContactAt, ...rest } = data;
  const contact = await prisma.contact.create({
    data: {
      ...rest,
      lastContactAt: toDate(lastContactAt),
      nextContactAt: toDate(nextContactAt),
      userId: req.userId!,
    },
  });
  res.status(201).json({ contact });
}

export async function updateContact(req: AuthedRequest, res: Response) {
  const data = contactPatch.parse(req.body);
  const found = await prisma.contact.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Contacto no encontrado' });
  const { lastContactAt, nextContactAt, ...rest } = data;
  const contact = await prisma.contact.update({
    where: { id: found.id },
    data: {
      ...rest,
      ...(lastContactAt !== undefined ? { lastContactAt: lastContactAt ? new Date(lastContactAt) : null } : {}),
      ...(nextContactAt !== undefined ? { nextContactAt: nextContactAt ? new Date(nextContactAt) : null } : {}),
    },
  });
  res.json({ contact });
}

export async function deleteContact(req: AuthedRequest, res: Response) {
  const found = await prisma.contact.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Contacto no encontrado' });
  const linked = await prisma.income.count({ where: { clientId: found.id, userId: req.userId! } });
  if (linked > 0) {
    return res.status(400).json({ error: `Tiene ${linked} ingreso(s) asociado(s). Reasígnalos primero.` });
  }
  await prisma.contact.delete({ where: { id: found.id } });
  res.json({ ok: true });
}

// POST /api/contacts/:id/touch — marca "contactado hoy" (mueve next según frecuencia simple)
export async function touchContact(req: AuthedRequest, res: Response) {
  const found = await prisma.contact.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Contacto no encontrado' });
  const now = new Date();
  const contact = await prisma.contact.update({
    where: { id: found.id },
    data: { lastContactAt: now, nextContactAt: null },
  });
  res.json({ contact });
}
