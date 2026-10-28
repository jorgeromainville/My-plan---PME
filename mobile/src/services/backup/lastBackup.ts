// Fecha de la última copia guardada en este teléfono (para recordatorios).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatLongEs, parseLocalDay, toLocalKey } from '../../utils/dates';

const KEY = '@planner/lastBackupAt';

export async function markBackup(at = new Date()): Promise<string> {
  const iso = at.toISOString();
  try {
    await AsyncStorage.setItem(KEY, iso);
  } catch {
    // sin persistencia: el aviso de esta sesión ya se mostró
  }
  return iso;
}

export async function getLastBackup(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/** "Última copia: hoy / ayer / hace N días / 12 de octubre de 2026". */
export function lastBackupLabel(iso: string | null): string {
  if (!iso) return 'Todavía no has guardado una copia en este teléfono.';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = parseLocalDay(toLocalKey());
  const then = parseLocalDay(toLocalKey(d));
  if (!today || !then) return `Última copia: ${formatLongEs(d)}.`;
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'Última copia: hoy.';
  if (days === 1) return 'Última copia: ayer.';
  if (days < 30) return `Última copia: hace ${days} días.`;
  return `Última copia: ${formatLongEs(d)}.`;
}
