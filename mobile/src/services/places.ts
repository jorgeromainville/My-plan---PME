import { api } from './api';
import { storage } from './storage';

export interface Place {
  id: string;
  name: string;
  category: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  note?: string | null;
  color?: string | null;
}

export interface PlaceInput {
  name: string;
  category?: string;
  address?: string;
  latitude: number;
  longitude: number;
  note?: string;
  color?: string;
}

export interface MapItem {
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

export const DEFAULT_PLACE_CATS: { name: string; color: string }[] = [
  { name: 'Casa', color: '#6FA287' },
  { name: 'Trabajo', color: '#6B9ECF' },
  { name: 'Cliente', color: '#C9A44A' },
  { name: 'Restaurante', color: '#D98162' },
  { name: 'Compras', color: '#E07A5F' },
  { name: 'Gimnasio', color: '#4DB6AC' },
  { name: 'Estudio', color: '#8B7BC7' },
  { name: 'Amigos', color: '#C9A44A' },
];

// Emoji por categoría de lugar (personalizadas usan 📍).
export const PLACE_ICONS: Record<string, string> = {
  Casa: '🏠',
  Trabajo: '💼',
  Cliente: '🤝',
  Restaurante: '🍽️',
  Compras: '🛍️',
  Gimnasio: '🏋️',
  Estudio: '📚',
  Amigos: '👥',
};

export function placeIcon(category: string): string {
  return PLACE_ICONS[category] ?? '📍';
}

async function token() {
  return storage.getToken();
}

export async function mapItems(category?: string, q?: string): Promise<MapItem[]> {
  const t = await token();
  const qs = new URLSearchParams();
  if (category && category !== 'Todos') qs.set('category', category);
  if (q) qs.set('q', q);
  const r = await api<{ items: MapItem[] }>(`/api/places/map/items?${qs.toString()}`, {}, t);
  return r.items;
}

export async function listPlaces(): Promise<Place[]> {
  const t = await token();
  const r = await api<{ places: Place[] }>('/api/places', {}, t);
  return r.places;
}

export async function getPlace(id: string): Promise<Place> {
  const t = await token();
  const r = await api<{ place: Place }>('/api/places/' + id, {}, t);
  return r.place;
}

export async function createPlace(input: PlaceInput): Promise<Place> {
  const t = await token();
  const r = await api<{ place: Place }>('/api/places', { method: 'POST', body: JSON.stringify(input) }, t);
  return r.place;
}

export async function updatePlace(id: string, input: Partial<PlaceInput>): Promise<Place> {
  const t = await token();
  const r = await api<{ place: Place }>(`/api/places/${id}`, { method: 'PATCH', body: JSON.stringify(input) }, t);
  return r.place;
}

export async function deletePlace(id: string): Promise<void> {
  const t = await token();
  await api(`/api/places/${id}`, { method: 'DELETE' }, t);
}
