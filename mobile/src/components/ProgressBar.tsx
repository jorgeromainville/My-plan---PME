import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function ProgressBar({ value, color = colors.text }: { value: number; color?: string }) {
  return (
    <View style={styles.track} accessibilityRole="progressbar">
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: '#EDE6D6', borderRadius: 99, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 99 },
});
