// Lógica pura de la cola offline (sin dependencias de React Native, se puede
// probar con node/tsx):
//   - qué rutas son entidades encolables,
//   - cómo se superponen los cambios pendientes sobre lo que devuelve el
//     servidor (o la caché),
//   - cómo se reescriben los ids temporales (`tmp_...`) cuando el servidor ya
//     asignó los reales.
//
// Entidades soportadas sin conexión: tareas, ingresos, gastos, eventos,
// lugares, contactos (incluido "marcar contactado") y metas.

export type OpMethod = 'POST' | 'PATCH' | 'DELETE';

export interface PendingOp {
  id: string;
  method: OpMethod;
  path: string;
  body?: string; // JSON tal cual se enviaría
  tempId?: string; // solo en POST: id provisional para pintarlo ya
  at: number; // cuándo se encoló
}

export interface EntityCfg {
  name: string; // segmento de URL: /api/tasks
  key: string; // clave de la lista: { tasks: [...] }
  singular: string; // clave del objeto: { task: {...} }
  dateField?: string; // campo de fecha para decidir si entra en un rango
}

export const ENTITIES: EntityCfg[] = [
  { name: 'tasks', key: 'tasks', singular: 'task', dateField: 'date' },
  { name: 'incomes', key: 'incomes', singular: 'income', dateField: 'date' },
  { name: 'expenses', key: 'expenses', singular: 'expense', dateField: 'date' },
  { name: 'events', key: 'events', singular: 'event', dateField: 'date' },
  { name: 'places', key: 'places', singular: 'place' },
  { name: 'contacts', key: 'contacts', singular: 'contact' },
  { name: 'goals', key: 'goals', singular: 'goal' },
];

export type EntityHit =
  | { cfg: EntityCfg; kind: 'list' }
  | { cfg: EntityCfg; id: string; kind: 'item' }
  | { cfg: EntityCfg; id: string; kind: 'touch' };

export function entityFor(path: string): EntityHit | null {
  const clean = path.split('?')[0];
  const p = clean.split('/').filter(Boolean);
  if (p[0] !== 'api') return null;
  const cfg = ENTITIES.find((e) => e.name === p[1]);
  if (!cfg) return null;
  if (p.length === 2) return { cfg, kind: 'list' };
  if (p.length === 3) {
    if (cfg.name === 'goals' && p[2] === 'progress') return { cfg, kind: 'list' };
    return { cfg, id: decodeURIComponent(p[2]), kind: 'item' };
  }
  if (cfg.name === 'contacts' && p.length === 4 && p[3] === 'touch') {
    return { cfg, id: decodeURIComponent(p[2]), kind: 'touch' };
  }
  return null;
}

export function isTempId(id: string): boolean {
  return id.startsWith('tmp_');
}

export function makeTempId(): string {
  return `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function newOp(
  method: OpMethod,
  path: string,
  body?: string,
): PendingOp {
  const at = Date.now();
  const op: PendingOp = {
    id: `${at.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    method,
    path,
    body,
    at,
  };
  const hit = entityFor(path);
  if (method === 'POST' && hit && hit.kind === 'list') op.tempId = makeTempId();
  return op;
}

