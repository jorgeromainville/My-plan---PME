import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../src/components/Card';
import { DateSelector } from '../../src/components/DateSelector';
import { ProgressBar } from '../../src/components/ProgressBar';
import { SectionHeader } from '../../src/components/SectionHeader';
import { dayRange, listTasks } from '../../src/services/tasks';
import { financeSummary, type FinanceSummary } from '../../src/services/incomes';
import { goalsProgress, type Goal } from '../../src/services/goals';
import { categoryIcon, listContacts, type Contact as ApiContact } from '../../src/services/contacts';
import { useAppStore } from '../../src/store/useAppStore';
import { useNet } from '../../src/store/useNet';
import { usePrefs } from '../../src/store/usePrefs';
import { useSession } from '../../src/store/useSession';
import { formatMoney } from '../../src/utils/format';
import { colors, radius, useThemedStyles, type ThemeColors } from '../../src/theme/colors';
import { pct } from '../../src/utils/format';

const bgByColor: Record<string, string> = {
  green: colors.greenBg,
  blue: colors.blueBg,
  yellow: colors.yellowBg,
  coral: colors.coralBg,
};

function goalBg(kind: string): string {
  if (kind === 'ingresos') return colors.greenBg;
  if (kind === 'contactos') return colors.blueBg;
  if (kind === 'tareas') return colors.yellowBg;
  if (kind === 'horas') return colors.coralBg;
  return colors.purpleBg;
}

function goalIcon(kind: string): string {
  if (kind === 'ingresos') return '💰';
  if (kind === 'contactos') return '👥';
  if (kind === 'tareas') return '✅';
  if (kind === 'horas') return '⏱️';
  if (kind === 'veces') return '🔁';
  return '🎯';
}

function goalVal(kind: string, v: number): string {
  if (kind === 'ingresos') return formatMoney(v);
  return String(Math.round(v * 100) / 100);
}

