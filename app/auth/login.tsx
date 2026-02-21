import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/authStore';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

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
            placeholderTextColor={Colors.textFaint}
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
              <ActivityIndicator color={Colors.bgWhite} />
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
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  inner: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  hero: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  appName: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  tagline: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: Spacing.xs },
  form: {},
  label: { fontSize: 14, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 52 },
  error: { color: Colors.errorDark, fontSize: 13, fontFamily: FontFamily.regular, marginTop: 6 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg, minHeight: 52, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.bgWhite, fontSize: 16, fontFamily: FontFamily.semibold },
  trustRow: { marginTop: 20, alignItems: 'center' },
  trustText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint },
  // Sent state
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sentIcon: { fontSize: 56, marginBottom: Spacing.lg },
  sentTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sentSub: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  sentEmail: { fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  backBtn: { marginTop: Spacing.xl, padding: Spacing.md },
  backBtnText: { fontSize: 14, fontFamily: FontFamily.medium, color: Colors.primary },
});
