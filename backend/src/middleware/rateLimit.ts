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
