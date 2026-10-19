import type { CalEvent } from '../services/events';
import { toLocalKey } from './dates';

export interface Occurrence {
  key: string; // `${eventId}@${dayKey}` para React keys
  date: Date; // día local de la ocurrencia
  event: CalEvent;
}

const BY_DAYS: Record<string, number[]> = {
  mon_wed: [1, 3],
  tue_thu: [2, 4],
  mon_wed_fri: [1, 3, 5],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};

function matchesDay(e: CalEvent, day: Date): boolean {
  const base = new Date(e.date);
  const d0 = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  if (d < d0) return false;
  if (e.repeatUntil) {
    const u = new Date(e.repeatUntil);
    const lim = new Date(u.getFullYear(), u.getMonth(), u.getDate());
    if (d > lim) return false; // se repite hasta ese día inclusive
  }
  switch (e.repeat) {
    case 'none':
      return toLocalKey(d) === toLocalKey(d0);
    case 'daily':
      return true;
    case 'weekly':
      return d.getDay() === d0.getDay();
    case 'monthly':
      return d.getDate() === d0.getDate();
    default: {
      const days = BY_DAYS[e.repeat];
      return days ? days.includes(d.getDay()) : false;
    }
  }
}

// Expande eventos con repetición en el rango visible [from, to] (días locales).
export function expandEvents(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur <= end) {
    for (const e of events) {
      if (matchesDay(e, cur)) {
        out.push({
          key: `${e.id}@${toLocalKey(cur)}`,
          date: new Date(cur),
          event: e,
        });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
