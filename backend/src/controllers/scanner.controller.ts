import type { Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth';
import { aiStatus, getAiProvider, type AiInput, type ScheduleClass } from '../services/ai';
import { getOcrProvider } from '../services/ocr';
import { OcrFailed, OcrNotConfigured } from '../services/ocr/ocrProvider';

export const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo imágenes (JPG/PNG).'));
  },
});

// Extrae clases con la IA (si está configurada). Nunca lanza: si falla, el móvil
// cae al parser de reglas y el usuario ve el motivo.
async function analyze(input: AiInput): Promise<{
  candidates: ScheduleClass[];
  ai: boolean;
  aiError?: string;
}> {
  let provider;
  try {
    provider = getAiProvider();
  } catch (e) {
    return { candidates: [], ai: false, aiError: e instanceof Error ? e.message : undefined };
  }
  if (!provider) return { candidates: [], ai: false };
  try {
    return { candidates: await provider.extractSchedule(input), ai: true };
  } catch (e) {
    return { candidates: [], ai: true, aiError: e instanceof Error ? e.message : 'La IA no pudo leer el horario.' };
  }
}

// POST /api/scanner/ocr (multipart, campo "photo") → { text, candidates, ai }
export async function ocrScan(req: AuthedRequest, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'Sube una foto del horario (campo photo).' });

  let provider;
  try {
    provider = getOcrProvider();
  } catch (e) {
    if (e instanceof OcrNotConfigured) return res.status(503).json({ error: e.message });
    throw e;
  }

  // OCR y IA a la vez: la espera total es la del más lento (la IA), no la suma.
  // El texto del OCR sirve para "Ver texto detectado" y de respaldo si la IA falla.
  const [ocr, a] = await Promise.all([
    provider
      .recognize(req.file.buffer, req.file.mimetype)
      .then((text) => ({ ok: true as const, text }))
      .catch((error: unknown) => ({ ok: false as const, error })),
    analyze({ image: req.file.buffer, mime: req.file.mimetype }),
  ]);

  if (ocr.ok) return res.json({ text: ocr.text, ...a });
  // Sin OCR: si la IA sí leyó el horario, no molestamos al usuario con el error.
  if (a.candidates.length > 0) return res.json({ text: '', ...a });
  if (ocr.error instanceof OcrFailed) return res.status(422).json({ error: ocr.error.message });
  throw ocr.error;
}

const textSchema = z.object({ text: z.string().min(3).max(20000) });

// POST /api/scanner/parse { text } → { candidates, ai } (pestaña "Texto").
export async function parseScan(req: AuthedRequest, res: Response) {
  const { text } = textSchema.parse(req.body);
  res.json(await analyze({ text }));
}

// GET /api/scanner/ai → { enabled, provider } para el indicador del móvil.
export async function scannerAiStatus(_req: AuthedRequest, res: Response) {
  res.json(aiStatus());
}
