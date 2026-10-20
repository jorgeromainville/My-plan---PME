import React, { useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { usePrefs } from '../store/usePrefs';
import { andeanColors } from '../theme/colors';

// Cruz andina (chakana) de brazos escalonados.
const CHAKANA =
  'M40 6 H60 V20 H70 V30 H80 V40 H94 V60 H80 V70 H70 V80 H60 V94 H40 V80 H30 V70 H20 V60 H6 V40 H20 V30 H30 V20 H40 Z';

// Rombo escalonado, el motivo que más se repite en los tejidos.
const STEPPED_DIAMOND =
  'M36 4 L46 14 L56 14 L56 24 L66 24 L66 44 L56 44 L56 54 L46 54 L36 64 L26 54 L16 54 L16 44 L6 44 L6 24 L16 24 L16 14 L26 14 Z';

function cleanId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function Chakana({
  size = 20,
  color = andeanColors.primary,
  filled = false,
  style,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <Path
        d={CHAKANA}
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={filled ? 0 : 9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Banda de rombos alternados: el borde tejido de una manta.
export function AndeanBand({ height = 7, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const raw = useId();
  const id = `band-${cleanId(raw)}`;
  const w = 18;
  const mid = height / 2;

  return (
    <Svg width="100%" height={height} style={style}>
      <Defs>
        <Pattern id={id} width={w} height={height} patternUnits="userSpaceOnUse">
          <Rect width={w} height={height} fill={andeanColors.yellow} />
          <Path d={`M0 ${mid} L4.5 1 L9 ${mid} L4.5 ${height - 1} Z`} fill={andeanColors.primary} />
          <Path d={`M9 ${mid} L13.5 1 L18 ${mid} L13.5 ${height - 1} Z`} fill={andeanColors.blue} />
          <Rect y={height - 1} width={w} height={1} fill={andeanColors.purple} opacity={0.55} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// Trama sutil de rombos escalonados + chakana para el interior de las tarjetas.
export function AndeanCardPattern({ opacity = 0.18 }: { opacity?: number }) {
  const raw = useId();
  const id = `weave-${cleanId(raw)}`;

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={id} width={72} height={72} patternUnits="userSpaceOnUse">
          <Path
            d={STEPPED_DIAMOND}
            fill="none"
            stroke={andeanColors.primary}
            strokeWidth={1.15}
            opacity={opacity}
          />
          <Path
            d="M36 22 L50 36 L36 50 L22 36 Z"
            fill="none"
            stroke={andeanColors.blue}
            strokeWidth={1}
            opacity={opacity * 0.75}
          />
          <Circle cx={36} cy={36} r={2.2} fill={andeanColors.primary} opacity={opacity * 0.9} />
          <Circle cx={0} cy={0} r={1.8} fill={andeanColors.blue} opacity={opacity * 0.7} />
          <Circle cx={72} cy={72} r={1.8} fill={andeanColors.primary} opacity={opacity * 0.7} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// Banda superior que solo aparece con el tema Típico.
export function AndeanTopBand({ height = 6 }: { height?: number }) {
  const theme = usePrefs((s) => s.theme);
  if (theme !== 'andean') return null;
  return (
    <View pointerEvents="none">
      <AndeanBand height={height} />
    </View>
  );
}
