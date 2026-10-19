import type { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import type { AuthedRequest } from '../middleware/auth';

// Settings genéricos por usuario (tipos de evento, plantillas, futuros ajustes).
// GET /api/settings/:key → { key, value } (value es JSON libre)
// PUT /api/settings/:key { value } → guarda (hasta 20KB)
export async function getSetting(req: AuthedRequest, res: Response) {
  const s = await prisma.setting.findUnique({
    where: { userId_key: { userId: req.userId!, key: req.params.key } },
  });
  res.json({ key: req.params.key, value: s ? JSON.parse(s.value) : null });
}

const putSchema = z.object({ value: z.unknown() });

export async function putSetting(req: AuthedRequest, res: Response) {
  const { value } = putSchema.parse(req.body);
  const raw = JSON.stringify(value ?? null);
  if (raw.length > 20 * 1024) return res.status(400).json({ error: 'Valor muy grande' });
  const s = await prisma.setting.upsert({
    where: { userId_key: { userId: req.userId!, key: req.params.key } },
    create: { userId: req.userId!, key: req.params.key, value: raw },
    update: { value: raw },
  });
  res.json({ key: s.key, value: JSON.parse(s.value) });
}
