import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

export const DEFAULT_CATEGORIES: string[] = ['Amigos', 'Clientes', 'Proveedores', 'Familia', 'Compañeros', 'Otros'];

// GET /api/contact-categories — defaults (con color) + personalizadas
export const DEFAULT_COLORS: Record<string, string> = {
  Amigos: '#C9A44A',
  Clientes: '#6B9ECF',
  Proveedores: '#D98162',
  Familia: '#6FA287',
  Compañeros: '#8B7BC7',
  Otros: '#8A8F8B',
};

// GET /api/contact-categories — defaults + personalizadas
export async function listCategories(req: AuthedRequest, res: Response) {
  const custom = await prisma.contactCategory.findMany({
    where: { userId: req.userId! },
    orderBy: { name: 'asc' },
  });
  const byName = new Map<string, string | null>();
  for (const d of DEFAULT_CATEGORIES) byName.set(d, DEFAULT_COLORS[d] ?? null);
  for (const c of custom) byName.set(c.name, c.color);
  res.json({ categories: [...byName.entries()].map(([name, color]) => ({ name, color })) });
}

const catSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex').optional(),
});

export async function createCategory(req: AuthedRequest, res: Response) {
  const { name, color } = catSchema.parse(req.body);
  const clean = name.trim();
  if (DEFAULT_CATEGORIES.includes(clean)) return res.json({ name: clean, color: DEFAULT_COLORS[clean] ?? null });
  const cat = await prisma.contactCategory.upsert({
    where: { userId_name: { userId: req.userId!, name: clean } },
    create: { userId: req.userId!, name: clean, color: color ?? '#8B7BC7' },
    update: { color: color ?? undefined },
  });
  res.status(201).json({ name: cat.name, color: cat.color });
}

export async function deleteCategory(req: AuthedRequest, res: Response) {
  const name = decodeURIComponent(req.params.name);
  if (DEFAULT_CATEGORIES.includes(name)) {
    return res.status(400).json({ error: 'Categoría del sistema, no se elimina' });
  }
  const inUse = await prisma.contact.count({ where: { userId: req.userId!, category: name } });
  if (inUse > 0) {
    return res.status(400).json({ error: `En uso por ${inUse} contacto(s). Reasígnalos primero.` });
  }
  await prisma.contactCategory.deleteMany({ where: { userId: req.userId!, name } });
  res.json({ ok: true });
}
