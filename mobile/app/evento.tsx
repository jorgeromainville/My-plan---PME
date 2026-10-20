import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createEvent, deleteEvent, getEvent, listEvents, updateEvent, type EventRepeat } from '../src/services/events';
import { errorMessage } from '../src/services/api';
import { NativeDate, NativeTime } from '../src/components/NativeTime';
import { DurationChips, shift } from '../src/components/TimeWheel';
import { useCatalog } from '../src/store/useCatalog';
import { listContacts, type ContactRef } from '../src/services/contacts';
import { useAppStore } from '../src/store/useAppStore';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { addDays, parseLocalDay } from '../src/utils/dates';
import { Icon } from '../src/components/Icon';

const NOTIFY = [0, 15, 30, 60];
const REPEATS: { v: EventRepeat; label: string }[] = [
  { v: 'none', label: 'No' },
  { v: 'daily', label: 'Diaria' },
  { v: 'weekly', label: 'Semanal' },
  { v: 'monthly', label: 'Mensual' },
  { v: 'mon_wed', label: 'Lun-Mié' },
  { v: 'tue_thu', label: 'Mar-Jue' },
  { v: 'mon_wed_fri', label: 'Lun-Mié-Vie' },
  { v: 'weekdays', label: 'Laborables' },
  { v: 'weekends', label: 'Fines' },
];
const COLORS = ['#6B9ECF', '#6FA287', '#C9A44A', '#D98162', '#6E7C8A', '#E07A5F'];

