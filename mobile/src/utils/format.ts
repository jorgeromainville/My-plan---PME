import { useSession } from '../store/useSession';

// Símbolo de la cuenta (S/ por defecto). Sin conversión: los importes se
// guardan y se muestran en la moneda elegida en Perfil.
export function formatMoney(n: number, symbol?: string): string {
  const sym = (symbol ?? useSession.getState().user?.currencySymbol ?? 'S/').trim();
  return `${sym} ${n.toFixed(2)}`;
}

export function pct(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
