import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';

// Sesión: token + usuario (nombre, moneda, tema y semana) con copia local para
// arrancar sin red. El servidor es la fuente de verdad; `load` la refresca.
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'auto';
  weekStartsOn: 'monday' | 'sunday';
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  userName: string;
  loaded: boolean;
  load: () => Promise<void>;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  token: null,
  user: null,
  userName: 'Jorge',
  loaded: false,
  load: async () => {
    const token = await storage.getToken();
    const cached = await storage.getUser<SessionUser>();
    set({ token, user: cached, userName: cached?.name ?? get().userName, loaded: true });
    if (!token) return;
    try {
      const r = await api<{ user: SessionUser }>('/api/auth/me', {}, token);
      await storage.setUser(r.user);
      set({ user: r.user, userName: r.user.name });
    } catch {
      // sin red: seguimos con el usuario guardado
    }
  },
  signIn: async (token, user) => {
    await storage.setUser(user);
    set({ token, user, userName: user.name });
  },
  updateUser: async (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    await storage.setUser(next);
    set({ user: next, userName: next.name });
  },
  signOut: async () => {
    const { logout } = await import('../services/auth');
    await logout();
    set({ token: null, user: null });
  },
}));
