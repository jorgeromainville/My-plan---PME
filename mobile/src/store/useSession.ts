import { create } from 'zustand';
import { storage } from '../services/storage';

// Sesión mínima: token guardado en AsyncStorage, nombre para el saludo.
interface SessionState {
  token: string | null;
  userName: string;
  loaded: boolean;
  load: () => Promise<void>;
  signIn: (token: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  userName: 'Jorge',
  loaded: false,
  load: async () => {
    const token = await storage.getToken();
    set({ token, loaded: true });
  },
  signIn: async (token, userName) => {
    set({ token, userName });
  },
  signOut: async () => {
    const { logout } = await import('../services/auth');
    await logout();
    set({ token: null });
  },
}));
