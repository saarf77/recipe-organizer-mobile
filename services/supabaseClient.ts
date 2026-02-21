import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const supabaseUrl: string = (Constants.expoConfig?.extra?.supabaseUrl as string) || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey: string = (Constants.expoConfig?.extra?.supabaseAnonKey as string) || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

// On web, fall back to localStorage-based storage so AsyncStorage doesn't
// try to access `window` during SSR / Node.js render passes.
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // On web, Supabase puts tokens in the URL hash after magic link redirect.
    // detectSessionInUrl must be true on web so the client picks them up automatically.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