function hhmm(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

function addMinutes(hhmmV: string, mins: number): string {
  const [h, m] = hhmmV.split(':').map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// Hora actual redondeada al :00/:30 siguiente.
function nowRounded(): string {
  const n = new Date();
  const mins = n.getHours() * 60 + n.getMinutes();
  const r = Math.ceil(mins / 30) * 30;
  return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
}

export default function EventoForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { id, date: dateParam, time: timeParam, end: endParam } = useLocalSearchParams<{ id?: string; date?: string; time?: string; end?: string }>();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [title, setTitle] = useState('');
  const kinds = useCatalog((c) => c.kinds);
  const [type, setType] = useState('Evento');
  const [color, setColor] = useState(COLORS[0]);
  const [isBackup, setIsBackup] = useState(false);
  const [date, setDate] = useState(dateParam ? new Date(dateParam) : selectedDate);
  const [start, setStart] = useState(timeParam ?? '12:00');
  const [end, setEnd] = useState(endParam ?? (timeParam ? addMinutes(timeParam, 60) : '13:00'));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [notifyMins, setNotifyMins] = useState(30);
  const [repeat, setRepeat] = useState<EventRepeat>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [hasUntil, setHasUntil] = useState(false);
  const [contacts, setContacts] = useState<ContactRef[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cross, setCross] = useState<string[] | null>(null);
  const initial = React.useRef('');

  function snapshot(): string {
    return JSON.stringify({ title, type, color, isBackup, date, start, end, location, description, notifyMins, repeat, repeatUntil, hasUntil, picked });
  }

  useEffect(() => {
    listContacts().then(setContacts).catch(() => setContacts([]));
    if (!id) initial.current = snapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const e = await getEvent(id);
        setTitle(e.title);
        setType(e.type);
        setColor(e.color ?? COLORS[0]);
        setIsBackup(e.isBackup);
        setDate(new Date(e.date));
        setStart(e.startTime);
        setEnd(e.endTime);
        setLocation(e.location ?? '');
        setDescription(e.description ?? '');
        setNotifyMins(e.notifyMins);
        setRepeat(e.repeat);
        if (e.repeatUntil) {
          const u = new Date(e.repeatUntil);
          setRepeatUntil(`${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, '0')}-${String(u.getDate()).padStart(2, '0')}`);
          setHasUntil(true);
        }
        setPicked((e.contacts ?? []).map((c) => c.id));
        setTimeout(() => { initial.current = snapshot(); }, 0);
      } catch {
        setError('No se pudo cargar el evento.');
      }
    })();
  }, [id]);

  async function onSave() {
    setError('');
    if (!title.trim()) {
      setError('Ponle un nombre al evento.');
      return;
    }
    if (!hhmm(start) || !hhmm(end)) {
      setError('Horas con formato HH:MM.');
      return;
    }
    if (end <= start) {
      setError('La hora final debe ser mayor que la inicial.');
      return;
    }
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    try {
      // Aviso de cruce: ¿pisa otro evento del mismo día?
      if (!cross) {
        const from = new Date(d);
        const to = new Date(d);
        to.setHours(23, 59, 59, 999);
        try {
          const day = await listEvents(from.toISOString(), to.toISOString());
          const clash = day
            .filter((e) => e.id !== id && start < e.endTime && end > e.startTime)
            .map((e) => `${e.title} (${e.startTime}–${e.endTime})`);
          if (clash.length > 0) {
            setCross(clash);
            return;
          }
        } catch {
          // sin conexión para verificar: se guarda igual
        }
      }
      const untilDate = parseLocalDay(repeatUntil);
      const payload = {
        title: title.trim(),
        type,
        color,
        isBackup,
        date: d.toISOString(),
        startTime: start,
        endTime: end,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        notifyMins: isBackup ? 0 : notifyMins,
        repeat,
        repeatUntil: repeat !== 'none' && hasUntil && untilDate ? untilDate.toISOString() : null,
        contactIds: picked,
      };
      if (id) await updateEvent(id, payload);
      else await createEvent(payload);
      setCross(null);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteEvent(id);
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
            <Icon name="x" size={20} color={colors.text} />
          </Pressable>
          <Text style={s.title}>{id ? 'Editar evento' : 'Nuevo evento'}</Text>
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
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={title} onChangeText={setTitle} placeholder="Ej. Reunión con cliente" />

        <Text style={s.label}>Tipo</Text>
        <View style={s.wrap}>
          {kinds.map((k) => (
            <Pressable
              key={k.name}
              onPress={() => {
                setType(k.name);
                setColor(k.color); // el tipo manda su color, ajustable abajo
              }}
              style={[s.chip, type === k.name && s.chipOn]}
            >
              <View style={s.chipRow}>
                <View style={[s.typeDot, { backgroundColor: k.color }]} />
                <Text style={type === k.name ? s.chipTxtOn : s.chipTxt}>{k.name}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Color</Text>
        <View style={s.row}>
          {[...new Set([...COLORS, color])].map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[s.dot, { backgroundColor: c }, color === c && s.dotOn]}
              accessibilityLabel={`Color ${c}`}
            />
          ))}
        </View>

        <Pressable onPress={() => setIsBackup(!isBackup)} style={s.tentRow} accessibilityRole="checkbox">
          <View style={[s.box, isBackup && s.boxOn]}>
            {isBackup ? <Icon name="check" size={14} color={colors.text} strokeWidth={3} /> : null}
          </View>
          <Text style={s.tentTxt}>Es respaldo (se ve opaco y va después, sin recordatorio)</Text>
        </Pressable>

        <Text style={s.label}>Fecha</Text>
        <View style={s.row}>
          <Pressable onPress={() => setDate(addDays(date, -1))} style={s.nav}><Icon name="chevronLeft" size={20} color={colors.muted} /></Pressable>
          <Text style={s.date}>{date.toLocaleDateString()}</Text>
          <Pressable onPress={() => setDate(addDays(date, 1))} style={s.nav}><Icon name="chevronRight" size={20} color={colors.muted} /></Pressable>
        </View>

        <Text style={s.label}>Inicio</Text>
        <Pressable onPress={() => { const n = nowRounded(); setStart(n); setEnd(shift(n, 60)); }} style={s.now}>
          <Text style={s.nowTxt}>Ahora ({nowRounded()})</Text>
        </Pressable>
        <NativeTime label="Hora de inicio" value={start} onChange={setStart} />

        <Text style={s.label}>Fin</Text>
        <NativeTime label="Hora de fin" value={end} onChange={setEnd} />
        <Text style={s.mini}>Duración rápida desde el inicio:</Text>
        <DurationChips start={start} onPick={setEnd} />

        <Text style={s.label}>Ubicación</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={location} onChangeText={setLocation} placeholder="Opcional" />

        <Text style={s.label}>Reporte / notas</Text>
        <TextInput placeholderTextColor={colors.muted} style={[s.input, s.area]} value={description} onChangeText={setDescription} multiline placeholder="Escribe un reporte para este evento…" />

        <Text style={s.label}>Personas (adjuntar contactos)</Text>
        {contacts.length === 0 ? (
          <Text style={s.hint}>Aún no hay contactos. Se gestionan en Fase 3.</Text>
        ) : (
          <View style={s.wrap}>
            {contacts.map((c) => {
              const on = picked.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}
                  style={[s.chip, on && s.chipOn]}
                >
                  <Text style={on ? s.chipTxtOn : s.chipTxt}>{c.firstName}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={s.label}>Avisar antes (se guarda; el push llega en Fase 8)</Text>
        <View style={s.row}>
          {NOTIFY.map((m) => (
            <Pressable key={m} onPress={() => setNotifyMins(m)} style={[s.chip, notifyMins === m && s.chipOn]}>
              <Text style={notifyMins === m ? s.chipTxtOn : s.chipTxt}>{m === 0 ? 'No' : `${m} min`}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Repetición</Text>
        <View style={s.wrap}>
          {REPEATS.map((r) => (
            <Pressable key={r.v} onPress={() => setRepeat(r.v)} style={[s.chip, repeat === r.v && s.chipOn]}>
              <Text style={repeat === r.v ? s.chipTxtOn : s.chipTxt}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
        {repeat !== 'none' ? (
          <>
            <Pressable onPress={() => setHasUntil(!hasUntil)} style={s.tentRow} accessibilityRole="checkbox">
              <View style={[s.box, hasUntil && s.boxOn]}>
                {hasUntil ? <Icon name="check" size={14} color={colors.text} strokeWidth={3} /> : null}
              </View>
              <Text style={s.tentTxt}>Repetir hasta…</Text>
            </Pressable>
            {hasUntil ? (
              <NativeDate label="Fecha límite de repetición" value={repeatUntil} onChange={setRepeatUntil} />
            ) : null}
          </>
        ) : null}

        {cross ? (
          <View style={s.confirm}>
            <Text style={s.confirmT}>Se cruza con: {cross.join(' · ')}</Text>
            <Text style={s.confirmSub}>¿Guardar igual?</Text>
            <View style={s.row}>
              <Pressable onPress={() => setCross(null)} style={s.keep}>
                <Text style={s.keepTxt}>Revisar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const keep = cross;
                  void keep;
                  setCross(['__force__']);
                  setTimeout(onSave, 0);
                }}
                style={s.drop}
              >
                <Text style={s.dropTxt}>Guardar igual</Text>
              </Pressable>
            </View>
          </View>
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
  title: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, color: colors.text },
  area: { minHeight: 80, textAlignVertical: 'top', color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  x: { width: 40, paddingVertical: 6 },
  xTxt: { fontSize: 20, color: colors.text },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 8 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  confirmSub: { color: colors.muted, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: colors.onPrimary, fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
  backup: { backgroundColor: colors.bgSoft, borderRadius: 14, padding: 12, marginTop: 8 },
  now: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, marginBottom: 8 },
  nowTxt: { fontWeight: '800', color: colors.blue, fontSize: 13 },
  mini: { fontSize: 12, color: colors.muted, marginTop: 8 },
  wrap: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  dotOn: { borderColor: colors.primary },
  tentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  boxOn: { backgroundColor: colors.yellowBg, borderColor: colors.yellow },
  boxTxt: { fontWeight: '900', color: colors.text },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeDot: { width: 8, height: 8, borderRadius: 99 },
  tentTxt: { fontWeight: '600', color: colors.text, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12 },
  row2: { flexDirection: 'row', gap: 12 },
  nav: { paddingHorizontal: 16, paddingVertical: 8 },
  navTxt: { fontSize: 24, color: colors.muted },
  date: { fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginTop: 12 },
  btn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: colors.onPrimary, fontWeight: '800' },
  del: { marginTop: 10, padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
});
}
