import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePrefs } from '../store/usePrefs';
import { colors, radius, useThemedStyles, type ThemeColors } from '../theme/colors';
import { Chakana } from './AndeanMotifs';

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = usePrefs((s) => s.theme);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          {theme === 'andean' ? <Chakana size={15} /> : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
}
