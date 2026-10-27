import { api, API_BASE } from './api';
import { isGuest } from './sessionMode';
import { createEvent } from './events';
import { defaultSemesterEnd, nextWeekdayISO, type ScheduleCandidate } from './scheduleParser';
import { storage } from './storage';

const BASE = API_BASE;

export interface ScanResult {
  text: string;
  candidates?: ScheduleCandidate[]; // clases ya estructuradas por la IA
  ai?: boolean; // true = respondió la IA
  aiError?: string; // motivo si la IA falló
}

export interface AiStatus {
  enabled: boolean;
  provider: string | null;
  error?: string;
}

// ¿Está activa la IA del escáner? (para el indicador de la pantalla)
export async function aiStatus(): Promise<AiStatus> {
  return api<AiStatus>('/api/scanner/ai', {}, await storage.getToken());
}

// Pestaña "Texto": la IA estructura el texto pegado (si está activa).
export async function parseScheduleWithAi(
  text: string,
): Promise<{ candidates: ScheduleCandidate[]; ai: boolean; aiError?: string }> {
  return api(
    '/api/scanner/parse',
    { method: 'POST', body: JSON.stringify({ text }) },
    await storage.getToken(),
  );
}

// Sube la foto al backend, que la manda al OCR.
// Usa uploadAsync (multipart nativo) en vez de fetch+FormData: más confiable
// en Expo Go para archivos file:// (el fetch fallaba con "sin conexión").
export async function uploadScan(photoUri: string): Promise<ScanResult> {
  if (isGuest()) {
    throw new Error(
      'El escáner con foto necesita una cuenta. Mientras tanto puedes escribir el horario a mano.',
    );
  }
  const token = await storage.getToken();
  let res: { status: number; body: string };
  try {
    const { uploadAsync, FileSystemUploadType } = await import('expo-file-system/legacy');
    res = await uploadAsync(`${BASE}/api/scanner/ocr`, photoUri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'photo',
      mimeType: 'image/jpeg',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (e) {
    throw new Error(
      `Sin conexión con el servidor. Revisa el Wi-Fi y que la API esté corriendo.${e instanceof Error && e.message ? ` (${e.message})` : ''}`,
    );
  }
  if (res.status < 200 || res.status >= 300) {
    let msg = `Error ${res.status}. Intenta de nuevo.`;
    try {
      msg = (JSON.parse(res.body) as { error?: string }).error ?? msg;
    } catch {
      // cuerpo no JSON
    }
    throw new Error(msg);
  }
  return JSON.parse(res.body) as ScanResult;
}

// Crea un evento semanal por candidato. La foto del horario no se guarda:
// solo se usa en memoria para leerla.
export async function createScannedEvents(
  cands: ScheduleCandidate[],
  repeatUntil?: string | null,
): Promise<number> {
  const until = repeatUntil === undefined ? defaultSemesterEnd() : repeatUntil;
  let n = 0;
  for (const c of cands) {
    await createEvent({
      title: c.title,
      type: 'Estudio',
      isBackup: false,
      date: nextWeekdayISO(c.weekday),
      startTime: c.start,
      endTime: c.end,
      description: 'Escaneado de horario',
      notifyMins: 30,
      repeat: 'weekly',
      repeatUntil: until,
      contactIds: [],
    });
    n += 1;
  }
  return n;
}
