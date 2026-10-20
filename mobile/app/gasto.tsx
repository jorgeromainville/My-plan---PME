import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../src/services/api';
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  getExpense,
  listExpenseCategories,
  updateExpense,
  type ExpenseCategory,
  type ExpenseKind,
} from '../src/services/expenses';
import { useAppStore } from '../src/store/useAppStore';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { addDays } from '../src/utils/dates';

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Formulario de gasto: monto + tipo fijo/variable + categorías con color.
export default function GastoForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<ExpenseKind>('variable');
  const [category, setCategory] = useState('Otros');
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [newCat, setNewCat] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    listExpenseCategories().then(setCats).catch(() => {});
    if (!id) return;
    (async () => {
      try {
        const e = await getExpense(id);
        setTitle(e.title);
        setDate(new Date(e.date));
        setAmount(String(e.amount));
        setKind(e.kind);
        setCategory(e.category);
        setNote(e.note ?? '');
      } catch (er) {
        setError(errorMessage(er));
      }
    })();
  }, [id]);

  async function onSave() {
    setError('');
    if (!title.trim()) {
      setError('Describe el gasto.');
      return;
    }
    const a = num(amount);
    if (!Number.isFinite(a) || a < 0) {
      setError('Monto válido (0 o más).');
      return;
    }
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    try {
      const payload = {
        title: title.trim(),
        date: d.toISOString(),
        category,
        amount: Math.round(a * 100) / 100,
        kind,
        note: note.trim() || undefined,
      };
      if (id) await updateExpense(id, payload);
      else await createExpense(payload);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteExpense(id);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.x} accessibilityLabel="Volver">
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.title}>{id ? 'Editar gasto' : 'Nuevo gasto'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.label}>Descripción *</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={title} onChangeText={setTitle} placeholder="Ej. Pasaje, Almuerzo" />

        <Text style={s.label}>Fecha</Text>
        <View style={s.row}>
          <Pressable onPress={() => setDate(addDays(date, -1))} style={s.nav}><Text style={s.navTxt}>‹</Text></Pressable>
          <Text style={s.date}>{date.toLocaleDateString()}</Text>
          <Pressable onPress={() => setDate(addDays(date, 1))} style={s.nav}><Text style={s.navTxt}>›</Text></Pressable>
        </View>

        <Text style={s.label}>Monto *</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />

        <Text style={s.label}>Tipo</Text>
        <View style={s.row}>
          {(['fijo', 'variable'] as const).map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.chip, kind === k && s.chipOn]}>
              <Text style={kind === k ? s.chipTxtOn : s.chipTxt}>{k === 'fijo' ? 'Fijo' : 'Variable'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Categoría</Text>
        <View style={s.wrap}>
          {cats.map((c) => (
            <Pressable key={c.name} onPress={() => setCategory(c.name)} style={[s.chip, category === c.name && s.chipOn]}>
              {c.color ? <View style={[s.dot, { backgroundColor: c.color }]} /> : null}
              <Text style={category === c.name ? s.chipTxtOn : s.chipTxt}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.newCat}>
          <TextInput placeholderTextColor={colors.muted} style={[s.input, { flex: 1, marginBottom: 0 }]} value={newCat} onChangeText={setNewCat} placeholder="Nueva categoría" />
          <Pressable
            style={s.plus}
            onPress={async () => {
              if (!newCat.trim()) return;
              try {
                await createExpenseCategory(newCat.trim());
                setCats(await listExpenseCategories());
                setCategory(newCat.trim());
                setNewCat('');
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Text style={s.plusTxt}>+</Text>
          </Pressable>
        </View>

        <Text style={s.label}>Nota</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={note} onChangeText={setNote} placeholder="Opcional" />

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
              <Text style={s.confirmT}>¿Eliminar gasto?</Text>
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
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, marginBottom: 4, color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nav: { paddingHorizontal: 16, paddingVertical: 8 },
  navTxt: { fontSize: 24, color: colors.muted },
  date: { fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: colors.onPrimary, fontWeight: '700', fontSize: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  newCat: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  plus: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { color: colors.onPrimary, fontSize: 22 },
  error: { color: colors.danger, marginTop: 12 },
  btn: { marginTop: 18, backgroundColor: colors.coral, borderRadius: 14, padding: 15, alignItems: 'center' },
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
