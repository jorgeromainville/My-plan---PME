// Cola de cambios hechos sin conexión + mapa de ids temporales.
// La lógica pura (overlay, reescritura de ids) está en `syncCore.ts`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dedupeOps,
  isTempId,
  rewriteIds,
  rewritePath,
  type PendingOp,
} from './syncCore';

const OPS_KEY = '@planner/pendingOps';
const IDMAP_KEY = '@planner/idMap';
const MAX_IDMAP = 500;

let opsMemo: PendingOp[] | null = null;
let idMapMemo: Record<string, string> | null = null;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadOps(): Promise<PendingOp[]> {
  if (!opsMemo) {
    const raw = await readJson<PendingOp[]>(OPS_KEY, []);
    // Limpia duplicados de dobles toques que quedaron de antes.
    const clean = dedupeOps(raw);
    opsMemo = clean;
    if (clean.length !== raw.length) {
      try {
        await AsyncStorage.setItem(OPS_KEY, JSON.stringify(clean));
      } catch {
        // nada
      }
    }
  }
  return opsMemo;
}

export async function saveOps(next: PendingOp[]): Promise<void> {
  opsMemo = next;
  try {
    await AsyncStorage.setItem(OPS_KEY, JSON.stringify(next));
  } catch {
    // sin persistencia: la cola vive en memoria hasta cerrar la app
  }
}

export async function addOp(op: PendingOp): Promise<void> {
  await saveOps(dedupeOps([...(await loadOps()), op]));
}

export async function clearOps(): Promise<void> {
  opsMemo = [];
  idMapMemo = {};
  try {
    await AsyncStorage.multiRemove([OPS_KEY, IDMAP_KEY]);
  } catch {
    // nada
  }
}

export async function getIdMap(): Promise<Record<string, string>> {
  if (!idMapMemo) idMapMemo = await readJson<Record<string, string>>(IDMAP_KEY, {});
  return idMapMemo;
}

async function saveIdMap(map: Record<string, string>): Promise<void> {
  const entries = Object.entries(map);
  const trimmed = entries.length > MAX_IDMAP ? Object.fromEntries(entries.slice(-MAX_IDMAP)) : map;
  idMapMemo = trimmed;
  try {
    await AsyncStorage.setItem(IDMAP_KEY, JSON.stringify(trimmed));
  } catch {
    // nada
  }
}

export interface FlushResult {
  sent: number;
  failed: number;
  left: number;
}

// Envía la cola en orden. `send` debe lanzar un error con `status`:
//   0   → sin red (se corta y se reintenta luego)
//   401 → sesión (se corta)
//   otro → el servidor rechazó el cambio (se descarta para no bloquear la cola)
export async function flushOps(
  send: (op: PendingOp) => Promise<any>,
): Promise<FlushResult> {
  let rest = dedupeOps([...(await loadOps())]);
  if (!rest.length) return { sent: 0, failed: 0, left: 0 };

  const map = { ...(await getIdMap()) };
  let sent = 0;
  let failed = 0;

  for (const op of [...rest]) {
    const path = rewritePath(op.path, map);
    const body = op.body
      ? JSON.stringify(rewriteIds(JSON.parse(op.body), map))
      : undefined;
    try {
      const res = await send({ ...op, path, body });
      if (op.tempId && res && typeof res === 'object') {
        const real = createdId(res);
        if (real) map[op.tempId] = real;
      }
      sent++;
      rest = rest.filter((x) => x.id !== op.id);
      await saveOps(rest);
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : -1;
      if (status === 0 || status === 401) break;
      // Rechazado de forma definitiva: fuera de la cola (si no, bloquea todo).
      rest = rest.filter((x) => x.id !== op.id);
      failed++;
      await saveOps(rest);
    }
  }

  if (Object.keys(map).length) await saveIdMap(map);
  return { sent, failed, left: rest.length };
}

// Busca el id del objeto creado en respuestas { task: {...} } / { contact: {...} }.
function createdId(res: any): string | undefined {
  for (const v of Object.values(res)) {
    if (v && typeof v === 'object') {
      const id = (v as any).id;
      if (typeof id === 'string' && !isTempId(id)) return id;
    }
  }
  return undefined;
}
