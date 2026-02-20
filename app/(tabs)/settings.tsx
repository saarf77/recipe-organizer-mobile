import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/features/auth/authStore';
import { runSync } from '@/services/syncService';

function SettingRow({
  icon, label, subtitle, onPress, destructive,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
        <Ionicons name={icon as 'home'} size={20} color={destructive ? '#ef4444' : '#f97316'} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && styles.destructiveText]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleManualSync = async () => {
    const result = await runSync();
    Alert.alert('Sync complete', `Pushed: ${result.pushed}, Errors: ${result.errors}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.display_name?.[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{user?.display_name ?? 'User'}</Text>
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={11} color="#22c55e" />
              <Text style={styles.privateBadgeText}>Private by default</Text>
            </View>
          </View>
        </View>

        {/* General */}
        <Text style={styles.sectionLabel}>General</Text>
        <View style={styles.group}>
          <SettingRow icon="sync-outline" label="Sync now" subtitle="Manually trigger sync" onPress={handleManualSync} />
          <SettingRow icon="folder-outline" label="Collections" onPress={() => router.push('/collection/list')} />
          <SettingRow icon="share-social-outline" label="Share a recipe" onPress={() => router.push('/(tabs)/recipes')} />
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.group}>
          <SettingRow icon="information-circle-outline" label="About Recipe Organizer" subtitle="v1.0.0" onPress={() => {}} />
        </View>

        {/* Danger */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <SettingRow icon="log-out-outline" label="Sign out" onPress={handleSignOut} destructive />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 20 },
  profileCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#f97316' },
  profileName: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  privateBadgeText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#22c55e' },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', minHeight: 56, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  rowIconDestructive: { backgroundColor: '#fef2f2' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#0f172a' },
  rowSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 1 },
  destructiveText: { color: '#ef4444' },
});
