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
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import RecipeCard from '@/components/RecipeCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { FlashList } from '@shopify/flash-list';
import { Recipe } from '@/types';

const QUICK_FILTERS = ['Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snacks', 'Drinks'];

export default function HomeScreen() {
  const { user } = useAuthStore();
  const {
    recentRecipes,
    favoriteRecipes,
    isLoading,
    loadRecent,
    loadFavorites,
    loadRandom,
    randomRecipe,
  } = useRecipeStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadRecent();
    loadFavorites();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRecent(), loadFavorites()]);
    setRefreshing(false);
  }, []);

  const handleRandomRecipe = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRandom();
    if (randomRecipe) router.push(`/recipe/${randomRecipe.id}`);
  };

  const handleFilterPress = (filter: string) => {
    router.push({ pathname: '/(tabs)/recipes', params: { category: filter } });
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{user?.display_name ?? 'Chef'} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.randomBtn}
            onPress={handleRandomRecipe}
            accessibilityLabel="Get a random recipe"
          >
            <Text style={styles.randomBtnText}>🎲 Random</Text>
          </TouchableOpacity>
        </View>

        {/* Quick filters */}
        <View>
          <Text style={styles.sectionTitle}>Browse by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {QUICK_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={styles.filterChip}
                onPress={() => handleFilterPress(f)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${f}`}
              >
                <Text style={styles.filterChipText}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recently Added */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/recipes')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.skeletonRow}>
              {[0, 1].map((i) => <SkeletonCard key={i} />)}
            </View>
          ) : recentRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recipes yet.</Text>
              <TouchableOpacity
                style={styles.addFirstBtn}
                onPress={() => router.push('/recipe/new')}
              >
                <Text style={styles.addFirstBtnText}>Add your first recipe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlashList
              data={recentRecipes}
              horizontal
              estimatedItemSize={220}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: Recipe }) => (
                <RecipeCard recipe={item} variant="horizontal" />
              )}
              showsHorizontalScrollIndicator={false}
            />
          )}
        </View>

        {/* Favorites */}
        {favoriteRecipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Favorites</Text>
            </View>
            <FlashList
              data={favoriteRecipes}
              horizontal
              estimatedItemSize={220}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: Recipe }) => (
                <RecipeCard recipe={item} variant="horizontal" />
              )}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, color: '#94a3b8', fontFamily: 'Inter_400Regular' },
  name: { fontSize: 24, color: '#0f172a', fontFamily: 'Inter_700Bold', marginTop: 2 },
  randomBtn: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
    minHeight: 44,
    justifyContent: 'center',
  },
  randomBtnText: { color: '#ea580c', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8 },
  filterChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
    justifyContent: 'center',
  },
  filterChipText: { color: '#0f172a', fontFamily: 'Inter_500Medium', fontSize: 14 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, color: '#0f172a', fontFamily: 'Inter_700Bold' },
  seeAll: { fontSize: 14, color: '#f97316', fontFamily: 'Inter_500Medium' },
  skeletonRow: { flexDirection: 'row', gap: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: '#94a3b8', fontFamily: 'Inter_400Regular', fontSize: 15, marginBottom: 12 },
  addFirstBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  addFirstBtnText: { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
