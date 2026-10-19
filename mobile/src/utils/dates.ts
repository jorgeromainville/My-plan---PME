// Usar siempre hora local del dispositivo, nunca UTC para UI.
export function toLocalKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

// "AAAA-MM-DD" → Date local a mediodía (mediodía para que la conversión a UTC
// no corra el día). null si el texto no es una fecha real: nunca reventamos.
export function parseLocalDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day, 12, 0, 0, 0);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatLongEs(d: Date): string {
  // Ej: "Jueves, 29 de mayo"
  const dia = DIAS[d.getDay()];
  const mes = MESES[d.getMonth()];
  return `${dia}, ${d.getDate()} de ${mes}`;
}

// Ej: "31 dic 2027" (para botones, sin Intl para no depender del motor).
export function formatShortEs(d: Date): string {
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function greetingByHour(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
