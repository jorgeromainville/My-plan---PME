import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionUser } from '../store/useSession';

// Perfil del invitado: mismo formato que el usuario de la nube para que Perfil,
// moneda, tema e inicio de semana funcionen sin tocar las pantallas.
// Vive en AsyncStorage (no en SQLite) porque es configuración, no datos.
const KEY = '@planner/guestUser';

export const GUEST_USER: SessionUser = {
  id: 'guest',
  name: 'Invitado',
  email: '',
  currency: 'PEN',
  currencySymbol: 'S/',
  theme: 'auto',
  weekStartsOn: 'monday',
};

export async function getGuestUser(): Promise<SessionUser> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return GUEST_USER;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    return { ...GUEST_USER, ...parsed, id: 'guest', email: '' };
  } catch {
    return GUEST_USER;
  }
}

export async function setGuestUser(user: SessionUser): Promise<SessionUser> {
  const next: SessionUser = { ...GUEST_USER, ...user, id: 'guest', email: '' };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sin persistencia: se mantiene en memoria en useSession
  }
  return next;
}

/** ¿El invitado ya creó datos? Sirve para decidir si ofrecer la migración. */
export async function hasGuestData(): Promise<boolean> {
  try {
    // Import perezoso: no cargar SQLite si la sesión es de cuenta.
    const { countLocalRows } = await import('./local/db');
    return (await countLocalRows()) > 0;
  } catch {
    return false;
  }
}
