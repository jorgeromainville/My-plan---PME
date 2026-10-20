import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../store/usePrefs';

// Paletas de la app. Tres estilos + automático:
// - Claro: fondos cálidos crema, tarjetas blancas.
// - Oscuro: negro cálido de telar, texto crema y acentos terracota/oro.
// - Típico (andino): inspirado en textiles andinos — terracota, ocre, turquesa
//   y verde oliva sobre pergamino; texto marrón oscuro.
const light = {
  bg: '#FAF6EF',
  bgSoft: '#F5EFE3',
  card: '#FFFFFF',
  text: '#22271F',
  muted: '#656A65',
  line: '#EDE6D6',
  primary: '#22271F', // botón + y tab activo
  onAccent: '#22271F', // texto sobre acentos claros (verde, coral, ocre…)
  link: '#2F6B4F', // enlaces y acciones secundarias
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
  bg: '#17110D', // negro cálido, como la madera del telar
  bgSoft: '#211812',
  card: '#251C16',
  text: '#F4E7CE', // crema
  muted: '#B9A58A',
  line: '#3D2E23',
  primary: '#B54A24', // terracota profunda (5.3:1 con texto blanco)
  onAccent: '#17110D', // los acentos son claros: texto oscuro encima
  link: '#E0A458', // dorado
  accent: '#E0A458',
  green: '#8FAE6A', // oliva claro
  greenBg: '#262A18',
  blue: '#5CC8D7', // turquesa
  blueBg: '#16303A',
  yellow: '#E4B84C', // oro
  yellowBg: '#33280F',
  coral: '#E07A5F',
  coralBg: '#3A211A',
  purple: '#D06A9A', // magenta
  purpleBg: '#331A26',
  success: '#8FAE6A',
  danger: '#E07A5F',
  white: '#FFFFFF',
} as const;

const andean = {
  bg: '#EAD9BC', // pergamino tejido
  bgSoft: '#E0C9A4', // lana
  card: '#FFFAEE',
  text: '#3D2415', // marrón oscuro
  muted: '#6B4E2E',
  line: '#D8BD92',
  primary: '#A63E1E', // terracota del telar
  onAccent: '#FFF8E7',
  link: '#8F3518',
  accent: '#CE5A2C',
  green: '#55702F', // oliva
  greenBg: '#E3E9C9',
  blue: '#1C7A88', // turquesa
  blueBg: '#CDE9EC',
  yellow: '#8F6410', // ocre / oro profundo (legible con crema)
  yellowBg: '#F7E3AE',
  coral: '#B03A22', // rojo cochinilla
  coralBg: '#F5D5C6',
  purple: '#A3325F', // magenta del textil
  purpleBg: '#F2D6E0',
  success: '#55702F',
  danger: '#B03A22',
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
