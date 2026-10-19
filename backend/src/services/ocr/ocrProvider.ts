// Abstracción OCR: hoy OCR.space (nube, key gratis), mañana ML Kit (offline).
//
// OPCIÓN B (ML Kit, gratis para siempre) — pasos cuando haya dev build:
// 1) `npx expo run:android` (requiere Android Studio) para salir de Expo Go.
// 2) `npm i @react-native-ml-kit/text-recognition` en mobile.
// 3) OCR en el teléfono (sin subir la foto): implementar `mlkit.provider.ts`
//    con el MISMO método `recognize()` y cambiar `OCR_PROVIDER=mlkit`.
//    Este endpoint ni siquiera se usaría (el texto ya llegaría extraído).
export interface OcrProvider {
  name: string;
  recognize(image: Buffer, mime: string): Promise<string>;
}

export class OcrNotConfigured extends Error {}
export class OcrFailed extends Error {}
