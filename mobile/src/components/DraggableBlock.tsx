import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, useThemedStyles, type ThemeColors } from '../theme/colors';
import { HOUR_H, type PlacedBlock } from './DayAgenda';
import { Icon } from './Icon';

export interface DropResult {
  dayDelta: number; // -1, 0, +1
  minDelta: number; // múltiplo de 30
}

// Bloque JS puro: tap abre, mantener 450ms arma el drag.
// Salvavidas: terminate y soltar sin mover siempre limpian el estado.
export function DraggableBlock({
  block,
  onPress,
  onToggle,
  onDragStart,
  onDragEnd,
  disabled,
  zoom = 1,
}: {
  block: PlacedBlock;
  onPress: () => void;
  onToggle?: () => void;
  onDragStart: () => void;
  onDragEnd: (r: DropResult) => void;
  disabled?: boolean;
  zoom?: number;
}) {
  const s = useThemedStyles(createStyles);
  const pan = useRef(new Animated.ValueXY()).current;
  const [lifting, setLifting] = useState(false);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stuck = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ dx: 0, dy: 0 });
  const cb = useRef({ onDragStart, onDragEnd, onPress, zoom });
  cb.current = { onDragStart, onDragEnd, onPress, zoom };

  function cancel() {
    active.current = false;
    setLifting(false);
    pan.setValue({ x: 0, y: 0 });
    last.current = { dx: 0, dy: 0 };
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        active.current && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderGrant: () => {
        if (!active.current) return;
        pan.setOffset({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, g) => {
        last.current = { dx: g.dx, dy: g.dy };
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: () => {
        if (!active.current) return;
        if (stuck.current) {
          clearTimeout(stuck.current);
          stuck.current = null;
        }
        const { dx, dy } = last.current;
        const z = cb.current.zoom;
        const dayDelta = dx > 70 ? 1 : dx < -70 ? -1 : 0;
        const minDelta = Math.round(dy / ((HOUR_H * z) / 2)) * 30;
        cancel();
        cb.current.onDragEnd({ dayDelta, minDelta });
      },
      // Salvavidas: si el sistema corta el gesto, todo vuelve a su lugar.
      onPanResponderTerminate: () => {
        cancel();
        cb.current.onDragEnd({ dayDelta: 0, minDelta: 0 });
      },
    }),
  ).current;

  function pressIn() {
    if (disabled) return;
    timer.current = setTimeout(() => {
      active.current = true;
      setLifting(true);
      cb.current.onDragStart();
      // Salvavidas: si queda levantado más de 4s sin moverse, se suelta solo.
      stuck.current = setTimeout(() => {
        if (active.current && last.current.dx === 0 && last.current.dy === 0) {
          cancel();
          cb.current.onDragEnd({ dayDelta: 0, minDelta: 0 });
        }
      }, 4000);
    }, 450);
  }

  function pressOut() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (stuck.current) {
      clearTimeout(stuck.current);
      stuck.current = null;
    }
    // Si se soltó sin arrastrar, asegura estado limpio.
    if (active.current && last.current.dx === 0 && last.current.dy === 0) {
      cancel();
    }
  }

  return (
    <Animated.View
      {...(disabled ? {} : responder.panHandlers)}
      style={[
        s.wrap,
        {
          top: block.top,
          height: block.height,
          left: `${block.leftPct}%` as never,
          width: `${block.widthPct}%` as never,
          transform: pan.getTranslateTransform(),
          zIndex: lifting ? 10 : 1,
          opacity: lifting ? 0.92 : 1,
        },
      ]}
    >
      <Pressable
        onPress={() => cb.current.onPress()}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          s.block,
          { backgroundColor: block.bg },
          block.isBackup && s.backup,
          lifting && s.lifting,
        ]}
      >
        <Icon name={block.icon} size={16} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={2}>
            {block.title}
          </Text>
          <Text style={s.sub} numberOfLines={1}>
            {block.timeLabel}
          </Text>
        </View>
        {onToggle ? (
          <Pressable onPress={onToggle} style={s.check} accessibilityLabel="Completar">
            {block.status === 'completada' ? (
              <Icon name="check" size={13} color={colors.green} strokeWidth={3} />
            ) : null}
          </Pressable>
        ) : null}
      </Pressable>
      {lifting ? <Text style={s.hint}>Suelta para mover · ↔ cambia día</Text> : null}
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: { position: 'absolute', paddingRight: 4 },
  block: {
    flex: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  lifting: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  backup: {
    opacity: 0.62,
    borderStyle: 'dashed',
  },
  title: { fontWeight: '800', color: colors.text, fontSize: 13 },
  sub: { fontSize: 11, color: colors.muted },
  check: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  },
  hint: { fontSize: 10, color: colors.muted, marginTop: 2 },
});
}
