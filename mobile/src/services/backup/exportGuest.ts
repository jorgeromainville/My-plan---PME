// Copia de seguridad del modo invitado: arma el archivo JSON a partir de SQLite.
//
// No toca archivos ni AsyncStorage (para poder probarlo en Node): el llamador
// pasa la versión de la app y el perfil, y se encarga de guardar o compartir el
// texto resultante.
import { uuid } from '../../utils/uuid';
import { buildGuestExport } from '../local/exportData';
import { BACKUP_SCHEMA, type BackupFile, type BackupProfile } from './format';

/** Lote completo listo para guardar. Los datos salen de `buildGuestExport`. */
export async function buildGuestBackup(
  appVersion: string,
  profile?: BackupProfile,
): Promise<BackupFile> {
  const batchId = uuid();
  const { batchId: _ignored, ...data } = await buildGuestExport(batchId);
  void _ignored;
  const backup: BackupFile = {
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    app: appVersion.slice(0, 20) || '0.1.0',
    mode: 'guest',
    batchId,
    data,
  };
  if (profile) backup.profile = profile;
  return backup;
}

/** Texto legible (indentado) del archivo. */
export function backupText(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}
