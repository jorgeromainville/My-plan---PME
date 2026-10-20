import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../store/usePrefs';

// Paletas de la app. Tres estilos + automático:
// - Claro: fondos cálidos crema, tarjetas blancas.
// - Oscuro: gris azulado, acentos suaves.
// - Típico (andino): inspirado en textiles andinos — terracota, ocre, turquesa
//   y verde oliva sobre pergamino; texto marrón oscuro.
const light = {
  bg: '#FAF6EF',
  bgSoft: '#F5EFE3',
  card: '#FFFFFF',
  text: '#22271F',
  muted: '#8A8F8B',
  line: '#EDE6D6',
  primary: '#22271F', // botón + y tab activo
  accent: '#E07A5F', // coral / terracota suave
  green: '#6FA287',
  greenBg: '#E6F1E8',
  blue: '#6B9ECF',
  blueBg: '#E3EFFA',
  yellow: '#C9A44A',
  yellowBg: '#FDF2D5',
  coral: '#D98162',
  coralBg: '#FDE7DB',
  purple: '#8B7BC7',
  purpleBg: '#ECE8FA',
  success: '#6FA287',
  danger: '#D98162',
  white: '#FFFFFF',
} as const;

const dark = {
  bg: '#101318',
  bgSoft: '#151A21',
  card: '#1A2029',
  text: '#F2EFE7',
  muted: '#9AA3AE',
  line: '#2B333F',
  primary: '#3C4A42',
  accent: '#E08A6B',
  green: '#7FB394',
  greenBg: '#1E2E26',
  blue: '#7FB0DC',
  blueBg: '#1B2A38',
  yellow: '#D9B76A',
  yellowBg: '#332C18',
  coral: '#E59A7F',
  coralBg: '#3A2620',
  purple: '#A99AE0',
  purpleBg: '#2A2540',
  success: '#7FB394',
  danger: '#E59A7F',
  white: '#FFFFFF',
} as const;

const andean = {
  bg: '#F0E1C8', // pergamino
  bgSoft: '#E8D5B7', // lana
  card: '#FFF9EC',
  text: '#3A2416', // marrón oscuro
  muted: '#8A6A4B',
  line: '#DFC9A4',
  primary: '#A9471F', // terracota del telar
  accent: '#C4552A',
  green: '#5B7A3A', // oliva
  greenBg: '#E4EBCF',
  blue: '#22879B', // turquesa
  blueBg: '#D6EEF2',
  yellow: '#C99416', // ocre / oro
  yellowBg: '#F9E7B8',
  coral: '#B5452A', // rojo cochinilla
  coralBg: '#F6D9CC',
  purple: '#A63D6B', // magenta del textil
  purpleBg: '#F4DCE5',
  success: '#5B7A3A',
  danger: '#B5452A',
  white: '#FFFFFF',
} as const;

export const lightColors = light;
export const darkColors = dark;
export const andeanColors = andean;

export type ThemeColors = { [K in keyof typeof light]: string };

let activePalette: ThemeColors = lightColors;

// `colors` resuelve la paleta activa en cada acceso. Sirve para los colores
// sueltos en JSX; los estilos se recrean con `useThemedStyles`.
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get: (_t, prop: string | symbol) => activePalette[prop as keyof ThemeColors],
  has: () => true,
  ownKeys: () => Object.keys(lightColors),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export function paletteFor(mode: string, system: string | null | undefined): ThemeColors {
  if (mode === 'dark') return darkColors;
  if (mode === 'andean') return andeanColors;
  if (mode === 'light') return lightColors;
  return system === 'dark' ? darkColors : lightColors;
}

// Paleta activa + re-render cuando cambia el ajuste o el sistema.
export function useThemeColors(): ThemeColors {
  const mode = usePrefs((s) => s.theme);
  const system = useColorScheme();
  const palette = paletteFor(mode, system);
  activePalette = palette;
  return palette;
}

export function useIsDark(): boolean {
  return useThemeColors() === darkColors;
}

export function useThemedStyles<T>(factory: (palette: ThemeColors) => T): T {
  const palette = useThemeColors();
  return useMemo(() => factory(palette), [factory, palette]);
}

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  full: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
} as const;
