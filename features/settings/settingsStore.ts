import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'settings:unitSystem';

export type UnitSystem = 'metric' | 'imperial';

interface SettingsStore {
  unitSystem: UnitSystem;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  unitSystem: 'metric',
  isInitialized: false,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'metric' || stored === 'imperial') {
        set({ unitSystem: stored, isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  setUnitSystem: async (system) => {
    set({ unitSystem: system });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, system);
    } catch {
      // silently ignore storage errors
    }
  },
}));
