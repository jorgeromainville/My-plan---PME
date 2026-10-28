// Guardar y abrir el archivo de copia usando solo `expo-file-system`.
//
// SDK 57 trae selectores de carpeta y de archivo en el módulo (sin
// `expo-document-picker` ni `expo-sharing`): se usan si la build los tiene y, si
// no, la pantalla ofrece pegar el JSON en un campo de texto.
import { Directory, File, type PickSingleFileResult } from 'expo-file-system';
import { Share } from 'react-native';
import { ApiError } from '../errors';

export type SaveOutcome =
  | { saved: true; uri: string }
  | { saved: false; reason: 'canceled' | 'unsupported' };

function supportsPickers(): boolean {
  return (
    typeof (File as unknown as { pickFileAsync?: unknown }).pickFileAsync === 'function' &&
    typeof (Directory as unknown as { pickDirectoryAsync?: unknown }).pickDirectoryAsync ===
      'function'
  );
}

function isCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel/i.test(message);
}

function detail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}

/** Nombre libre dentro de la carpeta (no pisa una copia del mismo día). */
function availableName(dir: Directory, fileName: string): string {
  const names = new Set<string>();
  try {
    for (const entry of dir.list()) names.add(entry.name);
  } catch {
    // si no se puede listar, se intenta el nombre base igual
  }
  if (!names.has(fileName)) return fileName;
  const stem = fileName.replace(/\.json$/i, '');
  for (let i = 2; i < 50; i += 1) {
    const candidate = `${stem}-${i}.json`;
    if (!names.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}.json`;
}

/**
 * Pide una carpeta y escribe la copia ahí (Drive, Descargas, etc.).
 * `unsupported` significa que la build no trae el selector: usar el texto pegado.
 */
export async function saveBackupFile(fileName: string, text: string): Promise<SaveOutcome> {
  if (!supportsPickers()) return { saved: false, reason: 'unsupported' };
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (isCancel(error)) return { saved: false, reason: 'canceled' };
    throw new ApiError(500, `No se pudo abrir la carpeta: ${detail(error)}`);
  }
  try {
    const file = dir.createFile(availableName(dir, fileName), 'application/json');
    file.write(text);
    return { saved: true, uri: file.uri };
  } catch (error) {
    throw new ApiError(500, `No se pudo escribir el archivo: ${detail(error)}`);
  }
}

/** Abre el selector del sistema y devuelve el texto del archivo (null si cancela). */
export async function pickBackupText(): Promise<string | null> {
  if (typeof (File as unknown as { pickFileAsync?: unknown }).pickFileAsync !== 'function') {
    throw new ApiError(
      503,
      'Esta versión de la app no puede abrir archivos. Actualízala o pega la copia en el campo de texto.',
    );
  }
  let picked: PickSingleFileResult;
  try {
    picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'] });
  } catch (error) {
    if (isCancel(error)) return null;
    throw new ApiError(500, `No se pudo abrir el archivo: ${detail(error)}`);
  }
  if (picked.canceled || !picked.result) return null;
  try {
    return await picked.result.text();
  } catch (error) {
    throw new ApiError(500, `No se pudo leer el archivo: ${detail(error)}`);
  }
}

/** Plan B: compartir el JSON como texto (solo copias pequeñas). Devuelve si se compartió. */
export async function shareBackupText(name: string, text: string): Promise<boolean> {
  if (text.length > 200_000) {
    throw new ApiError(
      400,
      'La copia es demasiado grande para compartirla como texto. Guárdala como archivo.',
    );
  }
  const result = await Share.share({ title: name, message: text });
  return result.action === Share.sharedAction;
}