function safeParse(s?: string): Record<string, any> {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function inRange(
  body: Record<string, any>,
  field: string | undefined,
  from: string | null,
  to: string | null,
): boolean {
  if (!field || (!from && !to)) return true;
  const raw = body[field];
  if (raw == null) return true;
  const t = new Date(raw as string).getTime();
  if (Number.isNaN(t)) return true;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

function queryParam(path: string, name: string): string | null {
  const q = path.split('?')[1];
  if (!q) return null;
  for (const part of q.split('&')) {
    const [k, v = ''] = part.split('=');
    if (decodeURIComponent(k) === name) return decodeURIComponent(v) || null;
  }
  return null;
}

// Aplica la cola sobre una respuesta del servidor o de la caché.
// No muta `data`: lo que se guarda en caché debe quedar "limpio".
export function applyOverlay<T>(path: string, data: T, ops: PendingOp[]): T {
  if (!ops.length || !data || typeof data !== 'object') return data;
  // El mapa usa un endpoint derivado (lugares + contactos unificados).
  if (path.split('?')[0] === '/api/places/map/items') return applyMapOverlay(path, data as any, ops) as T;
  const hit = entityFor(path);
  if (!hit) return data;

  const out: any = { ...(data as any) };

  if (hit.kind === 'list') {
    const list = out[hit.cfg.key];
    if (!Array.isArray(list)) return data;
    const from = queryParam(path, 'from');
    const to = queryParam(path, 'to');
    let items: any[] = list.map((x: any) => ({ ...x }));

    for (const op of ops) {
      const h = entityFor(op.path);
      if (!h || h.cfg.name !== hit.cfg.name) continue;
      const body = safeParse(op.body);

      if (h.kind === 'list' && op.method === 'POST') {
        if (!inRange(body, hit.cfg.dateField, from, to)) continue;
        items.push({ ...body, id: op.tempId ?? `tmp_${op.id}`, __pending: true });
      } else if (h.kind === 'touch' && op.method === 'POST') {
        const now = new Date(op.at).toISOString();
        items = items.map((x: any) =>
          x.id === h.id ? { ...x, lastContactAt: now, nextContactAt: null, __pending: true } : x,
        );
      } else if (h.kind === 'item' && h.id) {
        if (op.method === 'PATCH') {
          items = items.map((x: any) => (x.id === h.id ? { ...x, ...body, __pending: true } : x));
        } else if (op.method === 'DELETE') {
          items = items.filter((x: any) => x.id !== h.id);
        }
      }
    }

    out[hit.cfg.key] = items;
    // incomes/expenses devuelven un total (suma) además de la lista.
    if (typeof out.total === 'number') {
      const sum = items.reduce((s, x) => s + Number(x.total ?? x.amount ?? 0), 0);
      out.total = Math.round(sum * 100) / 100;
    }
    return out as T;
  }

  if ((hit.kind === 'item' || hit.kind === 'touch') && hit.id) {
    const key = hit.kind === 'touch' ? 'contact' : hit.cfg.singular;
    const obj = out[key];
    if (!obj) return data;
    for (const op of ops) {
      const h = entityFor(op.path);
      if (!h || h.cfg.name !== hit.cfg.name || h.kind === 'list' || h.id !== hit.id) continue;
      if (op.method === 'PATCH') out[key] = { ...obj, ...safeParse(op.body), __pending: true };
      if (op.method === 'DELETE') out[key] = null;
      if (h.kind === 'touch') {
        out[key] = {
          ...obj,
          lastContactAt: new Date(op.at).toISOString(),
          nextContactAt: null,
          __pending: true,
        };
      }
    }
  }
  return out as T;
}

// Superpone la cola sobre el endpoint unificado del mapa
// (`/api/places/map/items`): lugares + contactos con ubicación.
function applyMapOverlay(path: string, data: any, ops: PendingOp[]): any {
  if (!Array.isArray(data.items)) return data;
  const cat = queryParam(path, 'category');
  const q = (queryParam(path, 'q') ?? '').toLowerCase();
  const matches = (it: any) =>
    (!cat || cat === 'Todos' || it.category === cat) &&
    (!q || String(it.name ?? '').toLowerCase().includes(q));

  let items: any[] = data.items.map((x: any) => ({ ...x }));

  for (const op of ops) {
    const h = entityFor(op.path);
    if (!h) continue;
    const isPlace = h.cfg.name === 'places';
    const isContact = h.cfg.name === 'contacts';
    if (!isPlace && !isContact) continue;
    const kind = isPlace ? 'place' : 'contact';
    const prefix = isPlace ? 'p-' : 'c-';
    const body = safeParse(op.body);

    if (h.kind === 'list' && op.method === 'POST') {
      if (body.latitude == null || body.longitude == null) continue;
      const id = op.tempId ?? `tmp_${op.id}`;
      const name = isPlace
        ? String(body.name ?? '')
        : `${body.firstName ?? ''}${body.lastName ? ' ' + body.lastName : ''}`.trim();
      const it = {
        id: prefix + id,
        kind,
        refId: id,
        name,
        category: body.category ?? '',
        color: isPlace ? body.color ?? null : null,
        latitude: body.latitude,
        longitude: body.longitude,
        address: body.address ?? null,
        phone: isPlace ? null : body.whatsapp ?? body.phone ?? null,
        __pending: true,
      };
      if (matches(it)) items.push(it);
      continue;
    }

    if (h.kind === 'item' && h.id) {
      const same = (x: any) => x.kind === kind && x.refId === h.id;
      if (op.method === 'DELETE') {
        items = items.filter((x) => !same(x));
      } else if (op.method === 'PATCH') {
        items = items.map((x) => {
          if (!same(x)) return x;
          const patched: any = { ...x, __pending: true };
          if (body.name != null) patched.name = body.name;
          if (isContact && (body.firstName != null || body.lastName != null)) {
            const nm = `${body.firstName ?? ''}${body.lastName ? ' ' + body.lastName : ''}`.trim();
            if (nm) patched.name = nm;
          }
          for (const f of ['category', 'latitude', 'longitude', 'address', 'color']) {
            if (body[f] != null) patched[f] = body[f];
          }
          if (isContact && (body.whatsapp != null || body.phone != null)) {
            patched.phone = body.whatsapp ?? body.phone;
          }
          return patched;
        });
      }
    }
  }
  return { ...data, items };
}

// Dos POST idénticos seguidos (típico doble toque porque "no pasaba nada") son
// el mismo registro: se conserva uno y se reapuntan los cambios posteriores.
export function dedupeOps(ops: PendingOp[], windowMs = 900000): PendingOp[] {
  const keep = new Map<string, PendingOp>();
  const alias: Record<string, string> = {};
  const out: PendingOp[] = [];
  for (const op of ops) {
    if (op.method === 'POST' && op.tempId) {
      const key = `${op.path}|${op.body ?? ''}`;
      const kept = keep.get(key);
      if (kept && kept.tempId && Math.abs(op.at - kept.at) < windowMs) {
        alias[op.tempId] = kept.tempId;
        continue;
      }
      keep.set(key, op);
    }
    out.push(op);
  }
  if (!Object.keys(alias).length) return out;
  return out.map((op) => ({
    ...op,
    path: rewritePath(op.path, alias),
    body: op.body ? JSON.stringify(rewriteIds(JSON.parse(op.body), alias)) : op.body,
  }));
}

// Cambia cualquier id temporal por el real (en cuerpos y rutas).
export function rewriteIds<T>(value: T, map: Record<string, string>): T {
  if (typeof value === 'string') return (map[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((v) => rewriteIds(v, map)) as T;
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = rewriteIds(v, map);
    return out;
  }
  return value;
}

export function rewritePath(path: string, map: Record<string, string>): string {
  if (!Object.keys(map).length) return path;
  const [clean, qs] = path.split('?');
  // Por segmentos exactos: `tmp_1` no debe tocar `tmp_15`.
  const cleanOut = clean
    .split('/')
    .map((seg) => map[seg] ?? seg)
    .join('/');
  if (!qs) return cleanOut;
  // También en los valores de la query (p. ej. `?goalId=tmp_...`).
  const qsOut = qs
    .split('&')
    .map((part) => {
      const [k, v = ''] = part.split('=');
      const dv = decodeURIComponent(v);
      return map[dv] ? `${k}=${encodeURIComponent(map[dv])}` : part;
    })
    .join('&');
  return `${cleanOut}?${qsOut}`;
}

// Respuesta inventada para que la pantalla siga funcionando sin servidor.
export function syntheticResponse(op: PendingOp): any {
  if (op.method === 'DELETE') return { ok: true };
  const hit = entityFor(op.path);
  if (!hit) return { ok: true };
  const body = safeParse(op.body);
  const id = hit.kind === 'list' ? op.tempId ?? `tmp_${op.id}` : hit.id;
  if (hit.kind === 'touch') {
    return {
      contact: {
        id,
        ...body,
        lastContactAt: new Date(op.at).toISOString(),
        nextContactAt: null,
        __pending: true,
      },
    };
  }
  return { [hit.cfg.singular]: { id, ...body, __pending: true } };
}
