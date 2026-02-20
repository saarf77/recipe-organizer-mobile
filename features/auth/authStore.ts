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
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      set({
        user: profile ?? {
          id: session.user.id,
          display_name: session.user.email?.split('@')[0] ?? 'User',
          avatar_url: null,
          created_at: new Date().toISOString(),
        },
        session: session.access_token,
        isInitialized: true,
      });
    } else {
      set({ isInitialized: true });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          user: profile ?? {
            id: session.user.id,
            display_name: session.user.email?.split('@')[0] ?? 'User',
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
          session: session.access_token,
        });
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, session: null });
      }
    });
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
}));
