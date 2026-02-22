import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import RecipeCard from '@/components/RecipeCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { FlashList } from '@shopify/flash-list';
import { Recipe } from '@/types';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows, HOME_CATEGORIES } from '@/constants';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const {
    recentRecipes,
    favoriteRecipes,
    isLoading,
    loadRecent,
    loadFavorites,
    loadRandom,
  } = useRecipeStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useFocusEffect(useCallback(() => {
    loadRecent();
    loadFavorites();
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRecent(), loadFavorites()]);
    setRefreshing(false);
  }, []);

  const handleRandomRecipe = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadRandom();
    const picked = useRecipeStore.getState().randomRecipe;
    if (picked) router.push(`/recipe/${picked.id}`);
  };

  const handleCategoryPress = (label: string) => {
    router.push({ pathname: '/(tabs)/recipes', params: { category: label } });
  };

  const greeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{user?.display_name ?? 'Chef'} 👋</Text>
            <Text style={styles.subtitle}>What are you cooking today?</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.randomBtn}
              onPress={handleRandomRecipe}
              accessibilityLabel="Get a random recipe"
            >
              <Text style={styles.randomBtnIcon}>🎲</Text>
              <Text style={styles.randomBtnText}>Surprise me</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Quick search shortcut ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)/recipes')}
          accessibilityRole="button"
          accessibilityLabel="Search recipes"
        >
          <Ionicons name="search-outline" size={18} color={Colors.textFaint} />
          <Text style={styles.searchPlaceholder}>Search recipes, ingredients...</Text>
        </TouchableOpacity>

        {/* ─── Categories ─────────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {HOME_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={[styles.categoryTile, { backgroundColor: cat.bg }]}
              onPress={() => handleCategoryPress(cat.label)}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${cat.label}`}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
              <Text style={[styles.categoryLabel, { color: cat.accent }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Quick Actions ───────────────────────────────────────────────────── */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/meal-plan')}
            accessibilityLabel="Open meal planner"
          >
            <Text style={styles.quickActionEmoji}>📅</Text>
            <Text style={styles.quickActionLabel}>Meal Planner</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/shopping')}
            accessibilityLabel="Open shopping list"
          >
            <Text style={styles.quickActionEmoji}>🛒</Text>
            <Text style={styles.quickActionLabel}>Shopping List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/recipe/import-url')}
            accessibilityLabel="Import recipe from URL"
          >
            <Text style={styles.quickActionEmoji}>🔗</Text>
            <Text style={styles.quickActionLabel}>Import URL</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Recently Added ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <TouchableOpacity
              style={styles.seeAllBtn}
              onPress={() => router.push('/(tabs)/recipes')}
            >
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.skeletonRow}>
              {[0, 1].map((i) => <SkeletonCard key={i} />)}
            </View>
          ) : recentRecipes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🥘</Text>
              <Text style={styles.emptyTitle}>No recipes yet</Text>
              <Text style={styles.emptySubtitle}>Add your first recipe to get started</Text>
              <TouchableOpacity
                style={styles.addFirstBtn}
                onPress={() => router.push('/recipe/add')}
              >
                <Ionicons name="add" size={18} color={Colors.bgWhite} />
                <Text style={styles.addFirstBtnText}>Add Recipe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlashList
              data={recentRecipes}
              horizontal
              estimatedItemSize={197}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: Recipe }) => (
                <RecipeCard recipe={item} variant="horizontal" />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizListContent}
            />
          )}
        </View>

        {/* ─── Favorites ───────────────────────────────────────────────────────── */}
        {favoriteRecipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={16} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Your Favorites</Text>
              </View>
            </View>
            <FlashList
              data={favoriteRecipes}
              horizontal
              estimatedItemSize={197}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: Recipe }) => (
                <RecipeCard recipe={item} variant="horizontal" />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizListContent}
            />
          </View>
        )}

        {/* Bottom spacer for FAB */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  scroll: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  headerLeft: { flex: 1 },
  headerActions: { paddingTop: Spacing.xs },
  greeting: { fontSize: FontSize.sm.size - 1, color: Colors.textFaint, fontFamily: FontFamily.regular },
  name: { fontSize: 26, color: Colors.textPrimary, fontFamily: FontFamily.bold, marginTop: 2 },
  subtitle: { fontSize: FontSize.sm.size - 1, color: Colors.textSlate, fontFamily: FontFamily.regular, marginTop: 3 },

  randomBtn: {
    backgroundColor: Colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md / 2,
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 22,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  randomBtnIcon: { fontSize: Spacing.lg },
  randomBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: FontSize.sm.size - 1 },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row', gap: Spacing.sm + 2,
    paddingHorizontal: 20, marginBottom: Spacing.xl,
  },
  quickActionCard: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.md / 2, paddingVertical: 14,
    backgroundColor: Colors.bgWhite, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.bgMuted,
    ...Shadows.card,
  },
  quickActionEmoji: { fontSize: Spacing.xl },
  quickActionLabel: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold, color: Colors.textSecondary, textAlign: 'center' },

  // Search shortcut
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    backgroundColor: Colors.bgWhite,
    marginHorizontal: 20,
    marginBottom: Spacing.xl,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  searchPlaceholder: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textFaint },

  // Categories
  categoryRow: { paddingLeft: 20, paddingRight: Spacing.sm, paddingBottom: Spacing.xs },
  categoryTile: {
    width: 90,
    paddingVertical: 14,
    borderRadius: Radii.lg,
    alignItems: 'center',
    gap: Spacing.md / 2,
    marginRight: Spacing.sm + 2,
    ...Shadows.card,
  },
  categoryEmoji: { fontSize: 26 },
  categoryLabel: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold },

  // Sections
  section: { marginTop: 28, paddingHorizontal: 0 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md / 2 },
  sectionTitle: { fontSize: 19, color: Colors.textPrimary, fontFamily: FontFamily.bold },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  seeAllText: { fontSize: FontSize.sm.size - 1, color: Colors.primary, fontFamily: FontFamily.semibold },
  horizListContent: { paddingLeft: 20, paddingRight: Spacing.sm },
  skeletonRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: 20 },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.xl,
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bgMuted,
  },
  emptyEmoji: { fontSize: 44, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 17, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md / 2 },
  emptySubtitle: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.regular, color: Colors.textFaint, textAlign: 'center', marginBottom: 18 },
  addFirstBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md / 2,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
  },
  addFirstBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: FontSize.sm.size },
});
