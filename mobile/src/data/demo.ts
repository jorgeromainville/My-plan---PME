import type { Contact, DailyGoal, WeeklyGoal } from '../types';

// Datos demo eliminables (Fase 1). Luego vendrán de API + SQLite/AsyncStorage.
export const demoUser = {
  name: 'Jorge',
  email: 'jorge@demo.com',
  currency: 'PEN',
};

export const demoDailyGoals: DailyGoal[] = [
  { id: 'g1', title: 'Ingresos', current: 0, target: 5, color: 'coral', icon: 'money' },
  { id: 'g2', title: 'Contactar personas', current: 0, target: 2, color: 'blue', icon: 'users' },
  { id: 'g3', title: 'Tareas', current: 3, target: 5, color: 'yellow', icon: 'checkSquare' },
  { id: 'g4', title: 'Horas de trabajo', current: 4, target: 8, color: 'green', icon: 'briefcase' },
];

export const demoWeeklyMain: WeeklyGoal = {
  id: 'w0',
  title: 'Ingresos totales',
  subtitle: 'Meta periódica',
  current: 11,
  target: 100,
};

export const demoWeeklyGoals: WeeklyGoal[] = [
  { id: 'w1', title: 'Contactar amigos', subtitle: '', current: 5, target: 5 },
  { id: 'w2', title: 'Contactar clientes', subtitle: '', current: 5, target: 5 },
  { id: 'w3', title: 'Contactar proveedores', subtitle: '', current: 5, target: 5 },
];

export const demoContacts: Contact[] = [
  { id: 'c1', firstName: 'Juan', category: 'Amigos', phone: '+51987654321', address: 'Av. Los Olivos 123, Lima', badge: 'star', lastContactDaysAgo: 5 },
  { id: 'c2', firstName: 'Pablo', category: 'Clientes', badge: 'check' },
  { id: 'c3', firstName: 'Juanita', category: 'Familia', badge: 'heart' },
  { id: 'c4', firstName: 'Rocío', category: 'Amigos', badge: 'heart' },
];
