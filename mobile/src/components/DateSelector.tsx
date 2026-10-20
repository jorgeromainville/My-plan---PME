import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, useThemedStyles, type ThemeColors } from '../theme/colors';
import { addDays, formatLongEs } from '../utils/dates';
import { Icon } from './Icon';

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
      <Icon name="calendar" size={18} color={colors.text} style={styles.icon} />
      <Text style={styles.label}>{formatLongEs(date)}</Text>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityLabel="Día anterior"
        onPress={() => onChange(addDays(date, -1))}
        style={styles.arrow}
      >
        <Icon name="chevronLeft" size={20} color={colors.muted} />
      </Pressable>
      <Pressable
        accessibilityLabel="Día siguiente"
        onPress={() => onChange(addDays(date, 1))}
        style={styles.arrow}
      >
        <Icon name="chevronRight" size={20} color={colors.muted} />
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
  icon: { marginRight: 8 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  arrow: { paddingHorizontal: 12, paddingVertical: 4 },
});
}
