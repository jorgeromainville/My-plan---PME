import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

export const DEFAULT_PLACE_CATS: Record<string, string> = {
  Casa: '#6FA287',
  Trabajo: '#6B9ECF',
  Cliente: '#C9A44A',
  Restaurante: '#D98162',
  Compras: '#E07A5F',
  Gimnasio: '#4DB6AC',
  Estudio: '#8B7BC7',
  Amigos: '#C9A44A',
};

const placeSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().default('Personalizado'),
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex').optional(),
});

const placePatch = placeSchema.partial();

export async function listPlaces(req: AuthedRequest, res: Response) {
  const { category, q } = req.query as { category?: string; q?: string };
  const places = await prisma.place.findMany({
    where: {
      userId: req.userId!,
      ...(category ? { category } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { name: 'asc' },
    take: 500,
  });
  res.json({ places });
}

export async function getPlace(req: AuthedRequest, res: Response) {
  const place = await prisma.place.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!place) return res.status(404).json({ error: 'Lugar no encontrado' });
  res.json({ place });
}

export async function createPlace(req: AuthedRequest, res: Response) {
  const data = placeSchema.parse(req.body);
  const place = await prisma.place.create({
    data: { ...data, userId: req.userId! },
  });
  res.status(201).json({ place });
}

export async function updatePlace(req: AuthedRequest, res: Response) {
  const data = placePatch.parse(req.body);
  const found = await prisma.place.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Lugar no encontrado' });
  const place = await prisma.place.update({ where: { id: found.id }, data });
  res.json({ place });
}

export async function deletePlace(req: AuthedRequest, res: Response) {
  const found = await prisma.place.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!found) return res.status(404).json({ error: 'Lugar no encontrado' });
  await prisma.place.delete({ where: { id: found.id } }); // eventos quedan con lugar nulo (SetNull)
  res.json({ ok: true });
}

// GET /api/map/items?category=X&q=Y — lugares + contactos con ubicación, unificados.
export async function mapItems(req: AuthedRequest, res: Response) {
  const { category, q } = req.query as { category?: string; q?: string };
  const [places, contacts] = await Promise.all([
    prisma.place.findMany({
      where: {
        userId: req.userId!,
        ...(category && category !== 'Todos' ? { category } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      take: 500,
    }),
    prisma.contact.findMany({
      where: {
        userId: req.userId!,
        latitude: { not: null },
        longitude: { not: null },
        ...(category && category !== 'Todos' ? { category } : {}),
        ...(q ? { firstName: { contains: q, mode: 'insensitive' } } : {}),
      },
      take: 500,
    }),
  ]);
  res.json({
    items: [
      ...places.map((p) => ({
        id: `p-${p.id}`,
        kind: 'place' as const,
        refId: p.id,
        name: p.name,
        category: p.category,
        color: p.color ?? DEFAULT_PLACE_CATS[p.category] ?? '#8B7BC7',
        latitude: p.latitude!,
        longitude: p.longitude!,
        address: p.address ?? null,
        phone: null,
      })),
      ...contacts.map((c) => ({
        id: `c-${c.id}`,
        kind: 'contact' as const,
        refId: c.id,
        name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`,
        category: c.category,
        color: null,
        latitude: c.latitude!,
        longitude: c.longitude!,
        address: c.address ?? null,
        phone: c.phone ?? c.whatsapp ?? null,
      })),
    ],
  });
}
