import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/services/supabaseClient';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();

  useEffect(() => {
    async function handle() {
      // ── Web: Supabase puts tokens in the URL hash fragment.
      // With detectSessionInUrl: true the client resolves the session automatically.
      // We just need to wait for it then navigate.
      if (Platform.OS === 'web') {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/(tabs)');
          return;
        }
        // Give the client a moment to parse the hash, then re-check
        await new Promise((r) => setTimeout(r, 1500));
        const { data: retried } = await supabase.auth.getSession();
        if (retried.session) {
          router.replace('/(tabs)');
          return;
        }
        router.replace('/auth/login');
        return;
      }

      // ── Native: token_hash is passed as a query param via the deep link
      if (params.token_hash && params.type === 'magiclink') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: params.token_hash,
          type: 'magiclink',
        });
        if (!error) {
          router.replace('/(tabs)');
          return;
        }
      }
      router.replace('/auth/login');
    }
    handle();
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgWhite },
  text: { marginTop: Spacing.lg, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textFaint },
});
