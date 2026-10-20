import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';

export function ProgressBar({ value, color = colors.text }: { value: number; color?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  track: { height: 8, backgroundColor: colors.line, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99 },
});
}
