import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

// Ajustes de agenda y formato. Persisten en el teléfono.
export type HourFormat = '24h' | '12h';

interface Prefs {
  hourFormat: HourFormat;
  dayStart: number; // 0-23
  dayEnd: number; // 1-24
  lastCategory: string;
  holidayCountry: string; // '' = auto por dispositivo (ej. PE, US)
  reminders: boolean; // avisos locales de eventos/tareas/seguimientos/metas
  demoCleared: boolean; // el usuario pidió ocultar los datos de ejemplo
  loaded: boolean;
  load: () => Promise<void>;
  set: (p: Partial<Pick<Prefs, 'hourFormat' | 'dayStart' | 'dayEnd' | 'lastCategory' | 'holidayCountry' | 'reminders' | 'demoCleared'>>) => Promise<void>;
}

const KEY = '@planner/prefs';

export const usePrefs = create<Prefs>((set, get) => ({
  hourFormat: '24h',
  dayStart: 0,
  dayEnd: 24,
  lastCategory: 'Otros',
  holidayCountry: '',
  reminders: true,
  demoCleared: false,
  loaded: false,
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ ...JSON.parse(raw), loaded: true });
      else set({ loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  set: async (p) => {
    set(p);
    try {
      const { hourFormat, dayStart, dayEnd, lastCategory, holidayCountry, reminders, demoCleared } = { ...get(), ...p };
      await AsyncStorage.setItem(KEY, JSON.stringify({ hourFormat, dayStart, dayEnd, lastCategory, holidayCountry, reminders, demoCleared }));
    } catch {
      // sin persistencia, sigue en memoria
    }
  },
}));

// "14:30" → "14:30" | "2:30 p. m."
export function fmtHour(hhmm: string, format: HourFormat): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (format === '24h' || Number.isNaN(h)) return hhmm;
  const ap = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
