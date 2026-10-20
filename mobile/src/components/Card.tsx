import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, useThemedStyles, type ThemeColors } from '../theme/colors';

// Tarjeta blanca reutilizable: fondo, bordes redondeados, sombra suave.
export function Card({ children, style, ...rest }: ViewProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.card, style]} {...rest}>
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
});
}
