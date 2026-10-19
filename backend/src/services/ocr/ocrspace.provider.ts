import { OcrFailed, type OcrProvider } from './ocrProvider';

// OCR.space: gratis (25k imágenes/mes), key sin tarjeta en https://ocr.space/ocrapi.
// Lenguaje español + motor 2 (mejor con fotos) + escalado automático.
export class OcrSpaceProvider implements OcrProvider {
  name = 'ocrspace';
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  async recognize(image: Buffer, mime: string): Promise<string> {
    const form = new FormData();
    form.append('apikey', this.key);
    form.append('language', 'spa');
    form.append('OCREngine', '2');
    form.append('scale', 'true');
    // Sin isTable: solo queremos el texto y es más rápido en el plan gratis.
    form.append('file', new Blob([new Uint8Array(image)], { type: mime }), 'scan.jpg');

    const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
    if (!res.ok) throw new OcrFailed(`OCR.space respondió ${res.status}`);
    const j = (await res.json()) as {
      OCRExitCode?: number;
      ErrorMessage?: string[];
      ParsedResults?: { ParsedText?: string }[];
    };
    if (j.OCRExitCode !== 1 && j.OCRExitCode !== 2) {
      throw new OcrFailed((j.ErrorMessage ?? ['OCR sin resultado']).join(' '));
    }
    const text = (j.ParsedResults ?? []).map((r) => r.ParsedText ?? '').join('\n').trim();
    if (!text) throw new OcrFailed('No se detectó texto. Prueba con mejor luz y la hoja derecha.');
    return text;
  }
}
