import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { API_BASE, flushPending } from '../src/services/api';
import { clearOps, loadOps } from '../src/services/sync';
import { cancelReminders, remindersGranted, remindersNativeMissing, rescheduleReminders, sendTestReminder } from '../src/services/reminders';
import { useAppStore } from '../src/store/useAppStore';
import { usePrefs } from '../src/store/usePrefs';
import { useSession } from '../src/store/useSession';
import { colors } from '../src/theme/colors';

export default function Perfil() {
  const router = useRouter();
  const { userName, setUserName } = useAppStore();
  const signOut = useSession((s) => s.signOut);
  const sessionName = useSession((s) => s.userName);
  const prefs = usePrefs();
  const [name, setName] = useState(sessionName || userName);
  const [currency, setCurrency] = useState('PEN');
  const [remMsg, setRemMsg] = useState('');
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadOps().then((o) => setPending(o.length));
    }, []),
  );

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
          <Text style={s.label}>Moneda (PEN por defecto)</Text>
          <View style={s.row}>
            {['PEN', 'USD', 'EUR'].map((m) => (
              <Pressable key={m} onPress={() => setCurrency(m)} style={[s.chip, currency === m && s.chipOn]}>
                <Text style={currency === m ? s.chipTxtOn : s.chipTxt}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.btn} onPress={() => setUserName(name.trim() || 'Usuario')}>
            <Text style={s.btnTxt}>Guardar</Text>
          </Pressable>
          <Text style={s.remSub}>Servidor: {API_BASE}</Text>
        </Card>
        <Card>
          <Text style={s.label}>Tema: Claro / Oscuro / Automático (Fase 8)</Text>
          <Text style={s.label}>Inicio de semana: Lunes (configurable Fase 8)</Text>
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '900', color: colors.text },
  title2: { fontSize: 17, fontWeight: '800', color: colors.text },
  step: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  stepTxt: { fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, marginBottom: 6 },
  label: { fontSize: 13, color: colors.text, marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 8 },
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
