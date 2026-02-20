import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/features/groups/groupStore';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import RecipeCard from '@/components/RecipeCard';
import { Recipe } from '@/types';
import { FlashList } from '@shopify/flash-list';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { groups, updateGroup } = useGroupStore();
  const { recipes, loadAll } = useRecipeStore();

  const group = groups.find((g) => g.id === id);
  const groupRecipes = recipes.filter((r) => r.group_id === id);
  const isAdmin = group?.my_role === 'owner' || group?.my_role === 'admin';

  useEffect(() => { if (id) loadAll({ group_id: id } as { group_id: string }); }, [id]);

  const handleInvite = async () => {
    const link = `recipeorganizer://group/${id}/join`;
    await Share.share({ message: `Join my recipe group!\n${link}`, title: 'Recipe Group Invite' });
  };

  const handleToggleMode = () => {
    if (!group || !isAdmin) return;
    Alert.alert(
      'Change Editing Mode',
      `Switch to ${group.editing_mode === 'strict' ? 'Collaborative' : 'Strict'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => updateGroup(id!, { editing_mode: group.editing_mode === 'strict' ? 'collaborative' : 'strict' }),
        },
      ]
    );
  };

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{group.name}</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.navBtn} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={22} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      {/* Group header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{group.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.meta}>{group.member_count ?? 0} members</Text>
        </View>
        <TouchableOpacity
          style={[styles.modeBadge, { backgroundColor: group.editing_mode === 'collaborative' ? '#f0fdf4' : '#fff7ed' }]}
          onPress={isAdmin ? handleToggleMode : undefined}
          accessibilityLabel={`Editing mode: ${group.editing_mode}`}
        >
          <Text style={[styles.modeText, { color: group.editing_mode === 'collaborative' ? '#16a34a' : '#ea580c' }]}>
            {group.editing_mode === 'collaborative' ? 'Collaborative' : 'Strict'}
          </Text>
          {isAdmin && <Ionicons name="chevron-down" size={12} color={group.editing_mode === 'collaborative' ? '#16a34a' : '#ea580c'} />}
        </TouchableOpacity>
      </View>

      {/* Add recipe to group button */}
      {group.my_role !== 'viewer' && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/recipe/new', params: { group_id: id } })}
          accessibilityLabel="Add recipe to group"
        >
          <Ionicons name="add" size={18} color="#f97316" />
          <Text style={styles.addBtnText}>Add Recipe to Group</Text>
        </TouchableOpacity>
      )}

      <FlashList
        data={groupRecipes}
        estimatedItemSize={180}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Recipe }) => <RecipeCard recipe={item} variant="vertical" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recipes in this group yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94a3b8', fontFamily: 'Inter_400Regular' },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#f97316' },
  headerInfo: { flex: 1 },
  groupName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#0f172a' },
  meta: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 2 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  modeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fed7aa', minHeight: 48 },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#f97316' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#94a3b8' },
});
