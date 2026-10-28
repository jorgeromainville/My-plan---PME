import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { Icon } from '../src/components/Icon';
import { errorMessage } from '../src/services/api';
import { backupText, buildGuestBackup } from '../src/services/backup/exportGuest';
import {
  backupCounts,
  backupFileName,
  describeBackup,
  parseBackup,
  type BackupCounts,
  type BackupFile,
  type BackupProfile,
} from '../src/services/backup/format';
import { pickBackupText, saveBackupFile, shareBackupText } from '../src/services/backup/files';
import { getLastBackup, lastBackupLabel, markBackup } from '../src/services/backup/lastBackup';
import { restoreGuest, type RestoreMode } from '../src/services/backup/restoreGuest';
import { getGuestUser } from '../src/services/guestProfile';
import { countLocalRows } from '../src/services/local/db';
import { useCatalog } from '../src/store/useCatalog';
import { useSession } from '../src/store/useSession';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { formatLongEs } from '../src/utils/dates';

// Copia de seguridad del invitado: exporta todo a un JSON y lo restaura con
// vista previa. En cuentas los datos ya viven en el servidor, así que aquí solo
// se explica (la exportación desde la nube llega más adelante).
type Busy = '' | 'export' | 'share' | 'pick' | 'restore';

function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.1.0';
}

