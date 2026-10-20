import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AndeanTopBand } from '../src/components/AndeanMotifs';
import { Icon } from '../src/components/Icon';
import { colors, radius, useThemedStyles, type ThemeColors } from '../src/theme/colors';

export default function NuevoRegistro() {
  const s = useThemedStyles(createStyles);
  const router = useRouter();

  // Se define dentro del render para que los fondos sigan el tema activo.
  const options = [
    { key: 'persona', icon: 'user', bg: colors.blueBg, title: 'Persona', sub: 'Añadir contacto' },
    { key: 'venta', icon: 'money', bg: colors.greenBg, title: 'Ingreso', sub: 'Registrar ingreso' },
    { key: 'gasto', icon: 'receipt', bg: colors.coralBg, title: 'Gasto', sub: 'Registrar gasto' },
    { key: 'lugar', icon: 'mapPin', bg: colors.slateBg, title: 'Lugar', sub: 'Añadir lugar' },
    { key: 'tarea', icon: 'checkSquare', bg: colors.greenBg, title: 'Tarea', sub: 'Nueva tarea' },
    { key: 'evento', icon: 'calendar', bg: colors.slateBg, title: 'Evento', sub: 'Nuevo evento' },
    { key: 'meta', icon: 'target', bg: colors.yellowBg, title: 'Meta', sub: 'Nueva meta' },
    { key: 'escaner', icon: 'scan', bg: colors.blueBg, title: 'Escanear', sub: 'Horario a eventos' },
  ];

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
      <AndeanTopBand />
      <View style={s.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Volver">
          <Icon name="arrowLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Nuevo Registro</Text>
        <View style={s.avatar}>
          <Icon name="user" size={18} color={colors.onAccent} />
        </View>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.row}>
          <Text style={s.q}>¿Qué deseas agregar?</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cerrar">
            <Icon name="x" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Text style={s.sub}>Elige una opción para continuar</Text>
        <View style={s.grid}>
          {options.map((o) => (
            <Pressable key={o.key} style={s.card} accessibilityLabel={o.title} onPress={() => go(o.key)}>
              <View style={[s.circle, { backgroundColor: o.bg }]}>
                <Icon name={o.icon} size={26} color={colors.text} />
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
  title: { fontSize: 18, fontWeight: '800', flex: 1, color: colors.text },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  q: { fontSize: 22, fontWeight: '900', color: colors.text },
  sub: { color: colors.muted, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, alignItems: 'center' },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
}
