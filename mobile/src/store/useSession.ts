import { create } from 'zustand';
import { api } from '../services/api';
import { getGuestUser } from '../services/guestProfile';
import { loadMode, saveMode, type SessionMode } from '../services/sessionMode';
import { storage } from '../services/storage';
import { usePrefs } from './usePrefs';

// Sesión: token + usuario (nombre, moneda, tema y semana) con copia local para
// arrancar sin red. El servidor es la fuente de verdad; `load` la refresca.
//
// Modo invitado: no hay token; `user` es el perfil local y todos los datos viven
// en SQLite. `mode` decide si `api()` va a la nube o al teléfono.
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'andean' | 'auto';
  weekStartsOn: 'monday' | 'sunday';
}

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  userName: string;
  mode: SessionMode;
  loaded: boolean;
  load: () => Promise<void>;
  signIn: (token: string, user: SessionUser) => Promise<void>;
  startGuest: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  token: null,
  user: null,
  userName: 'Jorge',
  mode: 'account',
  loaded: false,
  load: async () => {
    const mode = await loadMode();
    if (mode === 'guest') {
      const guest = await getGuestUser();
      set({ mode: 'guest', token: null, user: guest, userName: guest.name, loaded: true });
      void usePrefs.getState().set({ theme: guest.theme, weekStartsOn: guest.weekStartsOn });
      return;
    }
    const token = await storage.getToken();
    const cached = await storage.getUser<SessionUser>();
    set({ mode: 'account', token, user: cached, userName: cached?.name ?? get().userName, loaded: true });
    if (!token) return;
    try {
      const r = await api<{ user: SessionUser }>('/api/auth/me', {}, token);
      await storage.setUser(r.user);
      set({ user: r.user, userName: r.user.name });
      void usePrefs.getState().set({ theme: r.user.theme });
    } catch {
      // sin red: seguimos con el usuario guardado
    }
  },
  signIn: async (token, user) => {
    await saveMode('account');
    await storage.setUser(user);
    set({ mode: 'account', token, user, userName: user.name });
    void usePrefs.getState().set({ theme: user.theme });
  },
  startGuest: async () => {
    const guest = await getGuestUser();
    await saveMode('guest');
    set({ mode: 'guest', token: null, user: guest, userName: guest.name });
    void usePrefs.getState().set({ theme: guest.theme, weekStartsOn: guest.weekStartsOn });
  },
  updateUser: async (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    await storage.setUser(next);
    set({ user: next, userName: next.name });
    if (patch.theme) void usePrefs.getState().set({ theme: patch.theme });
  },
  signOut: async () => {
    // Salir del modo invitado no borra nada: los datos siguen en el teléfono y
    // se recuperan al volver a "Entrar sin cuenta".
    if (get().mode === 'guest') {
      await saveMode('account');
      set({ mode: 'account', token: null, user: null });
      return;
    }
    const { logout } = await import('../services/auth');
    await logout();
    set({ mode: 'account', token: null, user: null });
  },
}));
