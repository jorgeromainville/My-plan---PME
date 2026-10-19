import { Tabs, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rescheduleReminders } from '../../src/services/reminders';
import { colors } from '../../src/theme/colors';

function CenterButton() {
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
  // Reprograma avisos al volver a la app (con throttle interno de 15 min).
  useFocusEffect(useCallback(() => {
    rescheduleReminders().catch(() => {});
  }, []));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: () => <Text>⊞</Text> }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: () => <Text>◎</Text> }} />
      <Tabs.Screen
        name="plus"
        options={{
          title: '',
          tabBarButton: () => <CenterButton />,
        }}
      />
      <Tabs.Screen name="planificador" options={{ title: 'Planificador', tabBarIcon: () => <Text>📅</Text> }} />
      <Tabs.Screen name="estadisticas" options={{ title: 'Estadísticas', tabBarIcon: () => <Text>📈</Text> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFDF8',
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
});
