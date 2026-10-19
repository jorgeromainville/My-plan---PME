import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return res.status(409).json({ error: 'Email ya registrado' });
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
    select: { id: true, name: true, email: true, currency: true },
  });
  res.status(201).json({ user, access: signAccess(user.id), refresh: signRefresh(user.id) });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
    access: signAccess(user.id),
    refresh: signRefresh(user.id),
  });
}

export async function me(req: Request & { userId?: string }, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, name: true, email: true, currency: true, theme: true, weekStartsOn: true },
  });
  res.json({ user });
}

const refreshSchema = z.object({ refresh: z.string().min(1) });

// POST /api/auth/refresh — renueva el par access/refresh (el access vive 15 min).
export async function refresh(req: Request, res: Response) {
  const { refresh: token } = refreshSchema.parse(req.body);
  try {
    const payload = verifyRefresh(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: 'Sesión inválida' });
    res.json({ access: signAccess(user.id), refresh: signRefresh(user.id) });
  } catch {
    return res.status(401).json({ error: 'Sesión expirada' });
  }
}
