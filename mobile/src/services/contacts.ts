import { api } from './api';
import { storage } from './storage';

export interface ContactRef {
  id: string;
  firstName: string;
  lastName?: string | null;
  category: string;
}

export interface Contact extends ContactRef {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  lastContactAt?: string | null;
  nextContactAt?: string | null;
}

export interface ContactInput {
  firstName: string;
  lastName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category: string;
  notes?: string;
  lastContactAt?: string;
  nextContactAt?: string;
}

// Mínimo Fase 2 para adjuntar contactos a eventos. CRUD completo en Fase 3.
export async function listContacts(opts: { category?: string; followup?: string; q?: string } = {}): Promise<Contact[]> {
  const t = await storage.getToken();
  const qs = new URLSearchParams();
  if (opts.category) qs.set('category', opts.category);
  if (opts.followup) qs.set('followup', opts.followup);
  if (opts.q) qs.set('q', opts.q);
  const r = await api<{ contacts: Contact[] }>(`/api/contacts?${qs.toString()}`, {}, t);
  return r.contacts;
}

export async function getContact(id: string): Promise<Contact> {
  const t = await storage.getToken();
  const r = await api<{ contact: Contact }>(`/api/contacts/${id}`, {}, t);
  return r.contact;
}

export async function createContact(firstName: string, category?: string): Promise<ContactRef>;
export async function createContact(input: ContactInput): Promise<Contact>;
export async function createContact(a: string | ContactInput, category = 'Otros'): Promise<Contact> {
  const t = await storage.getToken();
  const body = typeof a === 'string' ? { firstName: a, category } : a;
  const r = await api<{ contact: Contact }>('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(body),
  }, t);
  return r.contact;
}

export async function updateContact(id: string, input: Partial<ContactInput>): Promise<Contact> {
  const t = await storage.getToken();
  const r = await api<{ contact: Contact }>(`/api/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }, t);
  return r.contact;
}

export async function deleteContact(id: string): Promise<void> {
  const t = await storage.getToken();
  await api(`/api/contacts/${id}`, { method: 'DELETE' }, t);
}

// Marca "contactado hoy": pone último contacto en hoy y limpia el próximo.
export async function touchContact(id: string): Promise<Contact> {
  const t = await storage.getToken();
  const r = await api<{ contact: Contact }>(`/api/contacts/${id}/touch`, { method: 'POST' }, t);
  return r.contact;
}

export interface ContactCategory {
  name: string;
  color: string | null;
}

export async function listContactCategories(): Promise<ContactCategory[]> {
  const t = await storage.getToken();
  const r = await api<{ categories: ContactCategory[] | string[] }>('/api/contact-categories', {}, t);
  // compat: antes devolvía string[]
  return (r.categories as (ContactCategory | string)[]).map((c) =>
    typeof c === 'string' ? { name: c, color: null } : c,
  );
}

export async function createContactCategory(name: string, color?: string): Promise<void> {
  const t = await storage.getToken();
  await api('/api/contact-categories', { method: 'POST', body: JSON.stringify({ name, color }) }, t);
}