export default function Inicio() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { userName, selectedDate, setSelectedDate, dailyGoals, weeklyMain, weeklyGoals, contacts: demoPeople } =
    useAppStore();
  const demoCleared = usePrefs((s) => s.demoCleared);
  const offline = useNet((s) => s.offline);
  const sessionName = useSession((s) => s.userName);
  const token = useSession((s) => s.token);
  const [doneToday, setDoneToday] = useState<number | null>(null);
  const [fin, setFin] = useState<FinanceSummary | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [realGoals, setRealGoals] = useState<Goal[] | null>(null);
  const [realPeople, setRealPeople] = useState<ApiContact[] | null>(null);

  // Tareas/metas/personas reales del día (demo si no hay sesión o si está vacío).
  useFocusEffect(useCallback(() => {
    if (!token) {
      setDoneToday(null);
      setFin(null);
      setRealGoals(null);
      setRealPeople(null);
      return;
    }
    (async () => {
      try {
        const { from, to } = dayRange(selectedDate);
        const [tasks, summary, gl, cs] = await Promise.all([
          listTasks(from, to),
          financeSummary(from, to),
          goalsProgress(),
          listContacts().catch(() => [] as ApiContact[]),
        ]);
        setDoneToday(tasks.filter((t) => t.status === 'completada').length);
        setFin(summary);
        setRealGoals(gl);
        setRealPeople(cs);
      } catch {
        setDoneToday(null);
        setFin(null);
        setRealGoals(null);
        setRealPeople(null);
      }
    })();
  }, [token, selectedDate]));

  const goals = dailyGoals.map((g) =>
    g.title === 'Tareas' && doneToday !== null ? { ...g, current: doneToday } : g,
  );
  const shownName = token ? sessionName : userName;
  // Metas reales (si existen), si no demo.
  const dayGoals = realGoals && realGoals.some((g) => g.period === 'day') ? realGoals.filter((g) => g.period === 'day') : null;
  const weekGoals = realGoals && realGoals.some((g) => g.period === 'week') ? realGoals.filter((g) => g.period === 'week') : null;

  // Personas: reales > demo (si no se borraron) > vacío.
  const people =
    realPeople && realPeople.length > 0
      ? realPeople.slice(0, 5).map((c) => ({ id: c.id, name: c.firstName, badge: categoryIcon(c.category) }))
      : demoCleared
        ? []
        : demoPeople.slice(0, 5).map((c) => ({
            id: c.id,
            name: c.firstName,
            badge: c.badge === 'star' ? '★' : c.badge === 'check' ? '●' : '♡',
          }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text>🗓️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>Planner Today</Text>
            <Text style={styles.appSub}>Inicio</Text>
          </View>
          <Text style={styles.hIcon}>🔍</Text>
          <Text style={styles.hIcon}>🔔</Text>
          <Pressable onPress={() => router.push('/perfil')} accessibilityLabel="Abrir perfil" style={styles.avatar}>
            <Text>👤</Text>
          </Pressable>
        </View>

        <Text style={styles.hola}>¡Hola, {shownName}!</Text>
        <Text style={styles.sub}>Un gran día, hoy también cuentas ☀️</Text>
        {offline ? <Text style={styles.offline}>● Sin conexión · mostrando datos guardados</Text> : null}

        <DateSelector date={selectedDate} onChange={setSelectedDate} />

        {/* Resumen de hoy: ingresos vs gastos */}
        <Card style={styles.fin}>
          <Pressable onPress={() => router.push('/ingresos')} style={styles.finCol}>
            <Text style={styles.finLabel}>Ingresos hoy</Text>
            <Text style={[styles.finNum, { color: colors.green }]}>
              {fin ? formatMoney(fin.incomes) : '—'}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/gastos')} style={styles.finCol}>
            <Text style={styles.finLabel}>Gastos hoy</Text>
            <Text style={[styles.finNum, { color: colors.coral }]}>
              {fin ? formatMoney(fin.expenses) : '—'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setResultOpen(true)} style={styles.finCol}>
            <Text style={styles.finLabel}>Resultado</Text>
            <Text style={styles.finNum}>{fin ? `${fin.net >= 0 ? '+' : ''}${formatMoney(fin.net)}` : '—'}</Text>
          </Pressable>
        </Card>
        {resultOpen && fin ? (
          <Card style={styles.mt}>
            <Text style={styles.resT}>Hoy: {fin.incomesCount} ingreso(s), {fin.expensesCount} gasto(s)</Text>
            <View style={styles.resRow}>
              <Pressable onPress={() => { setResultOpen(false); router.push('/ingresos'); }} style={styles.resBtn}>
                <Text style={styles.resBtnTxt}>Ver ingresos</Text>
              </Pressable>
              <Pressable onPress={() => { setResultOpen(false); router.push('/gastos'); }} style={styles.resBtn}>
                <Text style={styles.resBtnTxt}>Ver gastos</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Metas diarias */}
        <Card style={styles.mt}>
          <SectionHeader
            title="Metas diarias"
            subtitle="Hoy es un gran paso"
            action={
              <Pressable onPress={() => router.push('/metas')}>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            }
          />
          <View style={styles.grid}>
            {dayGoals
              ? dayGoals.slice(0, 2).map((g) => (
                  <View key={g.id} style={[styles.goal, { backgroundColor: goalBg(g.kind) }]}>
                    <View style={styles.goalTop}>
                      <Text style={styles.goalIcon}>{goalIcon(g.kind)}</Text>
                      <Text style={styles.goalPct}>{g.pct ?? 0}%</Text>
                    </View>
                    <Text style={styles.goalName}>{g.title}</Text>
                    <Text style={styles.goalNum}>
                      {goalVal(g.kind, g.current)} <Text style={styles.goalTarget}>/ {goalVal(g.kind, g.target)}</Text>
                    </Text>
                  </View>
                ))
              : demoCleared ? (
                  <View style={[styles.empty, { flex: 1 }]}>
                    <Text style={styles.emptyTitle}>Sin metas diarias</Text>
                    <Text style={styles.emptySub}>Crea una meta y verás tu avance aquí.</Text>
                    <Pressable style={styles.emptyBtn} onPress={() => router.push('/metas')}>
                      <Text style={styles.emptyBtnTxt}>Crear metas</Text>
                    </Pressable>
                  </View>
                )
              : goals.slice(0, 2).map((g) => (
                  <View key={g.id} style={[styles.goal, { backgroundColor: bgByColor[g.color] ?? colors.bgSoft }]}>
                    <View style={styles.goalTop}>
                      <Text style={styles.goalIcon}>{g.icon}</Text>
                      <Text style={styles.goalPct}>{pct(g.current, g.target)}%</Text>
                    </View>
                    <Text style={styles.goalName}>{g.title}</Text>
                    <Text style={styles.goalNum}>
                      {g.current} <Text style={styles.goalTarget}>/ {g.target}</Text>
                    </Text>
                  </View>
                ))}
          </View>
        </Card>

        {/* Metas semanales */}
        <Card style={styles.mt}>
          <SectionHeader
            title="Metas semanales"
            subtitle="Seguimiento de la semana"
            action={
              <Pressable onPress={() => router.push('/metas')}>
                <Text style={styles.chev}>›</Text>
              </Pressable>
            }
          />
          {weekGoals ? (
            <>
              <View style={styles.weekRow}>
                <View style={styles.weekIcon}>
                  <Text>🎯</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weekTitle}>{weekGoals[0].title}</Text>
                  <Text style={styles.weekSub}>Meta semanal</Text>
                </View>
                <Text style={styles.weekNum}>
                  {goalVal(weekGoals[0].kind, weekGoals[0].current)}{' '}
                  <Text style={styles.goalTarget}>/ {goalVal(weekGoals[0].kind, weekGoals[0].target)}</Text>
                </Text>
              </View>
              <ProgressBar value={weekGoals[0].pct ?? 0} />
              <View style={styles.grid3}>
                {weekGoals.slice(1, 4).map((w) => (
                  <View key={w.id} style={styles.mini}>
                    <Text style={styles.miniCheck}>✓</Text>
                    <Text style={styles.miniName}>{w.title}</Text>
                    <Text style={styles.miniNum}>
                      {w.current}/{w.target}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : demoCleared ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Sin metas semanales</Text>
              <Text style={styles.emptySub}>Crea una meta semanal para seguir tu semana.</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/metas')}>
                <Text style={styles.emptyBtnTxt}>Crear metas</Text>
              </Pressable>
            </View>
          ) : (
            <>
          <View style={styles.weekRow}>
            <View style={styles.weekIcon}>
              <Text>🎯</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.weekTitle}>{weeklyMain.title}</Text>
              <Text style={styles.weekSub}>{weeklyMain.subtitle}</Text>
            </View>
            <Text style={styles.weekNum}>
              {weeklyMain.current} <Text style={styles.goalTarget}>/ {weeklyMain.target}</Text>
            </Text>
          </View>
          <ProgressBar value={pct(weeklyMain.current, weeklyMain.target)} />
          <View style={styles.grid3}>
            {weeklyGoals.map((w) => (
              <View key={w.id} style={styles.mini}>
                <Text style={styles.miniCheck}>✓</Text>
                <Text style={styles.miniName}>{w.title}</Text>
                <Text style={styles.miniNum}>
                  {w.current}/{w.target}
                </Text>
              </View>
            ))}
          </View>
            </>
          )}
        </Card>

        {/* Personas */}
        <View style={styles.mt}>
          <SectionHeader
            title="Personas"
            subtitle="Tus contactos más importantes"
            action={
              <Pressable onPress={() => router.push('/personas')}>
                <Text style={styles.verMas}>Ver más ›</Text>
              </Pressable>
            }
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
            {people.map((p) => (
              <Pressable key={p.id} style={styles.person} onPress={() => router.push('/personas')}>
                <View style={styles.face}>
                  <Text style={{ fontSize: 26 }}>👤</Text>
                  <View style={styles.badge}>
                    <Text style={{ fontSize: 10 }}>{p.badge}</Text>
                  </View>
                </View>
                <Text style={styles.pName}>{p.name}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.person} onPress={() => router.push('/persona')}>
              <View style={[styles.face, styles.addFace]}>
                <Text style={{ fontSize: 26, color: colors.muted }}>+</Text>
              </View>
              <Text style={styles.pName}>Añadir</Text>
            </Pressable>
          </ScrollView>
          {people.length === 0 ? (
            <Text style={styles.peopleEmpty}>
              {demoCleared ? 'Aún no tienes personas: añade la primera con +.' : 'Sin personas todavía.'}
            </Text>
          ) : null}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 17, fontWeight: '800', color: colors.text },
  appSub: { fontSize: 12, color: colors.muted },
  hIcon: { fontSize: 18, marginHorizontal: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  hola: { fontSize: 28, fontWeight: '900', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  mt: { marginTop: 14 },
  fin: { marginTop: 14, flexDirection: 'row' },
  finCol: { flex: 1, alignItems: 'center' },
  finLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  finNum: { fontSize: 18, fontWeight: '900', color: colors.text },
  resT: { fontWeight: '700', color: colors.text, marginBottom: 10 },
  resRow: { flexDirection: 'row', gap: 10 },
  resBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  resBtnTxt: { color: '#fff', fontWeight: '800' },
  chev: { fontSize: 24, color: colors.muted },
  grid: { flexDirection: 'row', gap: 10 },
  goal: { flex: 1, borderRadius: radius.md, padding: 12 },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalIcon: { fontSize: 20 },
  goalPct: { fontWeight: '800', color: colors.text },
  goalName: { marginTop: 8, fontSize: 13, color: colors.text },
  goalNum: { fontSize: 22, fontWeight: '900', color: colors.text },
  goalTarget: { fontSize: 14, fontWeight: '400', color: colors.muted },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  weekIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
  weekTitle: { fontWeight: '800', color: colors.text },
  weekSub: { color: colors.muted, fontSize: 12 },
  weekNum: { fontWeight: '900', fontSize: 18 },
  grid3: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mini: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  miniCheck: { fontSize: 12, backgroundColor: colors.greenBg, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  miniName: { fontSize: 11, textAlign: 'center', marginTop: 6, color: colors.text },
  miniNum: { fontWeight: '800', marginTop: 4 },
  verMas: { color: colors.accent, fontWeight: '700' },
  peopleRow: { flexDirection: 'row', gap: 12 },
  person: { alignItems: 'center', width: 64 },
  face: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
  addFace: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  badge: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.yellowBg, borderRadius: 99, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  pName: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.text },
  peopleEmpty: { fontSize: 12, color: colors.muted, marginTop: 8 },
  offline: { fontSize: 12, color: colors.danger, fontWeight: '700', marginBottom: 8 },
  empty: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 10 },
  emptyBtn: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
}
