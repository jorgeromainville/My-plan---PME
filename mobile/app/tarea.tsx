import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createTask, deleteTask, getTask, updateTask, type Priority, type TaskStatus } from '../src/services/tasks';
import { errorMessage } from '../src/services/api';
import { NativeTime } from '../src/components/NativeTime';
import { useAppStore } from '../src/store/useAppStore';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { addDays } from '../src/utils/dates';

const PRIORITIES: Priority[] = ['baja', 'media', 'alta'];
const STATUSES: TaskStatus[] = ['pendiente', 'en_progreso', 'completada'];

export default function TareaForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { id, date: dateParam, time: timeParam } = useLocalSearchParams<{ id?: string; date?: string; time?: string }>();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateParam ? new Date(dateParam) : selectedDate);
  const [time, setTime] = useState(timeParam ?? '');
  const [priority, setPriority] = useState<Priority>('media');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pendiente');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const initial = React.useRef('');

  function snapshot(): string {
    return JSON.stringify({ title, date, time, priority, category, description, status });
  }

  useEffect(() => {
    if (!id) initial.current = snapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const t = await getTask(id);
        setTitle(t.title);
        setDate(new Date(t.date));
        setTime(t.time ?? '');
        setPriority(t.priority);
        setCategory(t.category);
        setDescription(t.description ?? '');
        setStatus(t.status);
        setTimeout(() => { initial.current = snapshot(); }, 0);
      } catch {
        setError('No se pudo cargar la tarea.');
      }
    })();
  }, [id]);

  async function onSave() {
    setError('');
    if (!title.trim()) {
      setError('Ponle un nombre a la tarea.');
      return;
    }
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      setError('Hora con formato HH:MM (ej. 09:30) o vacía.');
      return;
    }
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    try {
      if (id) {
        await updateTask(id, {
          title: title.trim(), date: d.toISOString(), time: time || undefined,
          priority, category: category.trim() || 'General',
          description: description.trim() || undefined, status,
        });
      } else {
        await createTask({
          title: title.trim(), date: d.toISOString(), time: time || undefined,
          priority, category: category.trim() || 'General',
          description: description.trim() || undefined, status: 'pendiente',
        });
      }
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteTask(id);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable
            onPress={() => {
              if (snapshot() !== initial.current) setConfirming(true);
              else router.back();
            }}
            accessibilityLabel="Cerrar"
            style={s.x}
          >
            <Text style={s.xTxt}>✕</Text>
          </Pressable>
          <Text style={s.title}>{id ? 'Editar tarea' : 'Nueva tarea'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {confirming ? (
          <View style={s.confirm}>
            <Text style={s.confirmT}>¿Descartar cambios?</Text>
            <View style={s.row}>
              <Pressable onPress={() => setConfirming(false)} style={s.keep}>
                <Text style={s.keepTxt}>Continuar editando</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} style={s.drop}>
                <Text style={s.dropTxt}>Descartar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={s.label}>Nombre</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={title} onChangeText={setTitle} placeholder="Ej. Llamar a cliente" />

        <Text style={s.label}>Fecha</Text>
        <View style={s.row}>
          <Pressable onPress={() => setDate(addDays(date, -1))} style={s.nav}><Text style={s.navTxt}>‹</Text></Pressable>
          <Text style={s.date}>{date.toLocaleDateString()}</Text>
          <Pressable onPress={() => setDate(addDays(date, 1))} style={s.nav}><Text style={s.navTxt}>›</Text></Pressable>
        </View>

        <Text style={s.label}>Hora (opcional)</Text>
        {time === '' ? (
          <Pressable onPress={() => setTime('09:00')} style={s.addTime}>
            <Text style={s.addTimeTxt}>+ Agregar hora</Text>
          </Pressable>
        ) : (
          <View>
            <NativeTime label="Hora de la tarea" value={time} onChange={setTime} />
            <Pressable onPress={() => setTime('')}>
              <Text style={s.noTime}>Quitar hora</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.label}>Prioridad</Text>
        <View style={s.row}>
          {PRIORITIES.map((p) => (
            <Pressable key={p} onPress={() => setPriority(p)} style={[s.chip, priority === p && s.chipOn]}>
              <Text style={priority === p ? s.chipTxtOn : s.chipTxt}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Categoría</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={category} onChangeText={setCategory} placeholder="General" />

        <Text style={s.label}>Descripción</Text>
        <TextInput placeholderTextColor={colors.muted} style={[s.input, s.area]} value={description} onChangeText={setDescription} multiline />

        {id ? (
          <>
            <Text style={s.label}>Estado</Text>
            <View style={s.row}>
              {STATUSES.map((st) => (
                <Pressable key={st} onPress={() => setStatus(st)} style={[s.chip, status === st && s.chipOn]}>
                  <Text style={status === st ? s.chipTxtOn : s.chipTxt}>{st.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={s.btn} onPress={onSave}>
          <Text style={s.btnTxt}>Guardar</Text>
        </Pressable>
        {id ? (
          <Pressable style={s.del} onPress={onDelete}>
            <Text style={s.delTxt}>Eliminar</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 18 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  x: { width: 40, paddingVertical: 6 },
  xTxt: { fontSize: 20, color: colors.text },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 8 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: '#fff', fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, color: colors.text },
  area: { minHeight: 80, textAlignVertical: 'top', color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nav: { paddingHorizontal: 16, paddingVertical: 8 },
  navTxt: { fontSize: 24, color: colors.muted },
  date: { fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginTop: 12 },
  addTime: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.muted, borderRadius: 12, padding: 13, alignItems: 'center' },
  addTimeTxt: { fontWeight: '700', color: colors.muted },
  noTime: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
  btn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  del: { marginTop: 10, padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
});
}
