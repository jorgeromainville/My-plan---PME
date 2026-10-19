export function formatMoney(n: number, currency = 'PEN'): string {
  const symbol = currency === 'PEN' ? 'S/ ' : currency === 'USD' ? '$ ' : '€ ';
  return `${symbol}${n.toFixed(2)}`;
}

export function pct(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
