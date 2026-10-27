import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../config/db';
import { allowNewAccount } from '../middleware/rateLimit';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';

const googleClient = new OAuth2Client();

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
  // Las cuentas nuevas se crean con Google (correo verificado por Google).
  // Se deja el endpoint para cuando exista verificación por correo; se activa
  // con ALLOW_PASSWORD_SIGNUP=true.
  if (process.env.ALLOW_PASSWORD_SIGNUP !== 'true') {
    return res.status(403).json({
      error: 'Las cuentas nuevas se crean con Google. Usa "Continuar con Google".',
    });
  }
  const data = registerSchema.parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) return res.status(409).json({ error: 'Email ya registrado' });
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash },
    select: { id: true, name: true, email: true, currency: true, currencySymbol: true, theme: true, weekStartsOn: true },
  });
  res.status(201).json({ user, access: signAccess(user.id), refresh: signRefresh(user.id) });
}

export async function login(req: Request, res: Response) {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (!user.passwordHash) {
    return res.status(401).json({ error: 'Esta cuenta entra con Google. Usa "Continuar con Google".' });
  }
  const ok = await verifyPassword(data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      currencySymbol: user.currencySymbol,
      theme: user.theme,
      weekStartsOn: user.weekStartsOn,
    },
    access: signAccess(user.id),
    refresh: signRefresh(user.id),
  });
}

// GET /api/auth/google/config — el client ID es público; la app lo pide en
// tiempo de ejecución para poder cambiar de proyecto de Google sin recompilar.
export async function googleConfig(_req: Request, res: Response) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  res.json({ enabled: Boolean(clientId), clientId: clientId || null });
}

const googleSchema = z.object({ idToken: z.string().min(20) });

// POST /api/auth/google — valida el idToken de Google y crea/vincula la cuenta.
export async function googleLogin(req: Request, res: Response) {
  const { idToken } = googleSchema.parse(req.body);
  const audience = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!audience) {
    return res.status(503).json({ error: 'Google no está configurado en el servidor.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'No pudimos validar tu cuenta de Google. Intenta de nuevo.' });
  }

  if (!payload?.sub || !payload.email) {
    return res.status(401).json({ error: 'La cuenta de Google no tiene correo disponible.' });
  }
  if (payload.email_verified === false) {
    return res.status(401).json({ error: 'Tu correo de Google no está verificado.' });
  }

  const email = payload.email.toLowerCase();
  const name = (payload.name || email.split('@')[0]).slice(0, 80);

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // Vincula Google a una cuenta existente y quita la contraseña local:
      // el correo no estaba verificado, así que dejarla viva permitiría que
      // quien la creó conservara acceso a la cuenta del dueño real del correo.
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: payload.sub, passwordHash: null },
      });
    } else {
      // Solo se aplica a cuentas nuevas, no a logins de cuentas existentes.
      if (!allowNewAccount(req.ip ?? 'desconocido')) {
        return res.status(429).json({
          error: 'Se crearon demasiadas cuentas nuevas desde esta red. Espera un rato e inténtalo de nuevo.',
        });
      }
      user = await prisma.user.create({
        data: { name, email, googleId: payload.sub },
      });
    }
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      currencySymbol: user.currencySymbol,
      theme: user.theme,
      weekStartsOn: user.weekStartsOn,
    },
    access: signAccess(user.id),
    refresh: signRefresh(user.id),
  });
}

export async function me(req: Request & { userId?: string }, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, name: true, email: true, currency: true, currencySymbol: true, theme: true, weekStartsOn: true },
  });
  res.json({ user });
}

const refreshSchema = z.object({ refresh: z.string().min(1) });

// PATCH /api/auth/me — nombre, moneda (código + símbolo) y preferencias.
const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/).optional(),
    currencySymbol: z.string().trim().min(1).max(6).optional(),
    theme: z.enum(['light', 'dark', 'andean', 'auto']).optional(),
    weekStartsOn: z.enum(['monday', 'sunday']).optional(),
  })
  .strict();

export async function updateMe(req: Request & { userId?: string }, res: Response) {
  const data = updateMeSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      currencySymbol: true,
      theme: true,
      weekStartsOn: true,
    },
  });
  res.json({ user });
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

// PATCH /api/auth/password — cambia la clave verificando la actual.
export async function changePassword(req: Request & { userId?: string }, res: Response) {
  const { currentPassword, newPassword } = passwordSchema.parse(req.body);
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!user.passwordHash) {
    return res.status(400).json({ error: 'Esta cuenta entra con Google y no tiene contraseña local.' });
  }
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  res.json({ ok: true });
}

const deleteAccountSchema = z.object({ confirm: z.literal('ELIMINAR') });

// DELETE /api/auth/account — borra la cuenta y todo lo suyo (cascada).
// Play Store exige que el usuario pueda eliminar su cuenta desde la app.
export async function deleteAccount(req: Request & { userId?: string }, res: Response) {
  deleteAccountSchema.parse(req.body);
  await prisma.user.delete({ where: { id: req.userId! } });
  res.json({ ok: true });
}


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
