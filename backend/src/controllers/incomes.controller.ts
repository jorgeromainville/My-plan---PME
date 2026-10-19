import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

const PAY_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro'] as const;

const incomeSchema = z.object({
  title: z.string().min(1).max(120), // producto, servicio u otro ingreso
  date: z.string().datetime(),
  category: z.string().default('General'),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  clientId: z.string().optional(),
  payMethod: z.enum(PAY_METHODS).default('Efectivo'),
  note: z.string().max(500).optional(),
});

const incomePatch = incomeSchema.partial();

// El total siempre lo calcula el servidor: quantity x unitPrice.
function totals(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// GET /api/incomes?from=ISO&to=ISO&category=X
export async function listIncomes(req: AuthedRequest, res: Response) {
  const { from, to, category } = req.query as { from?: string; to?: string; category?: string };
  const incomes = await prisma.income.findMany({
    where: {
      userId: req.userId!,
      ...(category ? { category } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    },
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
    take: 500,
  });
  const total = incomes.reduce((s, i) => s + i.total, 0);
  res.json({ incomes, total: Math.round(total * 100) / 100 });
}

export async function getIncome(req: AuthedRequest, res: Response) {
  const income = await prisma.income.findFirst({
    where: { id: req.params.id, userId: req.userId! },
    include: { client: true },
  });
  if (!income) return res.status(404).json({ error: 'Ingreso no encontrado' });
  res.json({ income });
}

export async function createIncome(req: AuthedRequest, res: Response) {
  const data = incomeSchema.parse(req.body);
  if (data.clientId) {
    const c = await prisma.contact.findFirst({ where: { id: data.clientId, userId: req.userId! } });
    if (!c) return res.status(403).json({ error: 'Cliente no válido' });
  }
  const income = await prisma.income.create({
    data: {
      ...data,
      date: new Date(data.date),
      total: totals(data.quantity, data.unitPrice),
      userId: req.userId!,
    },
  });
  res.status(201).json({ income });
}

export async function updateIncome(req: AuthedRequest, res: Response) {
  const data = incomePatch.parse(req.body);
  const found = await prisma.income.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Ingreso no encontrado' });
  if (data.clientId) {
    const c = await prisma.contact.findFirst({ where: { id: data.clientId, userId: req.userId! } });
    if (!c) return res.status(403).json({ error: 'Cliente no válido' });
  }
  const quantity = data.quantity ?? found.quantity;
  const unitPrice = data.unitPrice ?? found.unitPrice;
  const { date, ...rest } = data;
  const income = await prisma.income.update({
    where: { id: found.id },
    data: {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
      total: totals(quantity, unitPrice),
    },
  });
  res.json({ income });
}

export async function deleteIncome(req: AuthedRequest, res: Response) {
  const found = await prisma.income.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Ingreso no encontrado' });
  await prisma.income.delete({ where: { id: found.id } });
  res.json({ ok: true });
}
