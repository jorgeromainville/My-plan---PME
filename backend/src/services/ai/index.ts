import { AiNotConfigured, type AiProvider } from './aiProvider';
import { GeminiProvider } from './gemini.provider';

// Devuelve null si la IA está apagada (el escáner usa el parser de reglas).
export function getAiProvider(): AiProvider | null {
  const provider = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (!provider || provider === 'none' || provider === 'off' || provider === 'false') return null;

  if (provider === 'gemini') {
    const key = (process.env.GEMINI_API_KEY ?? '').trim();
    if (!key) {
      throw new AiNotConfigured(
        'Falta GEMINI_API_KEY en backend/.env (gratis y sin tarjeta: https://aistudio.google.com/apikey).',
      );
    }
    return new GeminiProvider(
      key,
      (process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest').trim(),
      (process.env.GEMINI_MODEL_FALLBACKS ?? 'gemini-3-flash-preview,gemini-flash-latest').trim(),
    );
  }

  throw new AiNotConfigured(`AI_PROVIDER="${provider}" no soportado (usa gemini o none).`);
}

// ¿Está activa la IA? No lanza: sirve para el indicador del móvil.
export function aiStatus(): { enabled: boolean; provider: string | null; error?: string } {
  try {
    const p = getAiProvider();
    return { enabled: !!p, provider: p?.name ?? null };
  } catch (e) {
    return { enabled: false, provider: null, error: e instanceof Error ? e.message : 'IA mal configurada.' };
  }
}

export { AiFailed, AiNotConfigured } from './aiProvider';
export type { AiInput, AiProvider, ScheduleClass } from './aiProvider';
