import { api } from './api';
import { storage } from './storage';
import type { SessionUser } from '../store/useSession';

interface AuthResp {
  user: SessionUser;
  access: string;
  refresh: string;
}

interface GoogleConfig {
  enabled: boolean;
  clientId: string | null;
}

// El client ID es público y se pide al servidor para no recompilar la app si
// cambia el proyecto de Google. Sin conexión no se puede entrar con Google.
export function getGoogleConfig() {
  return api<GoogleConfig>('/api/auth/google/config', {}, null, false, false);
}

// El backend valida el idToken con Google y devuelve nuestros tokens.
export async function loginWithGoogle(idToken: string) {
  const r = await api<AuthResp>(
    '/api/auth/google',
    { method: 'POST', body: JSON.stringify({ idToken }) },
    null,
    false,
    false,
  );
  await storage.setTokens(r.access, r.refresh);
  return r;
}
