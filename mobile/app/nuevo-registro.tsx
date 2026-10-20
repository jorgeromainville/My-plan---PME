import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, useThemedStyles, type ThemeColors } from '../src/theme/colors';

const OPTIONS = [
  { key: 'persona', icon: '👤', bg: colors.blueBg, title: 'Persona', sub: 'Añadir contacto' },
  { key: 'venta', icon: '$', bg: '#CDEAC0', title: 'Ingreso', sub: 'Registrar ingreso' },
  { key: 'gasto', icon: '🧾', bg: colors.coralBg, title: 'Gasto', sub: 'Registrar gasto' },
  { key: 'lugar', icon: '📍', bg: colors.purpleBg, title: 'Lugar', sub: 'Añadir lugar' },
  { key: 'tarea', icon: '✓', bg: '#CDEAC0', title: 'Tarea', sub: 'Nueva tarea' },
  { key: 'evento', icon: '📅', bg: colors.purpleBg, title: 'Evento', sub: 'Nuevo evento' },
  { key: 'meta', icon: '🎯', bg: colors.yellowBg, title: 'Meta', sub: 'Nueva meta' },
  { key: 'escaner', icon: '📷', bg: colors.blueBg, title: 'Escanear', sub: 'Horario a eventos' },
];

export default function NuevoRegistro() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();

  function go(key: string) {
    if (key === 'persona') return router.push('/persona');
    if (key === 'tarea') return router.push('/tarea');
    if (key === 'evento') return router.push('/evento');
    if (key === 'venta') return router.push('/ingreso');
    if (key === 'gasto') return router.push('/gasto');
    if (key === 'meta') return router.push('/meta');
    if (key === 'lugar') return router.push('/lugar');
    if (key === 'escaner') return router.push('/escaner');
  }
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver">
          <Text style={s.back}>←</Text>
        </Pressable>
        <Text style={s.title}>Nuevo Registro</Text>
        <View style={s.avatar}>
          <Text>👤</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.row}>
          <Text style={s.q}>¿Qué deseas agregar?</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cerrar">
            <Text style={s.x}>✕</Text>
          </Pressable>
        </View>
        <Text style={s.sub}>Elige una opción para continuar</Text>
        <View style={s.grid}>
          {OPTIONS.map((o) => (
            <Pressable key={o.key} style={s.card} accessibilityLabel={o.title} onPress={() => go(o.key)}>
              <View style={[s.circle, { backgroundColor: o.bg }]}>
                <Text style={s.icon}>{o.icon}</Text>
              </View>
              <Text style={s.cardTitle}>{o.title}</Text>
              <Text style={s.cardSub}>{o.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: colors.card },
  back: { fontSize: 22 },
  title: { fontSize: 18, fontWeight: '800', flex: 1, color: colors.text },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#0F5B6B', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  q: { fontSize: 22, fontWeight: '900', color: colors.text },
  x: { fontSize: 20, color: colors.text },
  sub: { color: colors.muted, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, alignItems: 'center' },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  icon: { fontSize: 26 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
}
