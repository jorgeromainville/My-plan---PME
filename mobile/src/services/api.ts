// Cliente API con refresh automático, errores en español y **soporte offline**:
//   - los GET se guardan en caché y se devuelven si no hay red,
//   - los cambios (POST/PATCH/DELETE) de entidades conocidas se encolan y se
//     pintan al instante; al volver la conexión se envían en orden,
//   - los ids provisionales (`tmp_...`) se sustituyen por los reales.
//
// La cola vive en `sync.ts` y la lógica pura (overlay/ids) en `syncCore.ts`.
import Constants from 'expo-constants';
import { useNet } from '../store/useNet';
import { storage } from './storage';
import {
  applyOverlay,
  entityFor,
  isTempId,
  newOp,
  rewriteIds,
  rewritePath,
  syntheticResponse,
  type OpMethod,
  type PendingOp,
} from './syncCore';
import { addOp, flushOps, getIdMap, loadOps, type FlushResult } from './sync';

// En desarrollo, el servidor de Metro corre en la misma PC/IP LAN que la API,
// así que derivamos la IP de ahí: si cambia el Wi-Fi, la app se adapta sola y
// ya no hay que editar `mobile/.env`.
function resolveBase(): string {
  const env = process.env.EXPO_PUBLIC_API_URL ?? '';
  const port = env.match(/:(\d{2,5})(?:\/|$)/)?.[1] ?? '4000';
  // En Expo Go, hostUri es "10.19.140.106:8081".
  const ip = Constants.expoConfig?.hostUri?.split(':')[0] ?? '';
  const isLan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d/.test(ip);
  if (__DEV__ && isLan) return `http://${ip}:${port}`;
  return env || `http://localhost:4000`;
}

export const API_BASE = resolveBase();
const BASE = API_BASE;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onSessionExpired: () => void = () => {};
export function setOnSessionExpired(fn: () => void) {
  onSessionExpired = fn;
}

// Timeout corto: si el servidor no contesta (PC apagada, otra red), mejor
// fallar rápido y guardar en local que dejar el botón girando un minuto.
const TIMEOUT_MS = 8000;

async function raw(path: string, opts: RequestInit, token?: string | null) {
  // El escáner (IA/OCR) tarda ~10 s: no se le puede aplicar el timeout corto.
  const ms = path.startsWith('/api/scanner') ? 60000 : TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(`${BASE}${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ¿Se puede resolver sin conexión? (caché para GET, cola para cambios)
function offlineTarget(path: string, opts: RequestInit): boolean {
  if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return false;
  const method = (opts.method ?? 'GET').toUpperCase();
  if (method === 'GET') return true;
  // DELETE y POST sin cuerpo (p. ej. "marcar contactado") también valen.
  if (opts.body != null && typeof opts.body !== 'string') return false; // FormData
  return entityFor(path) !== null;
}

export async function api<T>(
  path: string,
  opts: RequestInit = {},
  token?: string | null,
  retry = true,
  offline = true,
): Promise<T> {
  const method = ((opts.method ?? 'GET') as string).toUpperCase();
  const isGet = method === 'GET';
  const canOffline = offline && offlineTarget(path, opts);

  // ── Ids temporales ────────────────────────────────────────────────────────
  // Si la pantalla todavía usa un `tmp_...`, se traduce al id real (si ya se
  // sincronizó) o se responde desde la cola (si sigue pendiente).
  if (path.includes('tmp_')) {
    const hit = entityFor(path);
    if (isGet && hit && hit.kind === 'item' && isTempId(hit.id)) {
      const map = await getIdMap();
      const real = map[hit.id];
      if (real) {
        path = path.split(hit.id).join(real);
      } else {
        const op = (await loadOps()).find((o) => o.tempId === hit.id);
        if (op) return syntheticResponse(op) as T;
      }
    } else {
      const map = await getIdMap();
      path = rewritePath(path, map);
      if (!isGet && typeof opts.body === 'string' && opts.body.includes('tmp_')) {
        opts = { ...opts, body: JSON.stringify(rewriteIds(JSON.parse(opts.body), map)) };
      }
    }
  }

  // ── Cambios con cola pendiente: se encolan para no romper el orden ────────
  if (!isGet && canOffline) {
    const pending = await loadOps();
    if (pending.length > 0) {
      const op = newOp(method as OpMethod, path, typeof opts.body === 'string' ? opts.body : undefined);
      await addOp(op);
      scheduleFlush();
      return syntheticResponse(op) as T;
    }
  }

  let res: Response;
  try {
    res = await raw(path, opts, token);
    useNet.getState().setOffline(false);
  } catch {
    useNet.getState().setOffline(true);
    if (canOffline) {
      if (isGet) {
        const cached = await storage.getCache<T>(path);
        if (cached != null) return applyOverlay(path, cached, await loadOps());
      } else {
        const op = newOp(method as OpMethod, path, typeof opts.body === 'string' ? opts.body : undefined);
        await addOp(op);
        return syntheticResponse(op) as T;
      }
    }
    throw new ApiError(0, 'Sin conexión con el servidor. Revisa el Wi-Fi y que la API esté corriendo.');
  }

  if (res.status === 401 && retry && !path.startsWith('/api/auth/')) {
    // Intenta renovar una vez con el refresh token.
    try {
      const refresh = await storage.getRefresh();
      if (refresh) {
        const rr = await raw('/api/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh }),
        });
        if (rr.ok) {
          const j = (await rr.json()) as { access: string; refresh: string };
          await storage.setTokens(j.access, j.refresh);
          return api<T>(path, opts, j.access, false);
        }
      }
    } catch {
      // cae al 401 de abajo
    }
    onSessionExpired();
    throw new ApiError(401, 'Sesión expirada. Entra de nuevo.');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await friendly(res));
  }

  const data = (await res.json()) as T;

  if (canOffline) {
    if (isGet) {
      void storage.setCache(path, data);
      const ops = await loadOps();
      if (ops.length > 0) {
        scheduleFlush();
        return applyOverlay(path, data, ops);
      }
    } else {
      scheduleFlush();
    }
  }
  return data;
}

// ── Sincronización de la cola ───────────────────────────────────────────────
let flushing = false;
let lastFlush = 0;
const FLUSH_GAP = 15000;

function scheduleFlush(delay = 400) {
  setTimeout(() => {
    void flushPending();
  }, delay);
}

/** Envía lo pendiente. `force` ignora el freno de 15 s (botón "Sincronizar ahora"). */
export async function flushPending(force = false): Promise<FlushResult> {
  const pending = await loadOps();
  if (!pending.length) return { sent: 0, failed: 0, left: 0 };
  if (flushing) return { sent: 0, failed: 0, left: pending.length };
  if (!force && Date.now() - lastFlush < FLUSH_GAP) {
    return { sent: 0, failed: 0, left: pending.length };
  }
  flushing = true;
  lastFlush = Date.now();
  try {
    const t = await storage.getToken();
    return await flushOps((op) =>
      api<any>(op.path, { method: op.method, body: op.body }, t, true, false),
    );
  } finally {
    flushing = false;
  }
}

/** Para la UI: cuántos cambios esperan envío. */
export async function pendingCount(): Promise<number> {
  return (await loadOps()).length;
}

async function friendly(res: Response): Promise<string> {
  let body: { error?: string; details?: { path: string; message: string }[] } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return `Error ${res.status}. Intenta de nuevo.`;
  }
  if (body.details?.length) {
    const d = body.details[0];
    return `${d.path}: ${d.message}`;
  }
  return body.error ?? `Error ${res.status}. Intenta de nuevo.`;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Error inesperado.';
}
