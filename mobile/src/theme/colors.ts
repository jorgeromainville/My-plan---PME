import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../store/usePrefs';

// Paletas de la app. Tres estilos + automático:
// - Claro: fondos cálidos crema, tarjetas blancas.
// - Oscuro: grafito frío casi negro, texto blanco y acento azul acero.
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
  bg: '#0E1114', // grafito casi negro, con un deje frío
  bgSoft: '#14181C',
  card: '#1A1F24',
  text: '#E9EEF2', // blanco frío
  muted: '#A0ACB5',
  line: '#2B333A',
  primary: '#3D6FA6', // azul acero (5.2:1 con texto blanco)
  onAccent: '#0E1114', // los acentos son claros: texto oscuro encima
  link: '#8CC2EE', // azul claro
  accent: '#6FB3D9',
  green: '#7FC8A9', // menta
  greenBg: '#182B25',
  blue: '#7FB4E8',
  blueBg: '#172A3A',
  yellow: '#E3C06A', // oro suave
  yellowBg: '#2C271A',
  coral: '#E8907A', // salmón (solo datos: gastos)
  coralBg: '#33211D',
  purple: '#C39BE0', // lavanda
  purpleBg: '#271F31',
  success: '#7FC8A9',
  danger: '#F08A7A',
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
