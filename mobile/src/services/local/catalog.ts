// Ajustes y categorías del invitado: mismo contrato que settings/categories.
import { ApiError } from '../errors';
import { all, newId, nowIso, one, run } from './db';
import { asString, requireText } from './query';
import { countContactsInCategory } from './contacts';
import { countExpensesInCategory } from './expenses';

export const DEFAULT_CONTACT_CATEGORIES = [
  'Amigos',
  'Clientes',
  'Proveedores',
  'Familia',
  'Compañeros',
  'Otros',
];

export const DEFAULT_CONTACT_COLORS: Record<string, string> = {
  Amigos: '#C9A44A',
  Clientes: '#6B9ECF',
  Proveedores: '#D98162',
  Familia: '#6FA287',
  Compañeros: '#8B7BC7',
  Otros: '#8A8F8B',
};

export const DEFAULT_EXPENSE_CATS: Record<string, string> = {
  Alimentación: '#D98162',
  Transporte: '#6B9ECF',
  Servicios: '#8B7BC7',
  Compras: '#C9A44A',
  Trabajo: '#6FA287',
  Educación: '#4DB6AC',
  Entretenimiento: '#E07A5F',
  Otros: '#8A8F8B',
};

type Category = { name: string; color: string | null };

async function customCategories(table: string): Promise<Category[]> {
  return all<Category>(`SELECT name, color FROM ${table} ORDER BY name ASC`);
}

function mergeCategories(defaults: Record<string, string | null>, custom: Category[]): Category[] {
  const byName = new Map<string, string | null>();
  for (const [name, color] of Object.entries(defaults)) byName.set(name, color);
  for (const c of custom) byName.set(c.name, c.color);
  return [...byName.entries()].map(([name, color]) => ({ name, color }));
}

// ── Ajustes genéricos (tipos de evento, plantillas) ──────────────────────────
export async function getSetting(key: string): Promise<{ key: string; value: unknown }> {
  const row = await one<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  let value: unknown = null;
  if (row) {
    try {
      value = JSON.parse(row.value);
    } catch {
      value = null;
    }
  }
  return { key, value };
}

export async function putSetting(key: string, value: unknown): Promise<{ key: string; value: unknown }> {
  const raw = JSON.stringify(value ?? null);
  if (raw.length > 20 * 1024) throw new ApiError(400, 'Valor muy grande');
  await run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, raw],
  );
  return { key, value: JSON.parse(raw) };
}

// ── Categorías de contactos ──────────────────────────────────────────────────
export async function listContactCategories(): Promise<{ categories: Category[] }> {
  const custom = await customCategories('contact_categories');
  return { categories: mergeCategories(DEFAULT_CONTACT_COLORS, custom) };
}

export async function createContactCategory(body: Record<string, unknown>): Promise<Category> {
  const name = requireText(body.name, 'El nombre', 40);
  const color = body.color ? asString(body.color) : null;
  if (DEFAULT_CONTACT_CATEGORIES.includes(name)) {
    return { name, color: DEFAULT_CONTACT_COLORS[name] ?? null };
  }
  await run(
    `INSERT INTO contact_categories (id, name, color, createdAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET color = COALESCE(excluded.color, contact_categories.color)`,
    [newId(), name, color ?? '#8B7BC7', nowIso()],
  );
  const row = await one<Category>('SELECT name, color FROM contact_categories WHERE name = ?', [name]);
  return row ?? { name, color };
}

export async function deleteContactCategory(name: string): Promise<{ ok: true }> {
  if (DEFAULT_CONTACT_CATEGORIES.includes(name)) {
    throw new ApiError(400, 'Categoría del sistema, no se elimina');
  }
  const inUse = await countContactsInCategory(name);
  if (inUse > 0) {
    throw new ApiError(400, `En uso por ${inUse} contacto(s). Reasígnalos primero.`);
  }
  await run('DELETE FROM contact_categories WHERE name = ?', [name]);
  return { ok: true };
}

// ── Categorías de gastos ─────────────────────────────────────────────────────
export async function listExpenseCategories(): Promise<{ categories: Category[] }> {
  const custom = await customCategories('expense_categories');
  return { categories: mergeCategories(DEFAULT_EXPENSE_CATS, custom) };
}

export async function createExpenseCategory(body: Record<string, unknown>): Promise<Category> {
  const name = requireText(body.name, 'El nombre', 40);
  const color = body.color ? asString(body.color) : null;
  if (DEFAULT_EXPENSE_CATS[name]) {
    return { name, color: DEFAULT_EXPENSE_CATS[name] };
  }
  await run(
    `INSERT INTO expense_categories (id, name, color, createdAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET color = COALESCE(excluded.color, expense_categories.color)`,
    [newId(), name, color ?? '#8A8F8B', nowIso()],
  );
  const row = await one<Category>('SELECT name, color FROM expense_categories WHERE name = ?', [name]);
  return row ?? { name, color };
}

export async function deleteExpenseCategory(name: string): Promise<{ ok: true }> {
  if (DEFAULT_EXPENSE_CATS[name]) {
    throw new ApiError(400, 'Categoría del sistema, no se elimina');
  }
  const inUse = await countExpensesInCategory(name);
  if (inUse > 0) {
    throw new ApiError(400, `En uso por ${inUse} gasto(s). Reasígnalos primero.`);
  }
  await run('DELETE FROM expense_categories WHERE name = ?', [name]);
  return { ok: true };
}
