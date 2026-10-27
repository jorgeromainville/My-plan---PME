import type { NextFunction, Request, Response } from 'express';

// Límite de intentos en memoria (un solo servidor, sin Redis).
// Se usa en login/registro/cambio de contraseña para frenar fuerza bruta.
interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Limpieza oportunista para que el Map no crezca sin control.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) {
        if (b.reset <= now) buckets.delete(k);
      }
    }
    const key = opts.key ? opts.key(req) : (req.ip ?? 'desconocido');
    const cur = buckets.get(key);
    if (!cur || cur.reset <= now) {
      buckets.set(key, { count: 1, reset: now + opts.windowMs });
      return next();
    }
    cur.count += 1;
    if (cur.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((cur.reset - now) / 1000)));
      return res.status(429).json({
        error: opts.message ?? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      });
    }
    next();
  };
}

// Clave por IP + correo: evita castigar a todos los usuarios de una misma red.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}:${String((req.body as { email?: string })?.email ?? '').toLowerCase()}`,
  message: 'Demasiados intentos con este correo. Espera 15 minutos.',
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Demasiadas cuentas creadas desde esta red. Espera un rato.',
});

export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de cambio de contraseña. Espera 15 minutos.',
});

// Login con Google: límite por IP (no por correo, porque el correo viene dentro
// del idToken y todavía no lo conocemos). 20 intentos cada 15 min por red.
export const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos.',
});

// Tope aparte para **cuentas nuevas** con Google: un login normal no cuenta,
// solo cuando de verdad se va a crear un usuario. 5 por hora y por IP.
const newAccountBuckets = new Map<string, Bucket>();

export function allowNewAccount(ip: string, max = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  if (newAccountBuckets.size > 5000) {
    for (const [k, b] of newAccountBuckets) {
      if (b.reset <= now) newAccountBuckets.delete(k);
    }
  }
  const cur = newAccountBuckets.get(ip);
  if (!cur || cur.reset <= now) {
    newAccountBuckets.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (cur.count >= max) return false;
  cur.count += 1;
  return true;
}
