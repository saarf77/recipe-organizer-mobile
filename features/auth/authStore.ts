import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';
import { Profile } from '@/types';

interface AuthStore {
  user: Profile | null;
  session: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

// Keep subscription outside store so it is never duplicated across re-renders
let _authUnsubscribe: (() => void) | null = null;

async function fetchProfile(userId: string, email?: string): Promise<Profile> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { ...(profile ?? {
    id: userId,
    display_name: email?.split('@')[0] ?? 'User',
    avatar_url: null,
    created_at: new Date().toISOString(),
  }), email };
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const profile = await fetchProfile(session.user.id, session.user.email);
      set({ user: profile, session: session.access_token, isInitialized: true });
    } else {
      set({ isInitialized: true });
    }

    // Subscribe only once — tear down any previous subscription first
    if (_authUnsubscribe) {
      _authUnsubscribe();
      _authUnsubscribe = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email);
        set({ user: profile, session: session.access_token });
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, session: null });
      }
    });

    _authUnsubscribe = () => subscription.unsubscribe();
  },

  signInWithMagicLink: async (email) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'recipeorganizer://auth/callback' },
    });
    set({ isLoading: false });
    return !error;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  updateDisplayName: async (name) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('profiles').upsert({
      id: session.user.id,
      display_name: name.trim(),
      updated_at: new Date().toISOString(),
    });
    set((state) => ({
      user: state.user ? { ...state.user, display_name: name.trim() } : null,
    }));
  },
}));
