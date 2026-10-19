import * as Localization from 'expo-localization';
import { storage } from './storage';

// País del dispositivo (ej. "PE", "US"). Para los feriados si no hay ajuste manual.
export function deviceCountry(): string {
  try {
    const locales = Localization.getLocales();
    return locales[0]?.regionCode ?? 'PE';
  } catch {
    return 'PE';
  }
}

// Feriados vía Nager.Date (gratis, sin key). Cache local por año+país.
export interface Holiday {
  date: string; // "2026-10-08"
  name: string;
  localName: string;
}

const KEY = '@planner/cache:holidays';

export async function getHolidays(year: number, country = 'PE'): Promise<Holiday[]> {
  const cacheKey = `${KEY}:${country}:${year}`;
  try {
    const cached = await storage.getCache<Holiday[]>(cacheKey);
    if (cached) return cached;
  } catch {
    // sigue a red
  }
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
  if (!res.ok) throw new Error('No se pudieron cargar los feriados');
  const list = (await res.json()) as Holiday[];
  try {
    await storage.setCache(cacheKey, list);
  } catch {
    // solo memoria
  }
  return list;
}

export function holidayMap(list: Holiday[]): Map<string, Holiday> {
  const m = new Map<string, Holiday>();
  for (const h of list) m.set(h.date, h);
  return m;
}
