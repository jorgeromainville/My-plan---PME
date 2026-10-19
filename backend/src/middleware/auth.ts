import type { NextFunction, Request, Response } from 'express';
import { verifyAccess } from '../utils/jwt';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
  try {
    const payload = verifyAccess(h.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
