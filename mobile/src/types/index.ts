export type ID = string;

export interface User {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  currency: 'PEN' | 'USD' | 'EUR' | string;
  theme: 'light' | 'dark' | 'auto';
  weekStartsOn: 'monday' | 'sunday';
}

export interface DailyGoal {
  id: ID;
  title: string;
  current: number;
  target: number;
  color: 'green' | 'blue' | 'yellow' | 'coral';
  icon: string; // emoji simple para Fase 1, luego iconos vectoriales
}

export interface WeeklyGoal {
  id: ID;
  title: string;
  subtitle: string;
  current: number;
  target: number;
  isMoney?: boolean;
}

export interface Contact {
  id: ID;
  firstName: string;
  category: 'Amigos' | 'Clientes' | 'Proveedores' | 'Familia' | string;
  phone?: string;
  address?: string;
  lastContactDaysAgo?: number;
  badge?: 'star' | 'check' | 'heart';
}

export type Period = 'day' | 'week' | 'month';
