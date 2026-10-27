// Lugares en SQLite: mismo contrato que `backend/src/controllers/places.controller.ts`.
import { ApiError } from '../errors';
import { all, insertRow, newId, nowIso, one, run, updateRow } from './db';
import { asNumber, asString, requireText } from './query';
import { detachPlace } from './events';

type PlaceRow = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  color: string | null;
  createdAt: string;
};

export const DEFAULT_PLACE_CATS: Record<string, string> = {
  Casa: '#6FA287',
  Trabajo: '#6B9ECF',
  Cliente: '#C9A44A',
  Restaurante: '#D98162',
  Compras: '#E07A5F',
  Gimnasio: '#4DB6AC',
  Estudio: '#8B7BC7',
  Amigos: '#C9A44A',
};

export async function listPlaces(q: Record<string, string>): Promise<{ places: PlaceRow[] }> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (q.category) {
    clauses.push('category = ?');
    params.push(q.category);
  }
  if (q.q) {
    clauses.push('(name LIKE ? OR address LIKE ?)');
    const like = `%${q.q}%`;
    params.push(like, like);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const places = await all<PlaceRow>(
    `SELECT * FROM places${where} ORDER BY name ASC LIMIT 500`,
    params,
  );
  return { places };
}

export async function getPlace(id: string): Promise<{ place: PlaceRow }> {
  const place = await one<PlaceRow>('SELECT * FROM places WHERE id = ?', [id]);
  if (!place) throw new ApiError(404, 'Lugar no encontrado');
  return { place };
}

function coord(v: unknown, min: number, max: number): number {
  const n = asNumber(v, Number.NaN);
  if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(400, 'Ubicación no válida');
  return n;
}

export async function createPlace(body: Record<string, unknown>): Promise<{ place: PlaceRow }> {
  const id = newId();
  await insertRow('places', {
    id,
    name: requireText(body.name, 'El nombre'),
    category: asString(body.category, 'Personalizado') || 'Personalizado',
    address: body.address ? asString(body.address).slice(0, 200) : null,
    latitude: coord(body.latitude, -90, 90),
    longitude: coord(body.longitude, -180, 180),
    note: body.note ? asString(body.note).slice(0, 500) : null,
    color: body.color ? asString(body.color) : null,
    createdAt: nowIso(),
  });
  return getPlace(id);
}

export async function updatePlace(id: string, body: Record<string, unknown>): Promise<{ place: PlaceRow }> {
  await getPlace(id);
  await updateRow('places', id, body, {
    name: (v) => requireText(v, 'El nombre'),
    category: (v) => asString(v, 'Personalizado') || 'Personalizado',
    address: (v) => (v == null ? null : asString(v).slice(0, 200)),
    latitude: (v) => coord(v, -90, 90),
    longitude: (v) => coord(v, -180, 180),
    note: (v) => (v == null ? null : asString(v).slice(0, 500)),
    color: (v) => (v == null ? null : asString(v)),
  });
  return getPlace(id);
}

export async function deletePlace(id: string): Promise<{ ok: true }> {
  await getPlace(id);
  await detachPlace(id);
  await run('DELETE FROM places WHERE id = ?', [id]);
  return { ok: true };
}

export interface MapItemOut {
  id: string;
  kind: 'place' | 'contact';
  refId: string;
  name: string;
  category: string;
  color: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
}

/** Lugares + contactos con ubicación, unificados como `/api/places/map/items`. */
export async function mapItems(q: Record<string, string>): Promise<{ items: MapItemOut[] }> {
  const category = q.category && q.category !== 'Todos' ? q.category : '';
  const search = (q.q ?? '').toLowerCase();

  const places = await all<PlaceRow>(
    `SELECT * FROM places WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     ${category ? 'AND category = ?' : ''} LIMIT 500`,
    category ? [category] : [],
  );
  const contacts = await all<{
    id: string;
    firstName: string;
    lastName: string | null;
    category: string;
    latitude: number;
    longitude: number;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
  }>(
    `SELECT id, firstName, lastName, category, latitude, longitude, address, phone, whatsapp
     FROM contacts WHERE latitude IS NOT NULL AND longitude IS NOT NULL
     ${category ? 'AND category = ?' : ''} LIMIT 500`,
    category ? [category] : [],
  );

  const items: MapItemOut[] = [
    ...places.map((p) => ({
      id: `p-${p.id}`,
      kind: 'place' as const,
      refId: p.id,
      name: p.name,
      category: p.category,
      color: p.color ?? DEFAULT_PLACE_CATS[p.category] ?? '#8B7BC7',
      latitude: p.latitude ?? 0,
      longitude: p.longitude ?? 0,
      address: p.address ?? null,
      phone: null,
    })),
    ...contacts.map((c) => ({
      id: `c-${c.id}`,
      kind: 'contact' as const,
      refId: c.id,
      name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`,
      category: c.category,
      color: null,
      latitude: c.latitude,
      longitude: c.longitude,
      address: c.address ?? null,
      phone: c.phone ?? c.whatsapp ?? null,
    })),
  ];

  return {
    items: search
      ? items.filter((i) => i.name.toLowerCase().includes(search))
      : items,
  };
}
