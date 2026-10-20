import { api } from './api';
import { clearOps } from './sync';
import { storage } from './storage';
import type { SessionUser } from '../store/useSession';

interface AuthResp {
  user: SessionUser;
  access: string;
  refresh: string;
}

export async function login(email: string, password: string) {
  const r = await api<AuthResp>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await storage.setTokens(r.access, r.refresh);
  return r;
}

export async function register(name: string, email: string, password: string) {
  const r = await api<AuthResp>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  await storage.setTokens(r.access, r.refresh);
  return r;
}

// Nombre, moneda (código + símbolo), tema e inicio de semana.
export async function updateMe(
  patch: Partial<Pick<SessionUser, 'name' | 'currency' | 'currencySymbol' | 'theme' | 'weekStartsOn'>>,
) {
  const token = await storage.getToken();
  return api<{ user: SessionUser }>(
    '/api/auth/me',
    { method: 'PATCH', body: JSON.stringify(patch) },
    token,
  );
}

export async function logout() {
  await clearOps();
  await storage.clear();
}
