import { Tabs, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AndeanBand } from '../../src/components/AndeanMotifs';
import { rescheduleReminders } from '../../src/services/reminders';
import { usePrefs } from '../../src/store/usePrefs';
import { colors, useThemedStyles, type ThemeColors } from '../../src/theme/colors';

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
        tabBarBackground:
          theme === 'andean'
            ? () => (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  <AndeanBand height={7} />
                </View>
              )
            : undefined,
        tabBarActiveTintColor: colors.primary,
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
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  plusTxt: { color: colors.onPrimary, fontSize: 34, lineHeight: 34, fontWeight: '400' },
  tabIcon: { fontSize: 20 },
});
}
