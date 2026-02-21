import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/features/groups/groupStore';
import { EditingMode } from '@/types';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

export default function NewGroupScreen() {
  const { createGroup, isLoading } = useGroupStore();
  const [name, setName] = useState('');
  const [editingMode, setEditingMode] = useState<EditingMode>('strict');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Group name is required'); return; }
    setError(null);
    await createGroup({ name: name.trim(), editing_mode: editingMode });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Family Recipes"
          placeholderTextColor={Colors.textFaint}
          autoFocus
          accessibilityLabel="Group name"
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>Editing Mode</Text>

        <TouchableOpacity
          style={[styles.modeCard, editingMode === 'strict' && styles.modeCardActive]}
          onPress={() => setEditingMode('strict')}
          accessibilityRole="radio"
          accessibilityState={{ checked: editingMode === 'strict' }}
        >
          <View style={styles.modeHeader}>
            <Text style={[styles.modeTitle, editingMode === 'strict' && styles.modeTitleActive]}>Strict</Text>
            {editingMode === 'strict' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
          </View>
          <Text style={styles.modeDesc}>Members can only edit their own recipes. Admins can edit any.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeCard, editingMode === 'collaborative' && styles.modeCardActive]}
          onPress={() => setEditingMode('collaborative')}
          accessibilityRole="radio"
          accessibilityState={{ checked: editingMode === 'collaborative' }}
        >
          <View style={styles.modeHeader}>
            <Text style={[styles.modeTitle, editingMode === 'collaborative' && styles.modeTitleActive]}>Collaborative</Text>
            {editingMode === 'collaborative' && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
          </View>
          <Text style={styles.modeDesc}>All members can edit recipes. Viewers are read-only.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createBtn, isLoading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel="Create group"
        >
          {isLoading ? <ActivityIndicator color={Colors.bgWhite} /> : <Text style={styles.createBtnText}>Create Group</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted },
  navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  content: { padding: 20 },
  label: { fontSize: 14, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  input: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: 14, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 52 },
  error: { color: '#ef4444', fontSize: 13, fontFamily: FontFamily.regular, marginTop: 6 },
  modeCard: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  modeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  modeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modeTitle: { fontSize: 16, fontFamily: FontFamily.semibold, color: Colors.textSecondary },
  modeTitleActive: { color: Colors.primary },
  modeDesc: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, lineHeight: 18 },
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.xl, minHeight: 52 },
  btnDisabled: { opacity: 0.6 },
  createBtnText: { color: Colors.bgWhite, fontSize: 16, fontFamily: FontFamily.semibold },
});
