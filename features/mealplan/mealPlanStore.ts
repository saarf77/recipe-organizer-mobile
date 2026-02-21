import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealEntry {
  id: string;
  date: string;       // ISO date string e.g. "2024-02-20"
  slot: MealSlot;
  recipeId: string;
  recipeName: string;
  recipeImageUri?: string | null;
}

interface MealPlanStore {
  entries: MealEntry[];
  addEntry: (date: string, slot: MealSlot, recipeId: string, recipeName: string, recipeImageUri?: string | null) => void;
  removeEntry: (id: string) => void;
  getEntriesForWeek: (weekStartDate: string) => MealEntry[];
  clearWeek: (weekStartDate: string) => void;
}

function getWeekDates(weekStartDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStartDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]!);
  }
  return dates;
}

export const useMealPlanStore = create<MealPlanStore>((set, get) => ({
  entries: [],

  addEntry: (date, slot, recipeId, recipeName, recipeImageUri) => {
    const newEntry: MealEntry = {
      id: uuidv4(),
      date,
      slot,
      recipeId,
      recipeName,
      recipeImageUri,
    };
    set((state) => ({ entries: [...state.entries, newEntry] }));
  },

  removeEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  getEntriesForWeek: (weekStartDate) => {
    const weekDates = new Set(getWeekDates(weekStartDate));
    return get().entries.filter((e) => weekDates.has(e.date));
  },

  clearWeek: (weekStartDate) => {
    const weekDates = new Set(getWeekDates(weekStartDate));
    set((state) => ({ entries: state.entries.filter((e) => !weekDates.has(e.date)) }));
  },
}));
