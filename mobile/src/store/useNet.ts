import { create } from 'zustand';

// ¿La última petición al servidor falló por red? Sirve para avisar en Inicio
// ("Sin conexión · datos guardados") sin bloquear la app.
interface NetState {
  offline: boolean;
  setOffline: (v: boolean) => void;
}

export const useNet = create<NetState>((set) => ({
  offline: false,
  setOffline: (offline) => set({ offline }),
}));
