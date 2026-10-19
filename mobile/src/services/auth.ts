import { api } from './api';
import { clearOps } from './sync';
import { storage } from './storage';

interface AuthResp {
  user: { id: string; name: string; email: string; currency: string };
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

export async function logout() {
  await clearOps();
  await storage.clear();
}
