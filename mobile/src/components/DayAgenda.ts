import type { CalEvent } from '../services/events';
import type { Task } from '../services/tasks';
import { colors } from '../theme/colors';
import { fmtHour, type HourFormat } from '../store/usePrefs';
import type { Occurrence } from '../utils/recurrence';

export const HOUR_H = 64; // px por hora en la parrilla

export interface PlacedBlock {
  key: string;
  kind: 'task' | 'event';
  title: string;
  timeLabel: string;
  category: string;
  icon: string;
  bg: string;
  top: number; // px dentro del día
  height: number; // px según duración
  leftPct: number; // columna por solape
  widthPct: number;
  isBackup?: boolean;
  status?: string;
  raw: Task | CalEvent;
  occurrenceDate?: Date; // día visible (para series repetidas)
}

export interface HourLine {
  hour: number;
  label: string;
}

function colorFor(key: string): string {
  // Se resuelve en cada llamada para que los bloques sigan el tema activo.
  const palette = [colors.greenBg, colors.blueBg, colors.yellowBg, colors.coralBg, colors.slateBg];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// true si la hora del evento ya pasó (cuenta solo para su meta).
export function eventPast(e: { date: string; endTime: string }): boolean {
  const d = new Date(e.date);
  const [h, m] = e.endTime.split(':').map(Number);
  const end = new Date(d);
  end.setHours(h, m, 0, 0);
  return end <= new Date();
}

interface Raw {
  key: string;
  kind: 'task' | 'event';
  title: string;
  timeLabel: string;
  category: string;
  icon: string;
  bg: string;
  start: number; // minutos
  end: number; // minutos
  isBackup?: boolean;
  status?: string;
  raw: Task | CalEvent;
  occurrenceDate?: Date;
}

// Arma bloques del día con altura por duración y columnas si se solapan.
// start/end: rango visible desde ajustes. format: 12h o 24h. zoom: escala de la hora.
export function layoutDay(tasks: Task[], occurrences: Occurrence[], start = 0, end = 24, format: HourFormat = '24h', zoom = 1): {
  lines: HourLine[];
  blocks: PlacedBlock[];
  timeless: PlacedBlock[];
} {
  const lines: HourLine[] = [];
  for (let h = start; h < end; h++) {
    lines.push({ hour: h, label: fmtHour(`${String(h).padStart(2, '0')}:00`, format) });
  }

  const raw: Raw[] = [];
  const timeless: PlacedBlock[] = [];

  for (const t of tasks) {
    const base = {
      key: `t-${t.id}`,
      kind: 'task' as const,
      title: t.title,
      category: t.category,
      status: t.status,
      icon: t.status === 'completada' ? 'checkSquare' : 'square',
      bg: colorFor(t.category),
      raw: t,
    };
    if (!t.time || !/^\d{2}:\d{2}$/.test(t.time)) {
      timeless.push({ ...base, timeLabel: 'Sin hora', top: 0, height: 0, leftPct: 0, widthPct: 100 });
      continue;
    }
    const start = toMin(t.time);
    raw.push({ ...base, timeLabel: fmtHour(t.time, format), start, end: start + 60 });
  }

  for (const o of occurrences) {
    const e = o.event;
    const start = toMin(e.startTime);
    const end = Math.max(toMin(e.endTime), start + 30);
    const backup = e.isBackup;
    const linked = !!e.goalId;
    // Estricto: solo cuenta si terminó (datetime real) o check manual. Nunca futuro.
    const past = eventPast({ date: o.date.toISOString(), endTime: e.endTime });
    const counted = linked && (e.done || past);
    const pending = linked && !e.done && !past;
    raw.push({
      key: o.key,
      kind: 'event',
      title: `${backup ? 'Plan B · ' : ''}${e.title}`,
      timeLabel: `${fmtHour(e.startTime, format)} – ${fmtHour(e.endTime, format)}${counted ? ' · hecho' : pending ? ' · pendiente' : ''}`,
      category: e.type,
      icon: linked
        ? 'target'
        : backup
          ? 'lifeBuoy'
          : e.type === 'Reunión'
            ? 'users'
            : e.type === 'Personal'
              ? 'home'
              : e.type === 'Trabajo'
                ? 'briefcase'
                : e.type === 'Comida'
                  ? 'utensils'
                  : 'calendar',
      bg: backup ? colors.bgSoft : e.color ? `${e.color}33` : e.type === 'Reunión' ? colors.blueBg : colors.slateBg,
      start,
      end,
      isBackup: backup,
      raw: e,
      occurrenceDate: o.date,
    });
  }

  // Solo lo visible en el rango de ajustes. El principal va antes que su respaldo.
  const inRange = raw.filter((r) => r.end > start * 60 && r.start < end * 60);
  inRange.sort((a, b) => a.start - b.start || Number(a.isBackup ?? false) - Number(b.isBackup ?? false) || a.end - b.end);
  const blocks: PlacedBlock[] = [];
  let cluster: Raw[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    const colsEnd: number[] = [];
    const placed = cluster.map((r) => {
      let col = colsEnd.findIndex((e) => e <= r.start);
      if (col < 0) {
        col = colsEnd.length;
        colsEnd.push(0);
      }
      colsEnd[col] = r.end;
      return { r, col };
    });
    const n = colsEnd.length;
    for (const { r, col } of placed) {
      blocks.push({
        ...r,
        top: Math.max(0, ((r.start - start * 60) / 60) * HOUR_H * zoom),
        height: Math.max(((Math.min(r.end, end * 60) - Math.max(r.start, start * 60)) / 60) * HOUR_H * zoom, 46),
        leftPct: (col / n) * 100,
        widthPct: 100 / n,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };
  for (const r of inRange) {
    if (cluster.length > 0 && r.start >= clusterEnd) flush();
    cluster.push(r);
    clusterEnd = Math.max(clusterEnd, r.end);
  }
  flush();

  return { lines, blocks, timeless };
}
