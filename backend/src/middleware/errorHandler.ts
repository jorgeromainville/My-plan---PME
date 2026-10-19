import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
}
