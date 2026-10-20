import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';

// Barra "Deshacer" 8s como la referencia: revierte el último movimiento.
export function UndoBar({ message, onUndo, onDone }: {
  message: string;
  onUndo: () => void;
  onDone: () => void;
}) {
  const s = useThemedStyles(createStyles);
  const [left, setLeft] = useState(8);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <View style={s.bar}>
      <Text style={s.msg}>
        {message} · {left}s
      </Text>
      <Pressable onPress={onUndo} accessibilityLabel="Deshacer movimiento">
        <Text style={s.undo}>Deshacer</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  msg: { color: colors.onPrimary, flex: 1, fontWeight: '600' },
  undo: { color: colors.onPrimary, textDecorationLine: 'underline', fontWeight: '800' },
});
}
