import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { usePrefs } from '../store/usePrefs';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';
import { parseLocalDay, formatShortEs } from '../utils/dates';

// Selector de hora nativo del sistema (cero bugs, respeta 12/24h).
export function NativeTime({ value, onChange, label }: {
  value: string; // "HH:MM"
  onChange: (v: string) => void;
  label: string;
}) {
  const s = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const prefs = usePrefs();
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.btn} accessibilityLabel={label}>
        <Text style={s.txt}>🕐 {value || '--:--'}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={d}
          mode="time"
          is24Hour={prefs.hourFormat === '24h'}
          onValueChange={(_e, nd) => {
            setOpen(false);
            onChange(
              `${String(nd.getHours()).padStart(2, '0')}:${String(nd.getMinutes()).padStart(2, '0')}`,
            );
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  btn: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  txt: { fontWeight: '800', color: colors.text, fontSize: 16 },
});
}

// Selector de fecha nativo (para "repetir hasta").
export function NativeDate({ value, onChange, label, placeholder = 'Elegir fecha' }: {
  value: string; // "AAAA-MM-DD" o ''
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  const s = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const d = parseLocalDay(value) ?? new Date();

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={s.btn} accessibilityLabel={label}>
        <Text style={s.txt}>📅 {value ? formatShortEs(d) : placeholder}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={d}
          mode="date"
          onValueChange={(_e, nd) => {
            setOpen(false);
            onChange(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
