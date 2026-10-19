import { OcrNotConfigured, type OcrProvider } from './ocrProvider';
import { OcrSpaceProvider } from './ocrspace.provider';

export function getOcrProvider(): OcrProvider {
  // 'mlkit' no se implementa aquí: el OCR correría en el teléfono (ver ocrProvider.ts).
  if ((process.env.OCR_PROVIDER ?? 'ocrspace') === 'mlkit') {
    throw new OcrNotConfigured('ML Kit requiere dev build. Ver backend/src/services/ocr/ocrProvider.ts.');
  }
  const key = (process.env.OCRSPACE_KEY ?? '').trim();
  if (!key) {
    throw new OcrNotConfigured(
      'Falta OCRSPACE_KEY en backend/.env (gratis y sin tarjeta en https://ocr.space/ocrapi).',
    );
  }
  return new OcrSpaceProvider(key);
}
