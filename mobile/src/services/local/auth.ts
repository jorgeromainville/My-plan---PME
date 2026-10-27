// "Cuenta" del invitado: perfil local, borrado de datos y contraseñas.
// No hay servidor: nada de esto crea filas en PostgreSQL.
import type { SessionUser } from '../../store/useSession';
import { ApiError } from '../errors';
import { getGuestUser, setGuestUser } from '../guestProfile';
import { countLocalRows, resetLocalData } from './db';
import { asString } from './query';

export async function me(): Promise<{ user: SessionUser }> {
  return { user: await getGuestUser() };
}

export async function updateMe(body: Record<string, unknown>): Promise<{ user: SessionUser }> {
  const current = await getGuestUser();
  const next: SessionUser = {
    ...current,
    name: body.name == null ? current.name : asString(body.name).slice(0, 80) || 'Invitado',
    currency: body.currency == null ? current.currency : asString(body.currency).toUpperCase().slice(0, 6),
    currencySymbol:
      body.currencySymbol == null ? current.currencySymbol : asString(body.currencySymbol).slice(0, 6),
    theme:
      body.theme === 'light' || body.theme === 'dark' || body.theme === 'andean' || body.theme === 'auto'
        ? body.theme
        : current.theme,
    weekStartsOn: body.weekStartsOn === 'sunday' ? 'sunday' : body.weekStartsOn === 'monday' ? 'monday' : current.weekStartsOn,
  };
  return { user: await setGuestUser(next) };
}

/** Borra los datos locales (equivale a "eliminar mi cuenta"). */
export async function deleteAccount(body: Record<string, unknown>): Promise<{ ok: true }> {
  if (asString(body.confirm).trim().toUpperCase() !== 'ELIMINAR') {
    throw new ApiError(400, 'Escribe ELIMINAR para confirmar.');
  }
  await resetLocalData();
  return { ok: true };
}

export async function changePassword(): Promise<never> {
  throw new ApiError(
    400,
    'El modo invitado no tiene contraseña. Crea una cuenta con Google para proteger tus datos.',
  );
}

export async function accountInfo(): Promise<{ mode: 'guest'; rows: number }> {
  return { mode: 'guest', rows: await countLocalRows() };
}
