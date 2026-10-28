// Subida de los datos del modo invitado a la cuenta recién creada.
//
// El servidor hace todo en una transacción y es idempotente por `batchId`: si la
// respuesta se pierde, reintentar no duplica. Solo cuando el servidor confirma se
// borra el SQLite del teléfono.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { api } from './api';
import { isGuest } from './sessionMode';
import { storage } from './storage';
import { hasGuestData } from './guestProfile';
import { buildGuestExport } from './local/exportData';
import { uuid } from '../utils/uuid';

const BATCH_KEY = '@planner/importBatchId';
const DECLINED_KEY = '@planner/importDeclined';

export interface ImportCounts {
  contacts: number;
  places: number;
  goals: number;
  tasks: number;
  events: number;
  incomes: number;
  expenses: number;
  goalLogs: number;
}

interface ImportResponse {
  ok: true;
  duplicate: boolean;
  imported: ImportCounts;
}

// El mismo lote se reutiliza si el primer intento falló a medias.
async function batchId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(BATCH_KEY);
    if (saved && /^[0-9a-f-]{36}$/.test(saved)) return saved;
  } catch {
    // sin persistencia: basta con que el id viva en esta sesión
  }
  const id = uuid();
  try {
    await AsyncStorage.setItem(BATCH_KEY, id);
  } catch {
    // nada
  }
  return id;
}

/** Cuántos registros del invitado quedan en el teléfono (0 si no hay SQLite). */
export async function guestRowCount(): Promise<number> {
  if (isGuest()) return 0;
  try {
    const { countLocalRows } = await import('./local/db');
    return await countLocalRows();
  } catch {
    return 0;
  }
}

/** Sube el lote y, si el servidor confirma, borra la copia local. */
export async function uploadGuestData(): Promise<ImportResponse> {
  const token = await storage.getToken();
  // Defensa: sin cuenta no hay a dónde subir (y sin token el server daría 401).
  if (!token) throw new Error('Entra con tu cuenta para subir los datos.');

  const payload = await buildGuestExport(await batchId());
  const r = await api<ImportResponse>(
    '/api/import',
    { method: 'POST', body: JSON.stringify(payload) },
    token,
  );

  // Confirmado por el servidor: el teléfono ya no necesita su copia. Si el
  // borrado fallara, como mucho se volvería a ofrecer la subida (idempotente).
  try {
    const { resetLocalData } = await import('./local/db');
    await resetLocalData();
  } catch {
    // sin SQLite (build vieja) no hay nada que borrar
  }
  // Las listas cacheadas son de antes de subir: se tiran para que las pantallas
  // pidan los datos ya importados.
  await storage.clearCache();
  try {
    await AsyncStorage.multiRemove([BATCH_KEY, DECLINED_KEY]);
  } catch {
    // nada
  }
  return r;
}

function summarize(counts: ImportCounts): string {
  const parts: string[] = [];
  const labels: [keyof ImportCounts, string][] = [
    ['tasks', 'tareas'],
    ['events', 'eventos'],
    ['incomes', 'ingresos'],
    ['expenses', 'gastos'],
    ['goals', 'metas'],
    ['contacts', 'contactos'],
    ['places', 'lugares'],
  ];
  for (const [key, label] of labels) {
    const n = counts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${label}`);
  }
  return parts.length ? parts.join(', ') : 'sin registros nuevos';
}

/** Sube y avisa con Alert. Devuelve true si quedó todo en la cuenta. */
export async function importGuestDataWithAlerts(): Promise<boolean> {
  try {
    const r = await uploadGuestData();
    Alert.alert(
      r.duplicate ? 'Ya estaban en tu cuenta' : 'Datos subidos',
      r.duplicate
        ? 'Estos datos ya se habían subido antes, así que no se duplicó nada.'
        : `Se guardaron en tu cuenta: ${summarize(r.imported)}. La copia del teléfono se borró.`,
    );
    return true;
  } catch (e) {
    Alert.alert(
      'No se pudo subir',
      `${e instanceof Error ? e.message : 'Intenta de nuevo.'}\n\nTus datos siguen en el teléfono.`,
    );
    return false;
  }
}

// Se pregunta una sola vez por ejecución de la app (y nunca si el usuario pidió
// que no se le vuelva a preguntar).
let askedThisRun = false;

/** Tras entrar con cuenta: ofrece subir lo que se creó como invitado. */
export async function offerGuestImport(): Promise<void> {
  if (askedThisRun || isGuest()) return;
  try {
    if ((await AsyncStorage.getItem(DECLINED_KEY)) === '1') return;
  } catch {
    // sin AsyncStorage se pregunta igual
  }
  if (!(await hasGuestData())) return;
  askedThisRun = true;
  Alert.alert(
    'Tienes datos sin cuenta',
    'Creamos datos en modo invitado en este teléfono. ¿Quieres pasarlos a tu cuenta? Se borrarán del teléfono al terminar.',
    [
      { text: 'Ahora no', style: 'cancel' },
      {
        text: 'No preguntar más',
        onPress: () => {
          void AsyncStorage.setItem(DECLINED_KEY, '1');
        },
      },
      // Si se arrepiente, Perfil → "Datos en este teléfono" permite subirlos o borrarlos.
      { text: 'Subir ahora', onPress: () => void importGuestDataWithAlerts() },
    ],
    { cancelable: true },
  );
}
