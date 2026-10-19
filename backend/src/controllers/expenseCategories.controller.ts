import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

export const DEFAULT_EXPENSE_CATS: Record<string, string> = {
  Alimentación: '#D98162',
  Transporte: '#6B9ECF',
  Servicios: '#8B7BC7',
  Compras: '#C9A44A',
  Trabajo: '#6FA287',
  Educación: '#4DB6AC',
  Entretenimiento: '#E07A5F',
  Otros: '#8A8F8B',
};

// GET /api/expense-categories — defaults (con color) + personalizadas
export async function listExpenseCategories(req: AuthedRequest, res: Response) {
  const custom = await prisma.expenseCategory.findMany({
    where: { userId: req.userId! },
    orderBy: { name: 'asc' },
  });
  const byName = new Map<string, string | null>();
  for (const [name, color] of Object.entries(DEFAULT_EXPENSE_CATS)) byName.set(name, color);
  for (const c of custom) byName.set(c.name, c.color);
  res.json({ categories: [...byName.entries()].map(([name, color]) => ({ name, color })) });
}

const catSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex').optional(),
});

export async function createExpenseCategory(req: AuthedRequest, res: Response) {
  const { name, color } = catSchema.parse(req.body);
  const clean = name.trim();
  if (DEFAULT_EXPENSE_CATS[clean]) {
    return res.json({ name: clean, color: DEFAULT_EXPENSE_CATS[clean] });
  }
  const cat = await prisma.expenseCategory.upsert({
    where: { userId_name: { userId: req.userId!, name: clean } },
    create: { userId: req.userId!, name: clean, color: color ?? '#8A8F8B' },
    update: { color: color ?? undefined },
  });
  res.status(201).json({ name: cat.name, color: cat.color });
}

export async function deleteExpenseCategory(req: AuthedRequest, res: Response) {
  const name = decodeURIComponent(req.params.name);
  if (DEFAULT_EXPENSE_CATS[name]) {
    return res.status(400).json({ error: 'Categoría del sistema, no se elimina' });
  }
  const inUse = await prisma.expense.count({ where: { userId: req.userId!, category: name } });
  if (inUse > 0) {
    return res.status(400).json({ error: `En uso por ${inUse} gasto(s). Reasígnalos primero.` });
  }
  await prisma.expenseCategory.deleteMany({ where: { userId: req.userId!, name } });
  res.json({ ok: true });
}
