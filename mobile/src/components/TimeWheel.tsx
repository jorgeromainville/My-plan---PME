import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';

const ROW_H = 44;

function Wheel({ items, selected, onPick }: {
  items: string[];
  selected: string;
  onPick: (v: string) => void;
}) {
  const s = useThemedStyles(createStyles);
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, items.indexOf(selected));
  useEffect(() => {
    ref.current?.scrollTo({ y: idx * ROW_H, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <ScrollView
      ref={ref}
      style={s.wheel}
      contentContainerStyle={{ paddingVertical: ROW_H }}
      snapToInterval={ROW_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      onMomentumScrollEnd={(e) => {
        const i = Math.round(e.nativeEvent.contentOffset.y / ROW_H);
        const v = items[Math.min(items.length - 1, Math.max(0, i))];
        if (v && v !== selected) onPick(v);
      }}
    >
      {items.map((item) => (
        <Pressable key={item} onPress={() => onPick(item)} style={s.row}>
          <Text style={[s.txt, item === selected && s.sel]}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function split(v: string): [string, string] {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return ['12', '00'];
  // redondea minutos al paso de 5
  const mm = String(Math.round(Number(m[2]) / 5) * 5 % 60).padStart(2, '0');
  return [m[1], mm];
}

// Rueda HH:MM sin teclado. Toca o desliza para elegir.
export function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const s = useThemedStyles(createStyles);
  const [h, m] = split(value);
  return (
    <View style={s.box}>
      <Wheel items={HOURS} selected={h} onPick={(nh) => onChange(`${nh}:${m}`)} />
      <Text style={s.colon}>:</Text>
      <Wheel items={MINS} selected={m} onPick={(nm) => onChange(`${h}:${nm}`)} />
      <View style={s.steps}>
        <Pressable onPress={() => onChange(shift(value, -30))} style={s.step} accessibilityLabel="Restar 30 minutos">
          <Text style={s.stepTxt}>−30</Text>
        </Pressable>
        <Pressable onPress={() => onChange(shift(value, 30))} style={s.step} accessibilityLabel="Sumar 30 minutos">
          <Text style={s.stepTxt}>+30</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Chips de duración: calculan el fin desde el inicio.
export function DurationChips({ start, onPick }: { start: string; onPick: (end: string) => void }) {
  const s = useThemedStyles(createStyles);
  const opts = [
    { label: '30m', mins: 30 },
    { label: '1h', mins: 60 },
    { label: '1h30', mins: 90 },
    { label: '2h', mins: 120 },
  ];
  return (
    <View style={s.chips}>
      {opts.map((o) => (
        <Pressable key={o.label} onPress={() => onPick(shift(start, o.mins))} style={s.chip}>
          <Text style={s.chipTxt}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function shift(hhmm: string, mins: number): string {
  const [h, m] = split(hhmm).map(Number);
  const t = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12 },
  wheel: { height: ROW_H * 3, width: 64 },
  row: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  txt: { fontSize: 17, color: colors.muted, fontWeight: '600' },
  sel: { fontSize: 21, color: colors.text, fontWeight: '900' },
  colon: { fontSize: 22, fontWeight: '900', color: colors.text },
  steps: { marginLeft: 8, gap: 8 },
  step: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  stepTxt: { fontWeight: '800', color: colors.text, fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card },
  chipTxt: { fontWeight: '700', color: colors.text, fontSize: 12 },
});
}
