import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useThemedStyles, type ThemeColors } from '../theme/colors';
import { addDays, formatLongEs } from '../utils/dates';

export function DateSelector({
  date,
  onChange,
}: {
  date: Date;
  onChange: (d: Date) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>📅</Text>
      <Text style={styles.label}>{formatLongEs(date)}</Text>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityLabel="Día anterior"
        onPress={() => onChange(addDays(date, -1))}
        style={styles.arrow}
      >
        <Text style={styles.arrowTxt}>‹</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Día siguiente"
        onPress={() => onChange(addDays(date, 1))}
        style={styles.arrow}
      >
        <Text style={styles.arrowTxt}>›</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: { fontSize: 18, marginRight: 8 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  arrow: { paddingHorizontal: 12, paddingVertical: 4 },
  arrowTxt: { fontSize: 22, color: colors.muted, fontWeight: '700' },
});
}
