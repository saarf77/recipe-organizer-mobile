import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useGroupStore } from '@/features/groups/groupStore';
import { useAuthStore } from '@/features/auth/authStore';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

type Status = 'loading' | 'joined' | 'already_member' | 'error' | 'unauthenticated';

export default function GroupJoinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { joinGroup } = useGroupStore();

  const [status, setStatus] = useState<Status>('loading');
  const [groupName, setGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!id) { setStatus('error'); setErrorMsg('Invalid invite link.'); return; }
    if (!user) { setStatus('unauthenticated'); return; }

    joinGroup(id)
      .then(({ alreadyMember, group }) => {
        setGroupName(group.name);
        setStatus(alreadyMember ? 'already_member' : 'joined');
        if (!alreadyMember) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((e: unknown) => {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Something went wrong.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      });
  }, [id, user]);

  const goToGroup = () => router.replace(`/group/${id}`);
  const goHome = () => router.replace('/(tabs)');
  const goLogin = () => router.replace('/auth/login');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={Colors.primary} style={styles.icon} />
            <Text style={styles.title}>Joining group…</Text>
          </>
        )}

        {status === 'joined' && (
          <>
            <View style={[styles.iconCircle, styles.successCircle]}>
              <Ionicons name="checkmark" size={36} color={Colors.bgWhite} />
            </View>
            <Text style={styles.title}>You're in!</Text>
            <Text style={styles.subtitle}>You've joined "{groupName}".</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goToGroup}>
              <Text style={styles.primaryBtnText}>View Group</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'already_member' && (
          <>
            <View style={[styles.iconCircle, styles.infoCircle]}>
              <Ionicons name="people" size={32} color={Colors.bgWhite} />
            </View>
            <Text style={styles.title}>Already a member</Text>
            <Text style={styles.subtitle}>You're already in "{groupName}".</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goToGroup}>
              <Text style={styles.primaryBtnText}>Open Group</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <View style={[styles.iconCircle, styles.warnCircle]}>
              <Ionicons name="lock-closed" size={32} color={Colors.bgWhite} />
            </View>
            <Text style={styles.title}>Sign in first</Text>
            <Text style={styles.subtitle}>You need an account to join a group.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goLogin}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={[styles.iconCircle, styles.errorCircle]}>
              <Ionicons name="close" size={36} color={Colors.bgWhite} />
            </View>
            <Text style={styles.title}>Couldn't join</Text>
            <Text style={styles.subtitle}>{errorMsg}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goHome}>
              <Text style={styles.primaryBtnText}>Go Home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: 24, padding: Spacing['2xl'],
    marginHorizontal: Spacing.xl, alignItems: 'center', gap: Spacing.md,
    ...Shadows.elevated,
    width: '100%', maxWidth: 360,
  },
  icon: { marginBottom: Spacing.sm },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  successCircle: { backgroundColor: Colors.privateGreen },
  infoCircle: { backgroundColor: Colors.swipeEdit },
  warnCircle: { backgroundColor: '#f59e0b' },
  errorCircle: { backgroundColor: Colors.danger },
  title: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textSlate, textAlign: 'center', lineHeight: 22 },
  primaryBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radii.lg,
    paddingHorizontal: 28, paddingVertical: 14, minWidth: 160, alignItems: 'center',
  },
  primaryBtnText: { fontSize: FontSize.base.size, fontFamily: FontFamily.semibold, color: Colors.bgWhite },
});
