// Extracción "inteligente" de horarios: la IA mira la foto (o el texto) y
// devuelve las clases ya estructuradas, en vez de reglas rígidas.
//
// Proveedor por defecto: Gemini (Google AI Studio) — multimodal, gratis y SIN
// tarjeta (https://aistudio.google.com/apikey). Si no hay key, el escáner sigue
// funcionando con el parser de reglas del móvil.
//
// Añadir otro proveedor (Groq, OpenAI…): implementar `AiProvider` y registrarlo
// en `index.ts`. La forma de los datos (`ScheduleClass`) no cambia.
export interface ScheduleClass {
  title: string;
  weekday: number; // 0=Dom … 6=Sáb (como Date.getDay)
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

export interface AiInput {
  image?: Buffer;
  mime?: string;
  text?: string;
}

export interface AiProvider {
  name: string;
  extractSchedule(input: AiInput): Promise<ScheduleClass[]>;
}

export class AiNotConfigured extends Error {}
export class AiFailed extends Error {}

// --- Normalización compartida por todos los proveedores ---

const DAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  dom: 0,
  lun: 1,
  mar: 2,
  mie: 3,
  jue: 4,
  vie: 5,
  sab: 6,
};

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] ?? c)
    .replace(/[.,;:]/g, '');
}

// "8:00", "08:00", "2:00 pm", "14:00 h" → "HH:MM" (24h). null si no se entiende.
export function toHM(s: string): string | null {
  const m = String(s ?? '')
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const ap = (m[3] ?? '').replace(/[.\s]/g, '');
  if (ap.startsWith('p') && h < 12) h += 12;
  if (ap.startsWith('a') && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const RECESS = /^(recreo|receso|descanso|almuerzo|refrigerio|break|lunch|libre|hora libre)$/i;

// Convierte la respuesta cruda de la IA en clases válidas y sin duplicados.
export function normalizeClasses(raw: unknown): ScheduleClass[] {
  if (!Array.isArray(raw)) throw new AiFailed('La IA no devolvió una lista.');
  const out: ScheduleClass[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = String(o.subject ?? o.title ?? '').trim();
    if (!title || title.length < 2 || RECESS.test(title)) continue;
    const weekday = DAYS[norm(String(o.day ?? o.weekday ?? ''))];
    if (weekday === undefined) continue;
    const start = toHM(String(o.start ?? ''));
    const end = toHM(String(o.end ?? ''));
    if (!start || !end || end <= start) continue;
    const key = `${weekday}|${start}|${end}|${norm(title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 80), weekday, start, end });
  }
  return out;
}
