import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { errorMessage } from '../src/services/api';
import { financeSummary, listIncomes, type Income } from '../src/services/incomes';
import { dayRange } from '../src/services/tasks';
import { useAppStore } from '../src/store/useAppStore';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { formatMoney } from '../src/utils/format';

export const PAY_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Otro'] as const;

// Ingresos: lista del día + total. El total lo calcula el servidor.
export default function Ingresos() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const [items, setItems] = useState<Income[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { from, to } = dayRange(selectedDate);
      const [l, s] = await Promise.all([listIncomes(from, to), financeSummary(from, to)]);
      setItems(l.incomes);
      setTotal(l.total);
      setCount(s.incomesCount);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [selectedDate]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Volver">
          <Text style={s.backTxt}>‹</Text>
        </Pressable>
        <Text style={s.title}>Ingresos</Text>
        <Pressable onPress={() => router.push('/ingreso')} style={s.add} accessibilityLabel="Registrar ingreso">
          <Text style={s.addTxt}>+</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Card style={s.sum}>
          <Text style={s.sumLabel}>Total del día · {count} registro(s)</Text>
          <Text style={s.sumNum}>{formatMoney(total)}</Text>
        </Card>
        {error ? <Text style={s.error}>{error}</Text> : null}
        {items.map((i) => (
          <Pressable key={i.id} onPress={() => router.push(`/ingreso?id=${i.id}`)} style={s.row}>
            <View style={s.badge}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>$</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{i.title}</Text>
              <Text style={s.sub}>
                {i.quantity} × {formatMoney(i.unitPrice)} · {i.payMethod}
                {i.client ? ` · ${i.client.firstName}` : ''}
              </Text>
            </View>
            <Text style={s.amount}>{formatMoney(i.total)}</Text>
          </Pressable>
        ))}
        {items.length === 0 && !error ? <Text style={s.empty}>Sin ingresos este día. Toca + para registrar.</Text> : null}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  back: { width: 40, paddingVertical: 6 },
  backTxt: { fontSize: 28, color: colors.text },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.text },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: colors.onAccent, fontSize: 26 },
  body: { padding: 16, paddingTop: 0 },
  sum: { alignItems: 'center', backgroundColor: colors.greenBg },
  sumLabel: { color: colors.muted, fontWeight: '700' },
  sumNum: { fontSize: 32, fontWeight: '900', color: colors.text },
  error: { color: colors.danger, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.muted },
  amount: { fontWeight: '900', color: colors.green, fontSize: 15 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 16 },
});
}
