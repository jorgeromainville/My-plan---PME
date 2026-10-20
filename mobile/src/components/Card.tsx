import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { usePrefs } from '../store/usePrefs';
import { colors, radius, useThemedStyles, type ThemeColors } from '../theme/colors';
import { AndeanCardPattern } from './AndeanMotifs';

// Tarjeta blanca reutilizable: fondo, bordes redondeados, sombra suave.
export function Card({ children, style, ...rest }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  const theme = usePrefs((s) => s.theme);
  return (
    <View style={[styles.card, style]} {...rest}>
      {theme === 'andean' ? (
        <View pointerEvents="none" style={styles.pattern}>
          <AndeanCardPattern />
        </View>
      ) : null}
      {theme === 'dark' ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.055)', 'rgba(255,255,255,0)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.pattern}
        />
      ) : null}
      {children}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
}
