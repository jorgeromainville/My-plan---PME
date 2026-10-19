import { Platform } from 'react-native';
import { listContacts } from './contacts';
import { listEvents } from './events';
import { goalsProgress } from './goals';
import { usePrefs } from '../store/usePrefs';
import { listTasks } from './tasks';

// Recordatorios locales (sin servidor ni keys): cada vez que se abre la app se
// reprograman los próximos avisos (eventos, tareas, seguimientos, metas).
// Futuro push remoto: reutilizar la tabla `Notification` del backend (Fase 9).
//
// El módulo se carga de forma perezosa y a través del envoltorio `./notifications`
// (submódulos locales, sin el auto-registro de push que lanza Error en Expo Go
// Android). Si algo faltara, los avisos se desactivan solos en vez de tumbar
// las pantallas.

type NotifMod = typeof import('./notifications');

let mod: NotifMod | null = null;
let nativeMissing = false;

async function N(): Promise<NotifMod | null> {
  if (mod) return mod;
  if (nativeMissing) return null;
  try {
    mod = await import('./notifications');
    return mod;
  } catch {
    nativeMissing = true;
    return null;
  }
}

// true si el teléfono puede mostrar avisos (permiso + módulo nativo).
export function remindersNativeMissing(): boolean {
  return nativeMissing;
}

let configured = false;
let lastRun = 0;
const THROTTLE_MS = 15 * 60 * 1000;
const MAX = 40;

export async function configureReminders(): Promise<void> {
  if (configured) return;
  configured = true;
  const m = await N();
  if (!m) return;
  try {
    m.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await m.setNotificationChannelAsync('recordatorios', {
        name: 'Recordatorios',
        importance: m.AndroidImportance.HIGH,
      });
    }
  } catch {
    nativeMissing = true;
  }
}

export async function remindersGranted(): Promise<boolean> {
  const m = await N();
  if (!m) return false;
  try {
    const cur = await m.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await m.requestPermissionsAsync();
    return req.granted;
  } catch {
    nativeMissing = true;
    return false;
  }
}

export async function cancelReminders(): Promise<void> {
  const m = await N();
  if (!m) return;
  await m.cancelAllScheduledNotificationsAsync().catch(() => {});
}

async function plan(
  list: { id: string; title: string; body: string; at: Date }[],
  kind: string,
  id: string,
  title: string,
  body: string,
  at: Date,
) {
  if (at.getTime() < Date.now() + 60 * 1000) return;
  if (list.length >= MAX) return;
  list.push({ id: `${kind}:${id}`, title, body, at });
}

// Reprograma todo. Devuelve cuántos avisos quedaron (0 = apagados o sin nada próximo).
export async function rescheduleReminders(force = false): Promise<number> {
  await configureReminders();
  if (!force && Date.now() - lastRun < THROTTLE_MS) return -1;
  lastRun = Date.now();
  const m = await N();
  if (!m || !usePrefs.getState().reminders) {
    await cancelReminders();
    return 0;
  }
  if (!(await remindersGranted())) return 0;

  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const [events, tasks, overdue, today, goals] = await Promise.all([
    listEvents(now.toISOString(), in7.toISOString()).catch(() => []),
    listTasks(now.toISOString(), new Date(now.getTime() + 3 * 86400000).toISOString()).catch(() => []),
    listContacts({ followup: 'overdue' }).catch(() => []),
    listContacts({ followup: 'today' }).catch(() => []),
    goalsProgress().catch(() => []),
  ]);

  const jobs: { id: string; title: string; body: string; at: Date }[] = [];

  for (const ev of events) {
    const d = new Date(ev.date);
    const [h, min] = ev.startTime.split(':').map(Number);
    if (Number.isNaN(h)) continue;
    d.setHours(h, min ?? 0, 0, 0);
    const at = new Date(d.getTime() - (ev.notifyMins ?? 30) * 60000);
    plan(jobs, 'event', ev.id, `📅 ${ev.title}`, `${d.toLocaleDateString()} ${ev.startTime}${ev.location ? ` · ${ev.location}` : ''}`, at);
  }

  for (const t of tasks) {
    if (t.status === 'completada') continue;
    const d = new Date(t.date);
    if (t.time) {
      const [h, min] = t.time.split(':').map(Number);
      if (!Number.isNaN(h)) d.setHours(h, min ?? 0, 0, 0);
    } else {
      d.setHours(9, 0, 0, 0);
    }
    plan(jobs, 'task', t.id, `✓ ${t.title}`, t.time ? `Hoy ${t.time}` : 'Pendiente de hoy', d);
  }

  const seen = new Set<string>();
  for (const c of [...overdue, ...today]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const at = new Date();
    at.setHours(9, 0, 0, 0);
    if (at.getTime() < Date.now()) at.setDate(at.getDate() + 1);
    const name = `${c.firstName}${c.lastName ? ` ${c.lastName}` : ''}`;
    plan(jobs, 'contact', c.id, `👤 Contactar: ${name}`, c.category, at);
  }

  for (const g of goals) {
    if (g.status !== 'activa' || !g.deadline || (g.pct ?? 0) >= 100) continue;
    const dl = new Date(g.deadline);
    if (dl.getTime() > now.getTime() + 3 * 86400000) continue;
    const at = new Date(dl);
    at.setDate(at.getDate() - 1);
    at.setHours(20, 0, 0, 0);
    plan(jobs, 'goal', g.id, `🎯 Meta: ${g.title}`, `Vence el ${dl.toLocaleDateString()} (${g.current}/${g.target} ${g.unit})`, at);
  }

  await cancelReminders();
  for (const j of jobs) {
    await m
      .scheduleNotificationAsync({
        identifier: `planner:${j.id}`,
        content: { title: j.title, body: j.body },
        trigger: { type: m.SchedulableTriggerInputTypes.DATE, date: j.at },
      })
      .catch(() => {});
  }
  return jobs.length;
}

// Aviso de prueba en 5 segundos (para verificar desde Perfil).
export async function sendTestReminder(): Promise<boolean> {
  await configureReminders();
  const m = await N();
  if (!m || !(await remindersGranted())) return false;
  try {
    await m.scheduleNotificationAsync({
      identifier: 'planner:test',
      content: { title: '✓ Avisos funcionando', body: 'Así te llegarán tus recordatorios.' },
      trigger: { type: m.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    return true;
  } catch {
    nativeMissing = true;
    return false;
  }
}
