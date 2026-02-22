import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';
import { Profile } from '@/types';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

interface AuthStore {
  user: Profile | null;
  session: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
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
    try {
      const redirectTo = AuthSession.makeRedirectUri({ path: 'auth/callback' });
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      return !error;
    } catch (e) {
      console.error('[Auth] signInWithMagicLink error:', e);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    try {
      // Web: full-page redirect — no popup, avoids COOP issues
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        // Page will redirect; loading stays true intentionally
        if (error) set({ isLoading: false });
        return false;
      }

      // Native: open browser, catch redirect via ASWebAuthenticationSession OR Linking fallback
      const redirectTo = AuthSession.makeRedirectUri({ path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) return false;

      // Race between openAuthSessionAsync and a Linking deep-link event.
      // In Expo Go, the browser sometimes gets stuck after redirect — the
      // Linking listener catches the exp:// deep link as a fallback.
      const callbackUrl = await new Promise<string | null>((resolve) => {
        const sub = Linking.addEventListener('url', ({ url }) => {
          if (url.includes('auth/callback')) {
            sub.remove();
            WebBrowser.dismissBrowser();
            resolve(url);
          }
        });

        WebBrowser.openAuthSessionAsync(data.url, redirectTo).then((result) => {
          sub.remove();
          resolve(result.type === 'success' ? result.url : null);
        }).catch(() => {
          sub.remove();
          resolve(null);
        });
      });

      if (!callbackUrl) return false;

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(callbackUrl);
      if (exchangeError) {
        console.error('[Auth] exchangeCodeForSession error:', exchangeError);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Auth] signInWithGoogle error:', e);
      return false;
    } finally {
      if (Platform.OS !== 'web') set({ isLoading: false });
    }
  },

  signInWithPassword: async (email, password) => {
    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    } catch (e: any) {
      return e?.message ?? 'Sign in failed';
    } finally {
      set({ isLoading: false });
    }
  },

  signUpWithPassword: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return error.message;
      // session is null when email confirmation is required
      if (!data.session) return 'CHECK_EMAIL';
      return null;
    } catch (e: any) {
      return e?.message ?? 'Sign up failed';
    } finally {
      set({ isLoading: false });
    }
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
