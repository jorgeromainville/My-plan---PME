import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { API_BASE, errorMessage, flushPending } from '../src/services/api';
import { changePassword, deleteAccount, updateMe } from '../src/services/auth';
import { clearOps, loadOps } from '../src/services/sync';
import { storage } from '../src/services/storage';
import { cancelReminders, remindersGranted, remindersNativeMissing, rescheduleReminders, sendTestReminder } from '../src/services/reminders';
import { useAppStore } from '../src/store/useAppStore';
import { usePrefs } from '../src/store/usePrefs';
import { useSession } from '../src/store/useSession';
import type { ThemeMode, WeekStart } from '../src/store/usePrefs';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';

// Monedas rápidas; cualquier otra se escribe con código + símbolo.
const PRESETS = [
  { code: 'PEN', symbol: 'S/' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
];

const THEMES: { v: ThemeMode; label: string }[] = [
  { v: 'light', label: 'Claro' },
  { v: 'dark', label: 'Oscuro' },
  { v: 'andean', label: 'Típico' },
  { v: 'auto', label: 'Automático' },
];

export default function Perfil() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { userName, setUserName } = useAppStore();
  const signOut = useSession((s) => s.signOut);
  const sessionName = useSession((s) => s.userName);
  const user = useSession((s) => s.user);
  const updateSessionUser = useSession((s) => s.updateUser);
  const prefs = usePrefs();
  const [name, setName] = useState(user?.name ?? sessionName ?? userName);
  const [currency, setCurrency] = useState(user?.currency ?? 'PEN');
  const [symbol, setSymbol] = useState(user?.currencySymbol ?? 'S/');
  const [customOpen, setCustomOpen] = useState(
    () => !!user && !PRESETS.some((p) => p.code === user.currency),
  );
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [remMsg, setRemMsg] = useState('');
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [delMsg, setDelMsg] = useState('');
  const [delBusy, setDelBusy] = useState(false);

  // Si la sesión carga después de abrir Perfil, refleja los datos del servidor.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setCurrency(user.currency);
    setSymbol(user.currencySymbol);
    setCustomOpen(!PRESETS.some((p) => p.code === user.currency));
  }, [user?.id, user?.name, user?.currency, user?.currencySymbol]);

  useFocusEffect(
    useCallback(() => {
      loadOps().then((o) => setPending(o.length));
    }, []),
  );

  async function onSave() {
    setSaveMsg('');
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(code)) {
      setSaveMsg('Código de moneda: 2 a 6 letras o números (ej. COP).');
      return;
    }
    const sym = symbol.trim();
    if (!sym || sym.length > 6) {
      setSaveMsg('Símbolo: entre 1 y 6 caracteres (ej. $, S/, €).');
      return;
    }
    setSaving(true);
    try {
      const r = await updateMe({
        name: name.trim() || 'Usuario',
        currency: code,
        currencySymbol: sym,
        weekStartsOn: prefs.weekStartsOn,
      });
      await updateSessionUser(r.user);
      await storage.clearCache();
      setUserName(r.user.name);
      setCurrency(code);
      setSymbol(sym);
      setSaveMsg('Guardado.');
    } catch (e) {
      setSaveMsg(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // La semana cambia al momento (afecta resúmenes del servidor).
  async function pickWeek(w: WeekStart) {
    await prefs.set({ weekStartsOn: w });
    setSaveMsg('Inicio de semana guardado.');
    try {
      const r = await updateMe({ weekStartsOn: w });
      await updateSessionUser(r.user);
      await storage.clearCache();
    } catch (e) {
      setSaveMsg(errorMessage(e));
    }
  }

  async function pickTheme(t: ThemeMode) {
    await prefs.set({ theme: t });
    setSaveMsg('Tema guardado.');
    try {
      const r = await updateMe({ theme: t });
      await updateSessionUser(r.user);
    } catch (e) {
      setSaveMsg(errorMessage(e));
    }
  }

  async function onChangePassword() {
    setPassMsg('');
    if (newPass.length < 8) {
      setPassMsg('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setPassBusy(true);
    try {
      await changePassword(curPass, newPass);
      setCurPass('');
      setNewPass('');
      setPassMsg('Contraseña actualizada.');
    } catch (e) {
      setPassMsg(errorMessage(e));
    } finally {
      setPassBusy(false);
    }
  }

  function onDeleteAccount() {
    setDelMsg('');
    if (confirmText.trim() !== 'ELIMINAR') {
      setDelMsg('Escribe ELIMINAR (en mayúsculas) para confirmar.');
      return;
    }
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borrarán tu cuenta y todos tus datos: ingresos, gastos, tareas, eventos, metas, lugares y contactos. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDelBusy(true);
            try {
              await deleteAccount();
              await signOut();
              router.replace('/(auth)/login');
            } catch (e) {
              setDelMsg(errorMessage(e));
              setDelBusy(false);
            }
          },
        },
      ],
    );
  }

  async function toggleReminders(v: boolean) {
    await prefs.set({ reminders: v });
    if (v) {
      const ok = await remindersGranted();
      if (!ok) {
        setRemMsg('Permiso denegado: actívalo en ajustes del teléfono.');
        return;
      }
      const n = await rescheduleReminders(true);
      setRemMsg(n > 0 ? `${n} avisos programados.` : 'Sin avisos próximos.');
    } else {
      await cancelReminders();
      setRemMsg('Avisos apagados.');
    }
  }

  function confirmClearDemo() {
    Alert.alert(
      'Eliminar datos de prueba',
      'Se ocultan las metas y personas de ejemplo. Lo que tú hayas creado no se borra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => prefs.set({ demoCleared: true }) },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.title}>Perfil</Text>
        <Text style={s.sub}>Configura tu cuenta y preferencias</Text>
        <Card>
          <Text style={s.label}>Nombre</Text>
          <TextInput value={name} onChangeText={setName} style={s.input} placeholder="Tu nombre" />
          <Text style={s.label}>Moneda de la cuenta</Text>
          <View style={s.row}>
            {PRESETS.map((m) => (
              <Pressable
                key={m.code}
                onPress={() => {
                  setCurrency(m.code);
                  setSymbol(m.symbol);
                  setCustomOpen(false);
                }}
                style={[s.chip, currency === m.code && !customOpen && s.chipOn]}
              >
                <Text style={currency === m.code && !customOpen ? s.chipTxtOn : s.chipTxt}>
                  {m.code} {m.symbol}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setCustomOpen((v) => !v)} style={[s.chip, customOpen && s.chipOn]}>
              <Text style={customOpen ? s.chipTxtOn : s.chipTxt}>Otra…</Text>
            </Pressable>
          </View>
          {customOpen ? (
            <View style={s.curRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Código</Text>
                <TextInput
                  value={currency}
                  onChangeText={(v) => setCurrency(v.toUpperCase())}
                  style={s.input}
                  placeholder="COP"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Símbolo</Text>
                <TextInput value={symbol} onChangeText={setSymbol} style={s.input} placeholder="$" maxLength={6} />
              </View>
            </View>
          ) : null}
          <Text style={s.remSub}>
            Cambiar de moneda no convierte los importes guardados: solo cambia cómo se muestran.
          </Text>
          <Text style={s.label}>Inicio de semana</Text>
          <View style={s.row}>
            {(['monday', 'sunday'] as const).map((w) => (
              <Pressable
                key={w}
                onPress={() => pickWeek(w)}
                style={[s.chip, prefs.weekStartsOn === w && s.chipOn]}
              >
                <Text style={prefs.weekStartsOn === w ? s.chipTxtOn : s.chipTxt}>
                  {w === 'monday' ? 'Lunes' : 'Domingo'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Tema</Text>
          <View style={s.row}>
            {THEMES.map((t) => (
              <Pressable
                key={t.v}
                onPress={() => pickTheme(t.v)}
                style={[s.chip, prefs.theme === t.v && s.chipOn]}
              >
                <Text style={prefs.theme === t.v ? s.chipTxtOn : s.chipTxt}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.remSub}>
            Típico: terracota, ocre y turquesa inspirados en los textiles andinos.
          </Text>
          <Pressable style={[s.btn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
            <Text style={s.btnTxt}>{saving ? 'Guardando…' : 'Guardar'}</Text>
          </Pressable>
          {saveMsg ? <Text style={s.remSub}>{saveMsg}</Text> : null}
          <Text style={s.remSub}>Servidor: {API_BASE}</Text>
        </Card>
        <Card>
          <View style={s.remRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.remTitle}>Recordatorios</Text>
              <Text style={s.remSub}>Eventos, tareas, seguimientos y metas</Text>
              {remindersNativeMissing() ? (
                <Text style={s.remSub}>No disponible en este Expo Go (actualízalo en Play Store).</Text>
              ) : null}
              {remMsg ? <Text style={s.remSub}>{remMsg}</Text> : null}
            </View>
            <Switch value={prefs.reminders} onValueChange={toggleReminders} />
          </View>
          {prefs.reminders ? (
            <Pressable
              style={s.ghost}
              onPress={async () => {
                const ok = await sendTestReminder();
                setRemMsg(ok ? 'Prueba enviada: llega en 5 segundos.' : 'Permiso denegado.');
              }}
            >
              <Text style={s.ghostTxt}>Enviar aviso de prueba</Text>
            </Pressable>
          ) : null}
          <Pressable style={s.btn} onPress={() => router.push('/ajustes')}>
            <Text style={s.btnTxt}>Tipos y plantillas</Text>
          </Pressable>
        </Card>
        <Card>
          <Text style={s.title2}>Agenda</Text>
          <Text style={s.label}>País de feriados</Text>
          <View style={s.row}>
            <Pressable onPress={() => prefs.set({ holidayCountry: '' })} style={[s.chip, !prefs.holidayCountry && s.chipOn]}>
              <Text style={!prefs.holidayCountry ? s.chipTxtOn : s.chipTxt}>Auto</Text>
            </Pressable>
            {['PE', 'US', 'MX', 'CO', 'AR', 'CL', 'ES'].map((c) => (
              <Pressable key={c} onPress={() => prefs.set({ holidayCountry: c })} style={[s.chip, prefs.holidayCountry === c && s.chipOn]}>
                <Text style={prefs.holidayCountry === c ? s.chipTxtOn : s.chipTxt}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>Formato de hora</Text>
          <View style={s.row}>
            {(['24h', '12h'] as const).map((f) => (
              <Pressable key={f} onPress={() => prefs.set({ hourFormat: f })} style={[s.chip, prefs.hourFormat === f && s.chipOn]}>
                <Text style={prefs.hourFormat === f ? s.chipTxtOn : s.chipTxt}>{f === '24h' ? '24 h' : '12 h (a. m./p. m.)'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>El día inicia a las {prefs.dayStart}:00</Text>
          <View style={s.row}>
            <Pressable onPress={() => prefs.set({ dayStart: Math.max(0, prefs.dayStart - 1) })} style={s.step}><Text style={s.stepTxt}>−1 h</Text></Pressable>
            <Pressable onPress={() => prefs.set({ dayStart: Math.min(prefs.dayEnd - 1, prefs.dayStart + 1) })} style={s.step}><Text style={s.stepTxt}>+1 h</Text></Pressable>
          </View>
          <Text style={s.label}>El día termina a las {prefs.dayEnd}:00</Text>
          <View style={s.row}>
            <Pressable onPress={() => prefs.set({ dayEnd: Math.max(prefs.dayStart + 1, prefs.dayEnd - 1) })} style={s.step}><Text style={s.stepTxt}>−1 h</Text></Pressable>
            <Pressable onPress={() => prefs.set({ dayEnd: Math.min(24, prefs.dayEnd + 1) })} style={s.step}><Text style={s.stepTxt}>+1 h</Text></Pressable>
          </View>
        </Card>
        <Card>
          <Text style={s.title2}>Datos de prueba</Text>
          <Text style={s.remSub}>
            {prefs.demoCleared
              ? 'Ocultos. Inicio muestra tus metas y personas reales (o un espacio vacío hasta que crees las tuyas).'
              : 'Metas diarias, semanales y personas de ejemplo. Bórralos cuando ya uses tus datos reales.'}
          </Text>
          {prefs.demoCleared ? (
            <Pressable style={s.ghost} onPress={() => prefs.set({ demoCleared: false })}>
              <Text style={s.ghostTxt}>Volver a mostrar los ejemplos</Text>
            </Pressable>
          ) : (
            <Pressable style={s.danger} onPress={confirmClearDemo}>
              <Text style={s.dangerTxt}>Eliminar datos de prueba</Text>
            </Pressable>
          )}
        </Card>
        <Card>
          <Text style={s.title2}>Sincronización</Text>
          <Text style={s.remSub}>
            {pending === 0
              ? 'Todo enviado al servidor.'
              : `${pending} cambio(s) guardado(s) en el teléfono, todavía sin enviar.`}
          </Text>
          {syncMsg ? <Text style={s.remSub}>{syncMsg}</Text> : null}
          <Pressable
            style={s.ghost}
            onPress={async () => {
              setSyncMsg('Enviando…');
              const r = await flushPending(true);
              const left = (await loadOps()).length;
              setPending(left);
              if (left === 0) {
                setSyncMsg(
                  r.failed
                    ? `Todo enviado (${r.failed} rechazado(s) por el servidor).`
                    : 'Todo sincronizado.',
                );
              } else if (r.sent === 0) {
                setSyncMsg('Sin conexión con el servidor. Se reintentará solo.');
              } else {
                setSyncMsg(`${r.sent} enviado(s), quedan ${left}.`);
              }
            }}
          >
            <Text style={s.ghostTxt}>Sincronizar ahora</Text>
          </Pressable>
          <Pressable
            style={s.ghost}
            onPress={() =>
              Alert.alert(
                'Descartar cambios pendientes',
                `Se perderán ${pending} cambio(s) guardado(s) en el teléfono y no se enviarán al servidor.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Descartar',
                    style: 'destructive',
                    onPress: async () => {
                      await clearOps();
                      setPending(0);
                      setSyncMsg('Cambios pendientes descartados.');
                    },
                  },
                ],
              )
            }
          >
            <Text style={s.ghostTxt}>Descartar pendientes</Text>
          </Pressable>
        </Card>
        <Card>
          <Text style={s.title2}>Legal</Text>
          <Pressable style={s.ghost} onPress={() => router.push('/privacidad')}>
            <Text style={s.ghostTxt}>Política de privacidad</Text>
          </Pressable>
          <Pressable style={s.ghost} onPress={() => router.push('/terminos')}>
            <Text style={s.ghostTxt}>Términos de uso</Text>
          </Pressable>
          <Text style={s.remSub}>Planner Today · 19 oct 2026</Text>
        </Card>
        <Card>
          <Text style={s.title2}>Seguridad</Text>
          <Text style={s.label}>Contraseña actual</Text>
          <TextInput
            value={curPass}
            onChangeText={setCurPass}
            style={s.input}
            secureTextEntry
            placeholder="Tu contraseña"
          />
          <Text style={s.label}>Nueva contraseña (mínimo 8 caracteres)</Text>
          <TextInput
            value={newPass}
            onChangeText={setNewPass}
            style={s.input}
            secureTextEntry
            placeholder="Nueva contraseña"
          />
          <Pressable
            style={[s.btn, passBusy && { opacity: 0.6 }]}
            onPress={onChangePassword}
            disabled={passBusy}
          >
            <Text style={s.btnTxt}>{passBusy ? 'Guardando…' : 'Cambiar contraseña'}</Text>
          </Pressable>
          {passMsg ? <Text style={s.remSub}>{passMsg}</Text> : null}
        </Card>
        <Card>
          <Text style={s.title2}>Eliminar cuenta</Text>
          <Text style={s.remSub}>
            Borra tu perfil y todos tus datos (ingresos, gastos, tareas, eventos, metas, lugares y
            contactos). No se puede deshacer.
          </Text>
          <Text style={s.label}>Escribe ELIMINAR para confirmar</Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            style={s.input}
            placeholder="ELIMINAR"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            style={[s.danger, (delBusy || confirmText.trim() !== 'ELIMINAR') && { opacity: 0.5 }]}
            onPress={onDeleteAccount}
            disabled={delBusy || confirmText.trim() !== 'ELIMINAR'}
          >
            <Text style={s.dangerTxt}>{delBusy ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
          </Pressable>
          {delMsg ? <Text style={s.remSub}>{delMsg}</Text> : null}
        </Card>
        <Pressable
          style={s.out}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={s.outTxt}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  title2: { fontSize: 17, fontWeight: '800', color: colors.text },
  step: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.card },
  stepTxt: { fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginBottom: 6 },
  label: { fontSize: 13, color: colors.text, marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: colors.card },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  curRow: { flexDirection: 'row', gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700' },
  chipTxtOn: { color: '#fff', fontWeight: '700' },
  btn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  ghost: { marginTop: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, alignItems: 'center' },
  ghostTxt: { fontWeight: '700', color: colors.muted },
  danger: { marginTop: 10, borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 12, alignItems: 'center' },
  dangerTxt: { color: colors.danger, fontWeight: '800' },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  remTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  remSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  out: { marginTop: 4, borderWidth: 1, borderColor: colors.danger, borderRadius: 14, padding: 14, alignItems: 'center' },
  outTxt: { color: colors.danger, fontWeight: '800' },
});
}
