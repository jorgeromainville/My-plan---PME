// Utilidades del enrutador local: parseo de ruta/query y filtros comunes.
// Se evita `URL` porque en Hermes no está disponible de forma fiable.
import { ApiError } from '../errors';

export interface ParsedPath {
  parts: string[]; // ['api', 'tasks', 'abc']
  q: Record<string, string>;
}

export function parsePath(path: string): ParsedPath {
  const [rawPath, rawQuery = ''] = path.split('?');
  const parts = rawPath.split('/').filter(Boolean).map(decodeURIComponent);
  const q: Record<string, string> = {};
  for (const pair of rawQuery.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = decodeURIComponent(i >= 0 ? pair.slice(0, i) : pair);
    const v = i >= 0 ? decodeURIComponent(pair.slice(i + 1)) : '';
    q[k] = v;
  }
  return { parts, q };
}

/** Condiciones `>= from` / `<= to` sobre una columna de fecha ISO. */
export function rangeSql(
  q: Record<string, string>,
  column = 'date',
): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (q.from) {
    clauses.push(`${column} >= ?`);
    params.push(q.from);
  }
  if (q.to) {
    clauses.push(`${column} <= ?`);
    params.push(q.to);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
}

export function toIso(value: unknown): string {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Fecha no válida');
  return d.toISOString();
}

export function optionalIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  return toIso(value);
}

export function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  return String(value);
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function requireText(value: unknown, field: string, max = 120): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new ApiError(400, `${field} es obligatorio`);
  return s.slice(0, max);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
