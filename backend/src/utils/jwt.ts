import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'dev-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh';

export function signAccess(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '15m' });
}

export function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, kind: 'refresh' }, REFRESH_SECRET, { expiresIn: '30d' });
}

export function verifyAccess(token: string): { sub: string } {
  return jwt.verify(token, SECRET) as { sub: string };
}

export function verifyRefresh(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}
