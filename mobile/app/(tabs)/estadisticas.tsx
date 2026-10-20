import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../src/components/Card';
import { errorMessage } from '../../src/services/api';
import { expensesByCategory, statsOverview, type ExpenseSlice, type Overview, type StatPeriod } from '../../src/services/stats';
import { colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';
import { toLocalKey } from '../../src/utils/dates';
import { formatMoney } from '../../src/utils/format';

const PERIODS: { v: StatPeriod; label: string }[] = [
  { v: 'day', label: 'Día' },
  { v: 'week', label: 'Semana' },
  { v: 'month', label: 'Mes' },
];

const SLICE_COLORS = ['#D98162', '#C9A44A', '#6B9ECF', '#6FA287', '#8B7BC7', '#E07A5F'];

// Estadísticas reales: resumen + ingresos vs gastos + dona por categoría + productividad.
export default function Estadisticas() {
  const s = useThemedStyles(createStyles);
  const [period, setPeriod] = useState<StatPeriod>('day');
  const [ov, setOv] = useState<Overview | null>(null);
  const [cats, setCats] = useState<ExpenseSlice[]>([]);
  const [catTotal, setCatTotal] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([statsOverview(period), expensesByCategory(period)]);
      setOv(o);
      setCats(c.categories);
      setCatTotal(c.total);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [period]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const maxBar = ov ? Math.max(ov.incomes, ov.expenses, 1) : 1;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Estadísticas</Text>

        <View style={s.seg}>
          {PERIODS.map((p) => (
            <Pressable key={p.v} onPress={() => setPeriod(p.v)} style={[s.segOpt, period === p.v && s.segOn]}>
              <Text style={[s.segTxt, period === p.v && s.segTxtOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Card>
          <Text style={s.h}>Resumen del {period === 'day' ? 'día' : period === 'week' ? 'semana' : 'mes'}</Text>
          <View style={s.grid}>
            <Mini label="Ingresos" value={ov ? formatMoney(ov.incomes) : '—'} color={colors.green} />
            <Mini label="Gastos" value={ov ? formatMoney(ov.expenses) : '—'} color={colors.coral} />
            <Mini label="Tareas" value={ov ? `${ov.tasksDone}/${ov.tasksTotal}` : '—'} />
            <Mini label="Eventos" value={ov ? String(ov.events) : '—'} />
            <Mini label="Contactos" value={ov ? String(ov.contacts) : '—'} />
            <Mini label="Horas" value={ov ? `${ov.hours}h` : '—'} />
          </View>
        </Card>

        <Card>
          <View style={s.rowBetween}>
            <Text style={s.h}>Ingresos vs Gastos</Text>
            <Text style={[s.net, ov && ov.net < 0 && s.netNeg]}>
              {ov ? `${ov.net >= 0 ? '+' : ''}${formatMoney(ov.net)}` : '—'}
            </Text>
          </View>
          <Bar label="Ingresos" value={ov?.incomes ?? 0} max={maxBar} color={colors.green} money />
          <Bar label="Gastos" value={ov?.expenses ?? 0} max={maxBar} color={colors.coral} money />
        </Card>

        <Card>
          <Text style={s.h}>Categorías de gastos {catTotal > 0 ? `· ${formatMoney(catTotal)}` : ''}</Text>
          {cats.length === 0 ? (
            <Text style={s.empty}>Sin gastos en este período.</Text>
          ) : (
            <>
              <Donut slices={cats} />
              {cats.map((c, i) => (
                <View key={c.name} style={s.catRow}>
                  <View style={[s.dot, { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }]} />
                  <Text style={s.catName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.catVal}>
                    {c.pct}% ({formatMoney(c.amount)})
                  </Text>
                </View>
              ))}
            </>
          )}
        </Card>

        <Card>
          <Text style={s.h}>Productividad</Text>
          <Text style={s.score}>{ov ? `${ov.productivity}%` : '—'}</Text>
          <Text style={s.explain}>
            {ov
              ? `${ov.tasksDone}/${ov.tasksTotal} tareas · ${ov.goalsDone} metas · ${ov.hours}h · ${ov.events} eventos`
              : 'Sin datos'}
          </Text>
          <Text style={s.dates}>Del {ov ? toLocalKey(new Date(ov.from)) : '—'} al {ov ? toLocalKey(new Date(ov.to)) : '—'}</Text>
        </Card>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const s = useThemedStyles(createStyles);
  return (
    <View style={s.mini}>
      <Text style={s.miniLabel}>{label}</Text>
      <Text style={[s.miniVal, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Bar({ label, value, max, color, money }: { label: string; value: number; max: number; color: string; money?: boolean }) {
  const s = useThemedStyles(createStyles);
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.round((value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.barVal}>{money ? formatMoney(value) : value}</Text>
    </View>
  );
}

// Dona con Views: anillo por rebanadas proporcionales (sin librerías).
function Donut({ slices }: { slices: ExpenseSlice[] }) {
  const s = useThemedStyles(createStyles);
  const total = slices.reduce((s, x) => s + x.pct, 0) || 1;
  let acc = 0;
  const segs = slices.map((sl, i) => {
    const from = (acc / total) * 360;
    acc += sl.pct;
    const to = (acc / total) * 360;
    return { from, to, color: SLICE_COLORS[i % SLICE_COLORS.length], key: sl.name };
  });
  // Anillo simple: círculo base + rebanadas como bordes gruesos rotados no es trivial
  // sin SVG; se muestra barra apilada 100% que comunica lo mismo.
  return (
    <View style={s.stack}>
      {segs.map((g) => (
        <View key={g.key} style={[s.slice, { flex: Math.max(g.to - g.from, 1), backgroundColor: g.color }]} />
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: 12 },
  seg: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 99, padding: 4, marginBottom: 12 },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 99 },
  segOn: { backgroundColor: colors.coral, elevation: 2 },
  segTxt: { fontWeight: '700', color: colors.muted, fontSize: 13 },
  segTxtOn: { color: '#fff' },
  error: { color: colors.danger, marginBottom: 8 },
  h: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mini: { width: '31%', backgroundColor: colors.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.line },
  miniLabel: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  miniVal: { fontSize: 15, fontWeight: '900', color: colors.text },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  net: { fontWeight: '900', color: colors.green, fontSize: 16 },
  netNeg: { color: colors.danger },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 64, fontSize: 12, fontWeight: '700', color: colors.text },
  barTrack: { flex: 1, height: 22, backgroundColor: colors.bgSoft, borderRadius: 11, overflow: 'hidden' },
  barFill: { height: 22, borderRadius: 11 },
  barVal: { width: 76, fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'right' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  catName: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 13 },
  catVal: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted },
  stack: { flexDirection: 'row', height: 22, borderRadius: 11, overflow: 'hidden', marginBottom: 10 },
  slice: { height: 22 },
  score: { fontSize: 44, fontWeight: '900', color: colors.text },
  explain: { color: colors.muted, marginTop: 4, fontSize: 13 },
  dates: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
}
