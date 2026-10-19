import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';

export interface EventKind {
  name: string;
  color: string; // #RRGGBB
}

export interface Template {
  title: string;
  icon: string;
  start: string; // HH:MM
  end: string; // HH:MM
  type: string;
}

export const DEFAULT_KINDS: EventKind[] = [
  { name: 'Evento', color: '#8B7BC7' },
  { name: 'Reunión', color: '#6B9ECF' },
  { name: 'Personal', color: '#6FA287' },
  { name: 'Comida', color: '#C9A44A' },
  { name: 'Trabajo', color: '#D98162' },
  { name: 'Estudio', color: '#E07A5F' },
];

export const DEFAULT_TEMPLATES: Template[] = [
  { title: 'Desayuno', icon: '🍳', start: '07:00', end: '07:30', type: 'Comida' },
  { title: 'Almuerzo', icon: '🍽️', start: '13:00', end: '14:00', type: 'Comida' },
  { title: 'Reunión', icon: '👥', start: '10:00', end: '11:00', type: 'Reunión' },
];

async function readKey<T>(key: string): Promise<T | null> {
  const t = await storage.getToken();
  if (!t) throw new Error('sin sesión');
  const r = await api<{ value: T | null }>(`/api/settings/${key}`, {}, t);
  return r.value;
}

async function writeKey(key: string, value: unknown): Promise<void> {
  const t = await storage.getToken();
  if (!t) throw new Error('sin sesión');
  await api(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }, t);
}

interface CatalogState {
  kinds: EventKind[];
  templates: Template[];
  loaded: boolean;
  load: () => Promise<void>;
  saveKinds: (k: EventKind[]) => Promise<void>;
  saveTemplates: (t: Template[]) => Promise<void>;
}

export const useCatalog = create<CatalogState>((set) => ({
  kinds: DEFAULT_KINDS,
  templates: DEFAULT_TEMPLATES,
  loaded: false,
  load: async () => {
    try {
      const [k, t] = await Promise.all([readKey<EventKind[]>('eventTypes'), readKey<Template[]>('templates')]);
      set({
        kinds: Array.isArray(k) && k.length > 0 ? k : DEFAULT_KINDS,
        templates: Array.isArray(t) && t.length > 0 ? t : DEFAULT_TEMPLATES,
        loaded: true,
      });
    } catch {
      set({ loaded: true }); // sin conexión: defaults locales
    }
  },
  saveKinds: async (kinds) => {
    set({ kinds });
    try {
      await writeKey('eventTypes', kinds);
    } catch {
      // queda local hasta tener conexión (Fase 8 lo sincroniza)
    }
  },
  saveTemplates: async (templates) => {
    set({ templates });
    try {
      await writeKey('templates', templates);
    } catch {
      // idem
    }
  },
}));

export function colorForKind(kinds: EventKind[], name: string): string {
  return kinds.find((k) => k.name === name)?.color ?? '#8B7BC7';
}
