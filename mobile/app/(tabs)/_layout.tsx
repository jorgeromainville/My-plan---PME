import { Tabs, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rescheduleReminders } from '../../src/services/reminders';
import { usePrefs } from '../../src/store/usePrefs';
import { andeanColors, colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';

// Banda tejida del tema "Típico": franjas y rombos como en los textiles.
const BAND = [
  andeanColors.primary,
  andeanColors.yellow,
  andeanColors.blue,
  andeanColors.bg,
  andeanColors.green,
  andeanColors.purple,
];

function TextileBand() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ flexDirection: 'row', height: 5 }}>
        {Array.from({ length: 48 }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: BAND[i % BAND.length] }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', height: 2, opacity: 0.55 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: BAND[(i + 3) % BAND.length] }} />
        ))}
      </View>
    </View>
  );
}

function CenterButton() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Nuevo registro"
      accessibilityRole="button"
      onPress={() => router.push('/nuevo-registro')}
      style={styles.plus}
    >
      <Text style={styles.plusTxt}>+</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const styles = useThemedStyles(createStyles);
  const theme = usePrefs((s) => s.theme);
  // Reprograma avisos al volver a la app (con throttle interno de 15 min).
  useFocusEffect(useCallback(() => {
    rescheduleReminders().catch(() => {});
  }, []));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarBackground: theme === 'andean' ? () => <TextileBand /> : undefined,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: () => <Text style={styles.tabIcon}>🏠</Text> }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: () => <Text style={styles.tabIcon}>🗺️</Text> }} />
      <Tabs.Screen
        name="plus"
        options={{
          title: '',
          tabBarButton: () => <CenterButton />,
        }}
      />
      <Tabs.Screen name="planificador" options={{ title: 'Planificador', tabBarIcon: () => <Text style={styles.tabIcon}>📅</Text> }} />
      <Tabs.Screen name="estadisticas" options={{ title: 'Estadísticas', tabBarIcon: () => <Text style={styles.tabIcon}>📈</Text> }} />
    </Tabs>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    height: 78,
    paddingBottom: 14,
    paddingTop: 8,
  },
  plus: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  plusTxt: { color: '#fff', fontSize: 34, lineHeight: 34, fontWeight: '400' },
  tabIcon: { fontSize: 20 },
});
}
