import { api } from './api';
import { storage } from './storage';

export type EventRepeat =
  | 'none' | 'daily' | 'weekly' | 'monthly'
  | 'mon_wed' | 'tue_thu' | 'mon_wed_fri' | 'weekdays' | 'weekends';

export interface CalEvent {
  id: string;
  title: string;
  type: string;
  color?: string | null;
  isBackup: boolean; // plan respaldo: visual opaco, va después
  date: string;
  startTime: string; // "HH:MM"
  endTime: string;
  location?: string | null;
  placeId?: string | null;
  description?: string | null;
  notifyMins: number;
  repeat: EventRepeat;
  repeatUntil?: string | null;
  goalId?: string | null;
  done: boolean;
  contacts?: { id: string; firstName: string }[];
}

export async function listEvents(from: string, to: string, goalId?: string): Promise<CalEvent[]> {
  const t = await storage.getToken();
  const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${goalId ? `&goalId=${goalId}` : ''}`;
  const r = await api<{ events: CalEvent[] }>(`/api/events?${qs}`, {}, t);
  return r.events;
}

export interface EventInput {
  title: string;
  type: string;
  color?: string;
  isBackup: boolean;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  notifyMins: number;
  repeat: EventRepeat;
  repeatUntil?: string | null;
  goalId?: string | null;
  done?: boolean;
  contactIds: string[];
}

export async function createEvent(input: EventInput): Promise<CalEvent> {
  const t = await storage.getToken();
  const r = await api<{ event: CalEvent }>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  }, t);
  return r.event;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<CalEvent> {
  const t = await storage.getToken();
  const r = await api<{ event: CalEvent }>(`/api/events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, t);
  return r.event;
}

export async function deleteEvent(id: string): Promise<void> {
  const t = await storage.getToken();
  await api<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' }, t);
}

export async function getEvent(id: string): Promise<CalEvent> {
  const t = await storage.getToken();
  const r = await api<{ event: CalEvent }>(`/api/events/${id}`, {}, t);
  return r.event;
}
