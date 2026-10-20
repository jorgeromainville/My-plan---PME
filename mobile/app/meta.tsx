import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../src/services/api';
import { eventPast } from '../src/components/DayAgenda';
import { addGoalLog, createGoal, deleteGoal, deleteGoalLog, getGoal, listGoalLogs, updateGoal, type GoalKind, type GoalLog, type GoalPeriod } from '../src/services/goals';
import { createEvent, listEvents, updateEvent, type CalEvent } from '../src/services/events';
import { NativeTime } from '../src/components/NativeTime';
import { listContacts, type Contact } from '../src/services/contacts';
import { listContactCategories } from '../src/services/contacts';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';

const KINDS: { v: GoalKind; label: string; hint: string; unit: string }[] = [
  { v: 'ingresos', label: 'Ingresos', hint: 'Suma sola de tus ingresos', unit: 'S/' },
  { v: 'contactos', label: 'Contactos', hint: 'Personas contactadas', unit: 'personas' },
  { v: 'tareas', label: 'Tareas', hint: 'Tareas completadas', unit: 'tareas' },
  { v: 'horas', label: 'Horas', hint: 'Horas en eventos vinculados', unit: 'horas' },
  { v: 'veces', label: 'Veces', hint: 'Veces que vas (ej. gym 2/semana)', unit: 'veces' },
  { v: 'custom', label: 'Otra', hint: 'Avance manual (ej. kilómetros)', unit: 'u' },
];

const WEEKDAYS = [
  { v: 1, label: 'Lun' },
  { v: 2, label: 'Mar' },
  { v: 3, label: 'Mié' },
  { v: 4, label: 'Jue' },
  { v: 5, label: 'Vie' },
  { v: 6, label: 'Sáb' },
  { v: 0, label: 'Dom' },
];

