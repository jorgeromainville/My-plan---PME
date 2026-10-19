import { create } from 'zustand';
import { demoContacts, demoDailyGoals, demoUser, demoWeeklyGoals, demoWeeklyMain } from '../data/demo';

interface AppState {
  userName: string;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  setUserName: (n: string) => void;
  dailyGoals: typeof demoDailyGoals;
  weeklyMain: typeof demoWeeklyMain;
  weeklyGoals: typeof demoWeeklyGoals;
  contacts: typeof demoContacts;
}

export const useAppStore = create<AppState>((set) => ({
  userName: demoUser.name,
  selectedDate: new Date(),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setUserName: (userName) => set({ userName }),
  dailyGoals: demoDailyGoals,
  weeklyMain: demoWeeklyMain,
  weeklyGoals: demoWeeklyGoals,
  contacts: demoContacts,
}));
