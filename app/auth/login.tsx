import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/authStore';

export default function LoginScreen() {
  const { signInWithMagicLink, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    setError(null);
    const ok = await signInWithMagicLink(email.trim().toLowerCase());
    if (ok) setSent(true);
    else setError('Failed to send link. Check your email.');
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sentWrap}>
          <Text style={styles.sentIcon}>📬</Text>
          <Text style={styles.sentTitle}>Check your inbox</Text>
          <Text style={styles.sentSub}>
            We sent a magic link to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <TouchableOpacity onPress={() => setSent(false)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <View style={styles.hero}>
          <Text style={styles.logo}>🍳</Text>
          <Text style={styles.appName}>Recipe Organizer</Text>
          <Text style={styles.tagline}>Your kitchen, organized</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email address"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={handleSend}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send magic link"
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnText}>Continue with Email</Text>
            )}
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <Text style={styles.trustText}>🔒 Private by default. No ads. No tracking.</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#0f172a' },
  tagline: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 4 },
  form: {},
  label: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#0f172a', minHeight: 52 },
  error: { color: '#ef4444', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 },
  btn: { backgroundColor: '#f97316', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16, minHeight: 52, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  trustRow: { marginTop: 20, alignItems: 'center' },
  trustText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8' },
  // Sent state
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sentIcon: { fontSize: 56, marginBottom: 16 },
  sentTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 8 },
  sentSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#475569', textAlign: 'center', lineHeight: 22 },
  sentEmail: { fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  backBtn: { marginTop: 24, padding: 12 },
  backBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#f97316' },
});
