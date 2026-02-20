import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/services/supabaseClient';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();

  useEffect(() => {
    async function handle() {
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
      <ActivityIndicator size="large" color="#f97316" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  text: { marginTop: 16, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#94a3b8' },
});