export default function Backup() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const guest = useSession((st) => st.mode === 'guest');
  const [busy, setBusy] = useState<Busy>('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState<string | null>(null);
  const [rows, setRows] = useState(0);
  const [preview, setPreview] = useState<BackupFile | null>(null);
  const [previewCounts, setPreviewCounts] = useState<BackupCounts | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  useFocusEffect(
    useCallback(() => {
      void getLastBackup().then(setLast);
      void countLocalRows()
        .then(setRows)
        .catch(() => setRows(0));
    }, []),
  );

  async function guestProfile(): Promise<BackupProfile | undefined> {
    if (!guest) return undefined;
    const u = await getGuestUser();
    return {
      name: u.name,
      currency: u.currency,
      currencySymbol: u.currencySymbol,
      theme: u.theme,
      weekStartsOn: u.weekStartsOn,
    };
  }

  async function onExport() {
    setError('');
    setMsg('');
    setBusy('export');
    try {
      const file = await buildGuestBackup(appVersion(), await guestProfile());
      const outcome = await saveBackupFile(backupFileName(), backupText(file));
      if (!outcome.saved) {
        if (outcome.reason === 'unsupported') {
          setError(
            'Esta versión de la app no puede elegir carpetas. Usa «Compartir como texto» o actualiza la app.',
          );
        }
        return;
      }
      const savedAt = await markBackup();
      setLast(savedAt);
      Alert.alert(
        'Copia guardada',
        `Incluye ${describeBackup(backupCounts(file.data))}. Guárdala en un lugar seguro: contiene datos personales.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function onShare() {
    setError('');
    setMsg('');
    setBusy('share');
    try {
      const file = await buildGuestBackup(appVersion(), await guestProfile());
      const shared = await shareBackupText(backupFileName(), backupText(file));
      if (shared) {
        const savedAt = await markBackup();
        setLast(savedAt);
        setMsg('Copia compartida.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  function review(text: string) {
    setError('');
    setMsg('');
    try {
      const file = parseBackup(text);
      setPreview(file);
      setPreviewCounts(backupCounts(file.data));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onPick() {
    setError('');
    setMsg('');
    setBusy('pick');
    try {
      const text = await pickBackupText();
      if (text != null) review(text);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  async function runRestore(mode: RestoreMode) {
    if (!preview) return;
    setError('');
    setMsg('');
    setBusy('restore');
    try {
      const result = await restoreGuest(preview, mode);
      setPreview(null);
      setPreviewCounts(null);
      setPasted('');
      setPasteOpen(false);
      setRows(await countLocalRows().catch(() => 0));
      // Tipos de evento y plantillas viven en `settings`: se releen del SQLite.
      void useCatalog.getState().load();
      setMsg(
        mode === 'replace'
          ? `Copia restaurada: ${result.inserted.total} registro(s). Los datos anteriores se reemplazaron.`
          : `Copia fusionada: se agregaron ${result.inserted.total} registro(s) sin borrar nada.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  }

  function confirmReplace() {
    if (!preview || !previewCounts) return;
    Alert.alert(
      'Reemplazar todo',
      `Se borrarán los ${rows} registro(s) de este teléfono y se dejarán los ${previewCounts.total} de la copia. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', style: 'destructive', onPress: () => void runRestore('replace') },
      ],
    );
  }

  const disabled = busy !== '';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Icon name="chevronLeft" size={24} color={colors.text} />
          </Pressable>
          <Text style={s.title}>Copia de seguridad</Text>
          <View style={{ width: 40 }} />
        </View>

        {guest ? (
          <>
            <Card>
              <View style={s.headRow}>
                <Icon name="shield" size={20} color={colors.green} />
                <Text style={s.h}>Exportar</Text>
              </View>
              <Text style={s.hint}>
                Guarda todo en un archivo para no perderlo si cambias de teléfono o reinstalas la
                app. El archivo sirve también para pasarlo a una cuenta más adelante.
              </Text>
              <Text style={s.hint}>{lastBackupLabel(last)}</Text>
              <Pressable
                style={[s.btn, disabled && s.disabled]}
                onPress={onExport}
                disabled={disabled}
              >
                <Text style={s.btnTxt}>
                  {busy === 'export' ? 'Guardando…' : 'Guardar copia en el teléfono'}
                </Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={onShare} disabled={disabled}>
                <Text style={s.ghostTxt}>
                  {busy === 'share' ? 'Abriendo…' : 'Compartir como texto'}
                </Text>
              </Pressable>
            </Card>

            <Card>
              <View style={s.headRow}>
                <Icon name="rotate" size={20} color={colors.blue} />
                <Text style={s.h}>Restaurar</Text>
              </View>
              <Text style={s.hint}>
                Elige un archivo .json de My Plan. Antes de tocar nada verás cuántos registros
                trae y podrás elegir entre fusionar o reemplazar.
              </Text>
              <Pressable
                style={[s.btn, disabled && s.disabled]}
                onPress={onPick}
                disabled={disabled}
              >
                <Text style={s.btnTxt}>{busy === 'pick' ? 'Abriendo…' : 'Elegir archivo'}</Text>
              </Pressable>
              <Pressable
                style={s.ghost}
                onPress={() => setPasteOpen((v) => !v)}
                disabled={disabled}
              >
                <Text style={s.ghostTxt}>
                  {pasteOpen ? 'Ocultar el texto' : 'Pegar la copia como texto'}
                </Text>
              </Pressable>
              {pasteOpen ? (
                <>
                  <TextInput
                    placeholderTextColor={colors.muted}
                    style={s.area}
                    value={pasted}
                    onChangeText={setPasted}
                    placeholder='{"schema":"myplan.backup/1", …}'
                    multiline
                    numberOfLines={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable
                    style={[s.btn, (!pasted.trim() || disabled) && s.disabled]}
                    onPress={() => review(pasted)}
                    disabled={!pasted.trim() || disabled}
                  >
                    <Text style={s.btnTxt}>Revisar copia</Text>
                  </Pressable>
                </>
              ) : null}
            </Card>

            {preview && previewCounts ? (
              <Card>
                <View style={s.headRow}>
                  <Icon name="fileText" size={20} color={colors.green} />
                  <Text style={s.h}>Copia lista</Text>
                </View>
                <Text style={s.hint}>
                  {preview.mode === 'account' ? 'Creada en una cuenta' : 'Creada en modo invitado'} ·{' '}
                  {formatLongEs(new Date(preview.exportedAt))}
                </Text>
                <Text style={s.hint}>Incluye {describeBackup(previewCounts)}.</Text>
                <Text style={s.hint}>
                  Ahora tienes {rows} registro(s) en este teléfono. Fusionar agrega todo sin borrar
                  nada; reemplazar deja solo lo de la copia.
                </Text>
                <Pressable
                  style={[s.btn, disabled && s.disabled]}
                  onPress={() => void runRestore('merge')}
                  disabled={disabled}
                >
                  <Text style={s.btnTxt}>
                    {busy === 'restore' ? 'Restaurando…' : 'Fusionar (agregar)'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.dangerOutline, disabled && s.disabled]}
                  onPress={confirmReplace}
                  disabled={disabled}
                >
                  <Text style={s.dangerTxt}>Reemplazar todo</Text>
                </Pressable>
                <Pressable
                  style={s.ghost}
                  onPress={() => {
                    setPreview(null);
                    setPreviewCounts(null);
                  }}
                  disabled={disabled}
                >
                  <Text style={s.ghostTxt}>Cancelar</Text>
                </Pressable>
              </Card>
            ) : null}

            <Card>
              <Text style={s.h}>Qué incluye</Text>
              <Text style={s.hint}>
                Contactos, lugares, tareas, eventos con sus invitados, ingresos, gastos, metas con
                sus avances, categorías y los ajustes de la agenda.
              </Text>
              <Text style={s.hint}>
                Tu nombre, tu moneda y el tema no cambian al restaurar. El archivo contiene datos
                personales: guárdalo en un lugar seguro.
              </Text>
            </Card>
          </>
        ) : (
          <Card>
            <View style={s.headRow}>
              <Icon name="shield" size={20} color={colors.green} />
              <Text style={s.h}>Tu cuenta ya está respaldada</Text>
            </View>
            <Text style={s.hint}>
              Con una cuenta, los datos se guardan en el servidor y vuelven al entrar desde otro
              teléfono. La exportación a un archivo desde la cuenta llegará en una próxima
              actualización.
            </Text>
          </Card>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
        {msg ? <Text style={s.ok}>{msg}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    body: { padding: 16, gap: 12, paddingBottom: 40 },
    top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    x: { width: 40, paddingVertical: 6 },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    h: { fontSize: 17, fontWeight: '800', color: colors.text },
    hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 8 },
    btn: { backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 4 },
    btnTxt: { color: colors.onPrimary, fontWeight: '800' },
    ghost: { padding: 12, alignItems: 'center' },
    ghostTxt: { color: colors.link, fontWeight: '700' },
    dangerOutline: { borderWidth: 1, borderColor: colors.danger, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
    dangerTxt: { color: colors.danger, fontWeight: '800' },
    disabled: { opacity: 0.5 },
    area: {
      backgroundColor: colors.bgSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 12,
      minHeight: 110,
      color: colors.text,
      textAlignVertical: 'top',
      marginBottom: 10,
    },
    error: { color: colors.danger, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
    ok: { color: colors.green, fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 },
  });
}
