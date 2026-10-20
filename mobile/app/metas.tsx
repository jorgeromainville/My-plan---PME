import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../src/components/Card';
import { ProgressBar } from '../src/components/ProgressBar';
import { errorMessage } from '../src/services/api';
import { goalsProgress, updateGoal, type Goal, type GoalPeriod } from '../src/services/goals';
import { colors, useThemedStyles, type ThemeColors } from '../src/theme/colors';
import { formatMoney } from '../src/utils/format';
import { Icon } from '../src/components/Icon';

const PERIODS: { v: GoalPeriod | 'all'; label: string }[] = [
  { v: 'all', label: 'Todas' },
  { v: 'day', label: 'Diarias' },
  { v: 'week', label: 'Semanales' },
  { v: 'month', label: 'Mensuales' },
];

function money(kind: string, v: number, unit: string): string {
  if (kind === 'ingresos') return formatMoney(v);
  return `${v} ${unit}`;
}

// Metas: progreso automático desde datos reales + historial.
export default function Metas() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();
  const [period, setPeriod] = useState<GoalPeriod | 'all'>('all');
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([goalsProgress(undefined, 'activa'), goalsProgress(undefined, 'completada')]);
      setGoals(tab === 'active' ? a : d);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [tab]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const shown = goals.filter((g) => period === 'all' || g.period === period);

  async function complete(g: Goal) {
    try {
      await updateGoal(g.id, { status: 'completada' });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Volver">
          <Icon name="chevronLeft" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Metas</Text>
        <Pressable onPress={() => router.push('/meta')} style={s.add} accessibilityLabel="Nueva meta">
          <Icon name="plus" size={24} color={colors.onAccent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.seg}>
          {PERIODS.map((p) => (
            <Pressable key={p.v} onPress={() => setPeriod(p.v)} style={[s.segOpt, period === p.v && s.segOn]}>
              <Text style={[s.segTxt, period === p.v && s.segTxtOn]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[s.seg, { marginTop: 8 }]}>
          <Pressable onPress={() => setTab('active')} style={[s.segOpt, tab === 'active' && s.segOn]}>
            <Text style={[s.segTxt, tab === 'active' && s.segTxtOn]}>Activas</Text>
          </Pressable>
          <Pressable onPress={() => setTab('done')} style={[s.segOpt, tab === 'done' && s.segOn]}>
            <Text style={[s.segTxt, tab === 'done' && s.segTxtOn]}>Historial</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {shown.map((g) => (
          <Pressable key={g.id} onPress={() => router.push(`/meta?id=${g.id}`)}>
            <Card style={s.card}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{g.title}</Text>
                  <Text style={s.sub}>
                    {g.kind} · {g.period === 'day' ? 'diaria' : g.period === 'week' ? 'semanal' : 'mensual'}
                    {g.status === 'pausada' ? ' · pausada' : ''}
                  </Text>
                </View>
                <Text style={s.pct}>{g.pct ?? 0}%</Text>
              </View>
              <ProgressBar value={g.pct ?? 0} color={g.pct === 100 ? colors.green : colors.primary} />
              <Text style={s.nums}>
                {money(g.kind, g.current, g.unit)} / {money(g.kind, g.target, g.unit)}
              </Text>
              {g.source ? <Text style={s.src}>De: {g.source}</Text> : null}
              <View style={s.rowBtns}>
                {tab === 'active' && g.status !== 'completada' && (g.pct ?? 0) >= 100 ? (
                  <Pressable onPress={() => complete(g)} style={[s.mini, s.done]}>
                    <View style={s.miniRow}>
                      <Icon name="check" size={14} color={colors.green} strokeWidth={3} />
                      <Text style={s.miniTxt}>Completar</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          </Pressable>
        ))}

        {shown.length === 0 && !error ? (
          <Text style={s.empty}>Sin metas aquí. Toca + para crear la primera.</Text>
        ) : null}
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
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: colors.onAccent, fontSize: 26 },
  body: { padding: 16, paddingTop: 0 },
  seg: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 99, padding: 4, marginBottom: 12 },
  segOpt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 99 },
  segOn: { backgroundColor: colors.card, elevation: 2 },
  segTxt: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  segTxtOn: { color: colors.text },
  error: { color: colors.danger, marginBottom: 8 },
  card: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { fontWeight: '800', color: colors.text, fontSize: 15 },
  sub: { fontSize: 12, color: colors.muted },
  pct: { fontWeight: '900', fontSize: 18, color: colors.text },
  nums: { marginTop: 8, fontWeight: '700', color: colors.text, fontSize: 13 },
  src: { marginTop: 4, fontSize: 12, color: colors.muted },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  mini: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.card },
  done: { backgroundColor: colors.greenBg, borderColor: colors.green },
  miniTxt: { fontWeight: '700', fontSize: 12, color: colors.text },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 16 },
});
}