const PERIODS: { v: GoalPeriod; label: string }[] = [
  { v: 'day', label: 'Diaria' },
  { v: 'week', label: 'Semanal' },
  { v: 'month', label: 'Mensual' },
];

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Formulario de meta: crear/editar/eliminar + cuota por hora opcional.
export default function MetaForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('tareas');
  const [filter, setFilter] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [period, setPeriod] = useState<GoalPeriod>('day');
  const [target, setTarget] = useState('');
  const [manual, setManual] = useState('0');
  const [logs, setLogs] = useState<GoalLog[]>([]);
  const [logAmount, setLogAmount] = useState('');
  const [logNote, setLogNote] = useState('');
  const [linked, setLinked] = useState<CalEvent[]>([]);
  const [cands, setCands] = useState<CalEvent[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [people, setPeople] = useState<Contact[]>([]);
  const [touched, setTouched] = useState<string[]>([]);
  // Crear eventos desde la meta: días + hora (ej. mar/jue 5–6pm).
  const [days, setDays] = useState<number[]>([]);
  const [evStart, setEvStart] = useState('17:00');
  const [evEnd, setEvEnd] = useState('18:00');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const unit = KINDS.find((k) => k.v === kind)?.unit ?? 'u';

  async function loadLinked() {
    if (!id) return;
    try {
      const past = new Date();
      past.setDate(past.getDate() - 370);
      const fut = new Date();
      fut.setDate(fut.getDate() + 370);
      const [l, all] = await Promise.all([
        listEvents(past.toISOString(), fut.toISOString(), id),
        (() => {
          const a = new Date();
          a.setDate(a.getDate() - 30);
          const b = new Date();
          b.setDate(b.getDate() + 60);
          return listEvents(a.toISOString(), b.toISOString());
        })(),
      ]);
      setLinked(l);
      setCands(all.filter((e) => e.goalId !== id).slice(0, 20));
    } catch {
      // lista vacía, se reintenta al guardar
    }
  }

  useEffect(() => {
    listContactCategories().then((c) => setCats(c.map((x) => x.name))).catch(() => {});
    listContacts({})
      .then((all) => setPeople(all.sort((a, b) => a.firstName.localeCompare(b.firstName))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLinked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const g = await getGoal(id);
        setTitle(g.title);
        setKind(g.kind);
        setFilter(g.filter ?? '');
        setPeriod(g.period);
        setTarget(String(g.target));
        setManual(String(g.current));
        setLogs(await listGoalLogs(id));
        setMembers(g.memberIds ?? []);
        setTouched(g.touchedIds ?? []);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [id]);

  async function onSave() {
    setError('');
    if (!title.trim()) {
      setError('Ponle un nombre.');
      return;
    }
    const t = num(target);
    if (!Number.isFinite(t) || t <= 0) {
      setError('Objetivo mayor a 0.');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        kind,
        filter: kind === 'contactos' && filter ? filter : null,
        members: kind === 'contactos' && members.length > 0 ? members : null,
        period,
        target: t,
        unit,
        current: kind === 'custom' ? (Number.isFinite(num(manual)) ? num(manual) : 0) : undefined,
      };
      let gid = id;
      if (id) await updateGoal(id, payload);
      else gid = (await createGoal(payload)).id;
      // Crea los eventos en los días elegidos y los vincula (horas/veces).
      if ((kind === 'horas' || kind === 'veces' || kind === 'tareas') && days.length > 0 && gid) {
        if (evEnd <= evStart) {
          setError('En los días: la hora final debe ser mayor que la inicial.');
          return;
        }
        const today = new Date();
        for (const wd of days) {
          const d = new Date(today);
          d.setDate(d.getDate() + ((wd - today.getDay() + 7) % 7));
          d.setHours(0, 0, 0, 0);
          try {
            await createEvent({
              title: title.trim(),
              type: 'Personal',
              isBackup: false,
              date: d.toISOString(),
              startTime: evStart,
              endTime: evEnd,
              notifyMins: 30,
              repeat: 'none',
              goalId: kind === 'tareas' ? undefined : gid,
              contactIds: [],
            });
          } catch {
            // sigue con los demás días
          }
        }
      }
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteGoal(id);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const kindHint = KINDS.find((k) => k.v === kind)?.hint ?? '';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>{id ? 'Editar meta' : 'Nueva meta'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.label}>Nombre *</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={title} onChangeText={setTitle} placeholder="Ej. Contactar 2 personas" />

        <Text style={s.label}>Tipo</Text>
        <View style={s.wrap}>
          {KINDS.map((k) => (
            <Pressable key={k.v} onPress={() => setKind(k.v)} style={[s.chip, kind === k.v && s.chipOn]}>
              <Text style={kind === k.v ? s.chipTxtOn : s.chipTxt}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.hint}>{kindHint}</Text>

        <Text style={s.label}>Período</Text>
        <View style={s.wrap}>
          {PERIODS.map((p) => (
            <Pressable key={p.v} onPress={() => setPeriod(p.v)} style={[s.chip, period === p.v && s.chipOn]}>
              <Text style={period === p.v ? s.chipTxtOn : s.chipTxt}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Objetivo * ({unit})</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Ej. 5" />

        {(kind === 'horas' || kind === 'veces' || kind === 'tareas') && !id ? (
          <>
            <Text style={s.label}>Crear eventos los días… (opcional)</Text>
            <View style={s.wrap}>
              {WEEKDAYS.map((w) => (
                <Pressable
                  key={w.v}
                  onPress={() => setDays(days.includes(w.v) ? days.filter((x) => x !== w.v) : [...days, w.v])}
                  style={[s.chip, days.includes(w.v) && s.chipOn]}
                >
                  <Text style={days.includes(w.v) ? s.chipTxtOn : s.chipTxt}>{w.label}</Text>
                </Pressable>
              ))}
            </View>
            {days.length > 0 ? (
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lab}>Inicio</Text>
                  <NativeTime label="Inicio" value={evStart} onChange={setEvStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.lab}>Fin</Text>
                  <NativeTime label="Fin" value={evEnd} onChange={setEvEnd} />
                </View>
              </View>
            ) : null}
            <Text style={s.hint}>Al guardar se crean (y vinculan) en el planificador.</Text>
          </>
        ) : null}

        {kind === 'contactos' ? (
          <>
            <Text style={s.label}>Categoría a contar</Text>
            <View style={s.wrap}>
              <Pressable onPress={() => setFilter('')} style={[s.chip, !filter && s.chipOn]}>
                <Text style={!filter ? s.chipTxtOn : s.chipTxt}>Todas</Text>
              </Pressable>
              {cats.map((c) => (
                <Pressable key={c} onPress={() => setFilter(c)} style={[s.chip, filter === c && s.chipOn]}>
                  <Text style={filter === c ? s.chipTxtOn : s.chipTxt}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.label}>Elegir personas ({members.length})</Text>
            <Text style={s.hint}>Primero la categoría elegida, luego el resto. Toca para marcar.</Text>
            {[...people.filter((p) => !filter || p.category === filter), ...people.filter((p) => filter && p.category !== filter)].map((p) => {
              const on = members.includes(p.id);
              const done = touched.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setMembers(on ? members.filter((x) => x !== p.id) : [...members, p.id])}
                  style={[s.logRow, on && s.pickedRow]}
                >
                  <Text style={s.logTxt}>
                    {on ? (done ? '✓ ' : '○ ') : '+ '}{p.firstName}{p.lastName ? ` ${p.lastName}` : ''} · {p.category}
                  </Text>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {kind === 'custom' ? (
          <>
            <Text style={s.label}>Avance manual</Text>
            <TextInput placeholderTextColor={colors.muted} style={s.input} value={manual} onChangeText={setManual} keyboardType="decimal-pad" />
          </>
        ) : null}

        {id ? (
          <>
            <Text style={s.label}>+ Registrar avance</Text>
            <View style={s.row2}>
              <TextInput placeholderTextColor={colors.muted} style={[s.input, { flex: 1 }]} value={logAmount} onChangeText={setLogAmount} keyboardType="decimal-pad" placeholder="Ej. 1.5" />
              <TextInput placeholderTextColor={colors.muted} style={[s.input, { flex: 2 }]} value={logNote} onChangeText={setLogNote} placeholder="Nota (ej. corrí)" />
              <Pressable
                onPress={async () => {
                  const a = num(logAmount);
                  if (!Number.isFinite(a) || a <= 0) {
                    setError('Cantidad mayor a 0.');
                    return;
                  }
                  try {
                    await addGoalLog(id, a, logNote.trim() || undefined);
                    setLogAmount('');
                    setLogNote('');
                    setLogs(await listGoalLogs(id));
                  } catch (e) {
                    setError(errorMessage(e));
                  }
                }}
                style={s.calc}
              >
                <Text style={s.calcTxt}>+</Text>
              </Pressable>
            </View>
            {logs.map((l) => (
              <View key={l.id} style={s.logRow}>
                <Text style={s.logTxt}>
                  +{l.amount} · {new Date(l.date).toLocaleDateString()}
                  {l.note ? ` · ${l.note}` : ''}
                </Text>
                <Pressable
                  onPress={async () => {
                    await deleteGoalLog(l.id);
                    setLogs(await listGoalLogs(id));
                  }}
                >
                  <Text style={s.delTxt}>✕</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {id && kind === 'horas' ? (
          <>
            <Text style={s.label}>Eventos vinculados (suman a esta meta)</Text>
            {linked.map((e) => {
              const past = eventPast(e);
              return (
                <View key={e.id} style={s.logRow}>
                  <Pressable
                    onPress={async () => {
                      await updateEvent(e.id, { done: !e.done });
                      loadLinked();
                    }}
                    style={[s.box, (e.done || past) && s.boxOn]}
                    accessibilityLabel="Marcar realizado"
                  >
                    {(e.done || past) ? <Text style={{ color: colors.text }}>✓</Text> : null}
                  </Pressable>
                  <Text style={s.logTxt}>
                    {e.title} · {new Date(e.date).toLocaleDateString()} {e.startTime}–{e.endTime}
                    {past && !e.done ? ' (auto)' : ''}
                  </Text>
                  <Pressable
                    onPress={async () => {
                      await updateEvent(e.id, { goalId: null });
                      loadLinked();
                    }}
                  >
                    <Text style={s.delTxt}>✕</Text>
                  </Pressable>
                </View>
              );
            })}
            {linked.length === 0 ? <Text style={s.hint}>Sin vincular. Elige abajo, ej. 1 h lunes + 1 h jueves.</Text> : null}
            <Text style={s.label}>Vincular eventos (±30/60 días)</Text>
            {cands.map((e) => (
              <Pressable
                key={e.id}
                onPress={async () => {
                  await updateEvent(e.id, { goalId: id });
                  loadLinked();
                }}
                style={s.logRow}
              >
                <Text style={s.logTxt}>
                  + {e.title} · {new Date(e.date).toLocaleDateString()} {e.startTime}–{e.endTime}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={s.btn} onPress={onSave}>
          <Text style={s.btnTxt}>Guardar</Text>
        </Pressable>
        {id ? (
          !confirmDel ? (
            <Pressable onPress={() => setConfirmDel(true)} style={s.del}>
              <Text style={s.delTxt}>Eliminar</Text>
            </Pressable>
          ) : (
            <View style={s.confirm}>
              <Text style={s.confirmT}>¿Eliminar meta?</Text>
              <View style={s.row}>
                <Pressable onPress={() => setConfirmDel(false)} style={s.keep}>
                  <Text style={s.keepTxt}>Conservar</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={s.drop}>
                  <Text style={s.dropTxt}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          )
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
  xTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  lab: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, color: colors.text },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  row2: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pickedRow: { borderColor: colors.green, borderWidth: 2 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  boxOn: { backgroundColor: colors.greenBg, borderColor: colors.green },
  logRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: colors.line },
  logTxt: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 13 },
  calc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  calcTxt: { color: colors.onPrimary, fontSize: 20, fontWeight: '900' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginTop: 12 },
  btn: { marginTop: 18, backgroundColor: colors.yellow, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: colors.onAccent, fontWeight: '800' },
  del: { marginTop: 10, padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: colors.onPrimary, fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
});
}
