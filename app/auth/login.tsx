import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/authStore';
import { router } from 'expo-router';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

type Mode = 'password' | 'magic' | 'signup';

export default function LoginScreen() {
  const { signInWithMagicLink, signInWithGoogle, signInWithPassword, signUpWithPassword, isLoading, user } = useAuthStore();

  // Navigate reactively in case auth completes via deep link before signInWithGoogle returns
  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    const ok = await signInWithGoogle();
    if (ok) router.replace('/(tabs)');
  };

  // For username/password modes, convert plain username → fake email so Supabase is happy.
  // Users who type an @ are treated as entering a real email (magic link, Google).
  const toEmail = (val: string) =>
    val.includes('@') ? val.toLowerCase() : `${val.toLowerCase()}@recipeorganizer.local`;

  const handlePasswordSignIn = async () => {
    if (!email.trim() || !password) { setError('Enter your username and password'); return; }
    setError(null);
    const err = await signInWithPassword(toEmail(email.trim()), password);
    if (err) setError(err);
    else router.replace('/(tabs)');
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) { setError('Enter your username and password'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(null);
    const err = await signUpWithPassword(toEmail(email.trim()), password);
    if (!err) { router.replace('/(tabs)'); return; }
    if (err === 'CHECK_EMAIL') {
      setMagicSent(true);
      return;
    }
    setError(err);
  };

  const handleMagicLink = async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    setError(null);
    const ok = await signInWithMagicLink(email.trim().toLowerCase());
    if (ok) setMagicSent(true);
    else setError('Failed to send link. Check your email.');
  };

  if (magicSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sentWrap}>
          <Text style={styles.sentIcon}>📬</Text>
          <Text style={styles.sentTitle}>Check your inbox</Text>
          <Text style={styles.sentSub}>
            We sent a magic link to{'\n'}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <TouchableOpacity onPress={() => setMagicSent(false)} style={styles.backBtn}>
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.logo}>🍳</Text>
            <Text style={styles.appName}>Recipe Organizer</Text>
            <Text style={styles.tagline}>Your kitchen, organized</Text>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'password' && styles.tabActive]}
              onPress={() => { setMode('password'); setError(null); }}
            >
              <Text style={[styles.tabText, mode === 'password' && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(null); }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'magic' && styles.tabActive]}
              onPress={() => { setMode('magic'); setError(null); }}
            >
              <Text style={[styles.tabText, mode === 'magic' && styles.tabTextActive]}>Magic Link</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{mode === 'magic' ? 'Email' : 'Username'}</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === 'magic' ? 'you@example.com' : 'Choose a username'}
              placeholderTextColor={Colors.textFaint}
              value={email}
              onChangeText={setEmail}
              keyboardType={mode === 'magic' ? 'email-address' : 'default'}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {(mode === 'password' || mode === 'signup') && (
              <>
                <Text style={[styles.label, { marginTop: Spacing.md }]}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                  placeholderTextColor={Colors.textFaint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={mode === 'password' ? handlePasswordSignIn : mode === 'signup' ? handleSignUp : handleMagicLink}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.bgWhite} />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'password' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleBtn, isLoading && styles.btnDisabled]}
              onPress={handleGoogle}
              disabled={isLoading}
            >
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.trustRow}>
              <Text style={styles.trustText}>🔒 Private by default. No ads. No tracking.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  inner: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  hero: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 56, marginBottom: 12 },
  appName: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  tagline: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: Spacing.xs },
  tabs: { flexDirection: 'row', backgroundColor: Colors.bgSurface, borderRadius: Radii.lg, padding: 4, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radii.md },
  tabActive: { backgroundColor: Colors.bgWhite, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textFaint },
  tabTextActive: { color: Colors.textPrimary, fontFamily: FontFamily.semibold },
  form: {},
  label: { fontSize: 14, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 52 },
  error: { color: Colors.errorDark, fontSize: 13, fontFamily: FontFamily.regular, marginTop: 8 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg, minHeight: 52, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.bgWhite, fontSize: 16, fontFamily: FontFamily.semibold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: Spacing.sm, fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.lg, padding: Spacing.lg, marginTop: Spacing.md, minHeight: 52 },
  googleBtnText: { fontSize: 16, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  trustRow: { marginTop: 20, alignItems: 'center' },
  trustText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint },
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sentIcon: { fontSize: 56, marginBottom: Spacing.lg },
  sentTitle: { fontSize: 24, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sentSub: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  sentEmail: { fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  backBtn: { marginTop: Spacing.xl, padding: Spacing.md },
  backBtnText: { fontSize: 14, fontFamily: FontFamily.medium, color: Colors.primary },
});
