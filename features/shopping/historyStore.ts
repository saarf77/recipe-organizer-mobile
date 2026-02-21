/**
 * Shopping item history store.
 * Persists the names of manually added shopping items to AsyncStorage
 * so they can surface as autocomplete suggestions.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'shopping:item_history';
const MAX_HISTORY = 60;

interface HistoryStore {
  history: string[];          // newest first
  isLoaded: boolean;
  load: () => Promise<void>;
  add: (name: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: [],
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: string[] = raw ? JSON.parse(raw) : [];
      set({ history: parsed, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  add: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const prev = get().history;
    // Move to front if already exists (case-insensitive), otherwise prepend
    const filtered = prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
    set({ history: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // silently ignore storage errors
    }
  },
}));
