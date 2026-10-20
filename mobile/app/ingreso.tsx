import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { NativeDate } from '../src/components/NativeTime';
import { errorMessage } from '../src/services/api';
import { listContacts, type Contact } from '../src/services/contacts';
import { createIncome, deleteIncome, getIncome, updateIncome, type PayMethod } from '../src/services/incomes';
import { useAppStore } from '../src/store/useAppStore';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { addDays, parseLocalDay } from '../src/utils/dates';
import { formatMoney } from '../src/utils/format';
import { PAY_METHODS } from './ingresos';

function num(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Formulario de ingreso: el total se calcula solo (cantidad × precio).
export default function IngresoForm() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('General');
  const [payMethod, setPayMethod] = useState<PayMethod>('Efectivo');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Contact[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const q = num(quantity);
  const p = num(price);
  const total = Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : NaN;

  useEffect(() => {
    listContacts({}).then(setClients).catch(() => {});
    if (!id) return;
    (async () => {
      try {
        const i = await getIncome(id);
        setTitle(i.title);
        setDate(new Date(i.date));
        setQuantity(String(i.quantity));
        setPrice(String(i.unitPrice));
        setCategory(i.category);
        setPayMethod(i.payMethod);
        setClientId(i.clientId ?? '');
        setNote(i.note ?? '');
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [id]);

  async function onSave() {
    setError('');
    if (!title.trim()) {
      setError('Describe el ingreso.');
      return;
    }
    if (!Number.isFinite(q) || q <= 0) {
      setError('Cantidad mayor a 0.');
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setError('Precio válido (0 o más).');
      return;
    }
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    try {
      const payload = {
        title: title.trim(),
        date: d.toISOString(),
        category: category.trim() || 'General',
        quantity: q,
        unitPrice: p,
        clientId: clientId || undefined,
        payMethod,
        note: note.trim() || undefined,
      };
      if (id) await updateIncome(id, payload);
      else await createIncome(payload);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await deleteIncome(id);
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
          <Text style={s.title}>{id ? 'Editar ingreso' : 'Nuevo ingreso'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={s.label}>Título *</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={title} onChangeText={setTitle} placeholder="Ej. Venta de pan, Pago cliente" />

        <Text style={s.label}>Fecha</Text>
        <View style={s.row}>
          <Pressable onPress={() => setDate(addDays(date, -1))} style={s.nav}><Text style={s.navTxt}>‹</Text></Pressable>
          <Text style={s.date}>{date.toLocaleDateString()}</Text>
          <Pressable onPress={() => setDate(addDays(date, 1))} style={s.nav}><Text style={s.navTxt}>›</Text></Pressable>
        </View>
        <NativeDate
          label="Elegir fecha"
          value=""
          onChange={(v) => {
            const d = parseLocalDay(v);
            if (d) setDate(d);
          }}
        />

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Cantidad</Text>
            <TextInput placeholderTextColor={colors.muted} style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="1" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Precio unit.</Text>
            <TextInput placeholderTextColor={colors.muted} style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
          </View>
        </View>

        <Card style={s.total}>
          <Text style={s.totalLabel}>Total automático</Text>
          <Text style={s.totalNum}>{Number.isFinite(total) ? formatMoney(total) : '—'}</Text>
        </Card>

        <Text style={s.label}>Categoría</Text>
        <TextInput placeholderTextColor={colors.muted} style={s.input} value={category} onChangeText={setCategory} placeholder="General" />

        <Text style={s.label}>Método de pago</Text>
        <View style={s.wrap}>
          {PAY_METHODS.map((m) => (
            <Pressable key={m} onPress={() => setPayMethod(m)} style={[s.chip, payMethod === m && s.chipOn]}>
              <Text style={payMethod === m ? s.chipTxtOn : s.chipTxt}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Cliente (opcional)</Text>
        <View style={s.wrap}>
          <Pressable onPress={() => setClientId('')} style={[s.chip, !clientId && s.chipOn]}>
            <Text style={!clientId ? s.chipTxtOn : s.chipTxt}>Ninguno</Text>
          </Pressable>
          {clients.map((c) => (
            <Pressable key={c.id} onPress={() => setClientId(c.id)} style={[s.chip, clientId === c.id && s.chipOn]}>
              <Text style={clientId === c.id ? s.chipTxtOn : s.chipTxt}>{c.firstName}</Text>
            </Pressable>
          ))}
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
              <Text style={s.confirmT}>¿Eliminar ingreso?</Text>
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
  input: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 13, color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  row2: { flexDirection: 'row', gap: 12 },
  nav: { paddingHorizontal: 16, paddingVertical: 8 },
  navTxt: { fontSize: 24, color: colors.muted },
  date: { fontWeight: '800', color: colors.text, flex: 1, textAlign: 'center' },
  total: { alignItems: 'center', backgroundColor: colors.greenBg, marginTop: 12 },
  totalLabel: { color: colors.muted, fontWeight: '700' },
  totalNum: { fontSize: 28, fontWeight: '900', color: colors.text },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700', fontSize: 12 },
  error: { color: colors.danger, marginTop: 12 },
  btn: { marginTop: 18, backgroundColor: colors.green, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnTxt: { color: colors.onAccent, fontWeight: '800' },
  del: { marginTop: 10, padding: 14, alignItems: 'center' },
  delTxt: { color: colors.danger, fontWeight: '700' },
  confirm: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10 },
  confirmT: { fontWeight: '800', color: colors.text, marginBottom: 10 },
  keep: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  keepTxt: { color: '#fff', fontWeight: '800' },
  drop: { flex: 1, padding: 12, alignItems: 'center' },
  dropTxt: { color: colors.danger, fontWeight: '800' },
});
}
