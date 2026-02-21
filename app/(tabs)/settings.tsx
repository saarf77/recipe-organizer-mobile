import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/features/auth/authStore';
import { useSettingsStore, UnitSystem } from '@/features/settings/settingsStore';
import { runSync } from '@/services/syncService';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

function SettingSegmentRow({
  icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  options: { value: string; display: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon as 'home'} size={20} color={Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <View style={styles.segmentGroup}>
        {options.map((opt, i) => {
          const selected = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.segmentBtn,
                i === 0 && styles.segmentBtnFirst,
                i === options.length - 1 && styles.segmentBtnLast,
                selected && styles.segmentBtnSelected,
              ]}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.display}
            >
              <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextSelected]}>
                {opt.display}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

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
        <Ionicons name={icon as 'home'} size={20} color={destructive ? Colors.danger : Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && styles.destructiveText]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.borderStrong} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut, updateDisplayName } = useAuthStore();
  const { unitSystem, setUnitSystem } = useSettingsStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.display_name ?? '');

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await updateDisplayName(nameInput.trim());
    setEditingName(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleManualSync = async () => {
    const result = await runSync();
    Alert.alert('Sync complete', `Pushed: ${result.pushed}  Pulled: ${result.pulled}  Errors: ${result.errors}`);
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
          <View style={{ flex: 1 }}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  accessibilityLabel="Display name"
                />
                <TouchableOpacity onPress={handleSaveName} style={styles.nameSaveBtn} accessibilityLabel="Save name">
                  <Ionicons name="checkmark" size={18} color={Colors.bgWhite} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { setNameInput(user?.display_name ?? ''); setEditingName(true); }} accessibilityLabel="Edit display name">
                <Text style={styles.profileName}>{user?.display_name ?? 'User'}</Text>
                <Text style={styles.profileNameHint}>Tap to edit</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={11} color={Colors.privateGreen} />
              <Text style={styles.privateBadgeText}>Private by default</Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.group}>
          <SettingSegmentRow
            icon="scale-outline"
            label="Units"
            value={unitSystem}
            options={[
              { value: 'metric', display: 'Metric' },
              { value: 'imperial', display: 'Imperial' },
            ]}
            onChange={(v) => setUnitSystem(v as UnitSystem)}
          />
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
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  scroll: { padding: Spacing.lg, paddingBottom: 120 },
  title: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  profileCard: {
    backgroundColor: Colors.bgWhite, borderRadius: 14, padding: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.primary },
  profileName: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 1, marginBottom: Spacing.xs },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  privateBadgeText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.medium, color: Colors.privateGreen },
  sectionLabel: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold, color: Colors.textFaint, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  group: {
    backgroundColor: Colors.bgWhite, borderRadius: 14, marginBottom: Spacing.xl,
    overflow: 'hidden', ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted, minHeight: 56, gap: Spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: Radii.md, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  rowIconDestructive: { backgroundColor: Colors.dangerBg },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: FontFamily.medium, color: Colors.textPrimary },
  rowSubtitle: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 1 },
  destructiveText: { color: Colors.danger },
  segmentGroup: { flexDirection: 'row', borderRadius: Spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.bgSurface },
  segmentBtnFirst: { borderRightWidth: 1, borderRightColor: Colors.border },
  segmentBtnLast: {},
  segmentBtnSelected: { backgroundColor: Colors.primary },
  segmentBtnText: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.semibold, color: Colors.textSlate },
  segmentBtnTextSelected: { color: Colors.bgWhite },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  nameInput: { flex: 1, fontSize: FontSize.base.size, fontFamily: FontFamily.semibold, color: Colors.textPrimary, borderBottomWidth: 1.5, borderBottomColor: Colors.primary, paddingVertical: 2 },
  nameSaveBtn: { backgroundColor: Colors.primary, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  profileNameHint: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.borderStrong, marginTop: 1 },
});
