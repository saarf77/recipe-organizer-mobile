import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/features/groups/groupStore';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import RecipeCard from '@/components/RecipeCard';
import { Recipe } from '@/types';
import { FlashList } from '@shopify/flash-list';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { groups, isLoading: groupsLoading, loadAll: loadGroups, updateGroup } = useGroupStore();
  const { recipes, isLoading: recipesLoading, loadAll: loadRecipes } = useRecipeStore();

  useEffect(() => {
    if (!id) return;
    // Load groups if the store is empty (e.g. deep-linked directly to this screen)
    if (groups.length === 0) loadGroups();
    loadRecipes({ group_id: id });
  }, [id]);

  const group = groups.find((g) => g.id === id);
  const groupRecipes = recipes.filter((r) => r.group_id === id);
  const isAdmin = group?.my_role === 'owner' || group?.my_role === 'admin';

  const handleInvite = async () => {
    const link = `recipeorganizer://group/join?id=${id}`;
    await Share.share({
      message: `Join my recipe group "${group?.name}"!\nOpen this link to join: ${link}`,
      title: 'Recipe Group Invite',
    });
  };

  const handleToggleMode = () => {
    if (!group || !isAdmin || !id) return;
    const next = group.editing_mode === 'strict' ? 'collaborative' : 'strict';
    Alert.alert(
      'Change Editing Mode',
      `Switch to ${next === 'collaborative' ? 'Collaborative' : 'Strict'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: () => {
            updateGroup(id, { editing_mode: next }).catch((e) => {
              Alert.alert('Error', 'Failed to update group mode. Please try again.');
              console.warn('[Group] updateGroup error', e);
            });
          },
        },
      ]
    );
  };

  if (groupsLoading || (!group && groups.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Group not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{group.name}</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.navBtn} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={22} color={Colors.textPrimary} />
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
          style={[styles.modeBadge, { backgroundColor: group.editing_mode === 'collaborative' ? '#f0fdf4' : Colors.primaryBg }]}
          onPress={isAdmin ? handleToggleMode : undefined}
          accessibilityLabel={`Editing mode: ${group.editing_mode}`}
        >
          <Text style={[styles.modeText, { color: group.editing_mode === 'collaborative' ? '#16a34a' : Colors.primary }]}>
            {group.editing_mode === 'collaborative' ? 'Collaborative' : 'Strict'}
          </Text>
          {isAdmin && <Ionicons name="chevron-down" size={12} color={group.editing_mode === 'collaborative' ? '#16a34a' : Colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* Action buttons row */}
      <View style={styles.actionRow}>
        {group.my_role !== 'viewer' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={() => router.push({ pathname: '/recipe/new', params: { group_id: id } })}
            accessibilityLabel="Add recipe to group"
          >
            <Ionicons name="add" size={18} color={Colors.primary} />
            <Text style={styles.addBtnText}>Add Recipe</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnFilled]}
          onPress={() => router.push({ pathname: '/group/shopping/[id]', params: { id } })}
          accessibilityLabel="Group shopping list"
        >
          <Ionicons name="cart-outline" size={18} color={Colors.bgWhite} />
          <Text style={styles.shoppingBtnText}>Shopping List</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={groupRecipes}
        estimatedItemSize={180}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: Recipe }) => <RecipeCard recipe={item} variant="vertical" />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          recipesLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recipes in this group yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textFaint, fontFamily: FontFamily.regular },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.primary },
  headerInfo: { flex: 1 },
  groupName: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  meta: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 2 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.md },
  modeText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold },
  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 12, padding: Spacing.md, minHeight: 48 },
  actionBtnOutline: { backgroundColor: Colors.primaryBg, borderWidth: 1, borderColor: Colors.primaryBorder },
  actionBtnFilled: { backgroundColor: Colors.primary },
  addBtnText: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.primary },
  shoppingBtnText: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.bgWhite },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 80 },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textFaint },
});
