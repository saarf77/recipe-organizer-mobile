import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import RecipeCard from '@/components/RecipeCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import { Recipe, Difficulty } from '@/types';

const DIFFICULTY_OPTIONS: Array<{ label: string; value: Difficulty | null }> = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

export default function RecipesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const {
    recipes, isLoading, categories,
    filters, setFilter, loadAll, loadCategories,
  } = useRecipeStore();

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadAll();
    loadCategories();
  }, []);

  useEffect(() => {
    if (params.category) {
      setFilter('category', params.category);
    }
  }, [params.category]);

  const onSearch = useCallback((text: string) => setFilter('search', text), []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Recipes</Text>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters((v) => !v)}
          accessibilityLabel="Toggle filters"
        >
          <Ionicons name="options-outline" size={20} color={showFilters ? '#f97316' : '#475569'} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes or ingredients..."
          placeholderTextColor="#94a3b8"
          value={filters.search}
          onChangeText={onSearch}
          returnKeyType="search"
          accessibilityLabel="Search recipes"
        />
        {filters.search.length > 0 && (
          <TouchableOpacity onPress={() => setFilter('search', '')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters panel */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          {/* Difficulty */}
          <Text style={styles.filterLabel}>Difficulty</Text>
          <View style={styles.chipRow}>
            {DIFFICULTY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={[styles.chip, filters.difficulty === opt.value && styles.chipActive]}
                onPress={() => setFilter('difficulty', opt.value)}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, filters.difficulty === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Categories */}
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, filters.category === null && styles.chipActive]}
              onPress={() => setFilter('category', null)}
            >
              <Text style={[styles.chipText, filters.category === null && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, filters.category === cat && styles.chipActive]}
                onPress={() => setFilter('category', cat)}
              >
                <Text style={[styles.chipText, filters.category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Favorites toggle */}
          <TouchableOpacity
            style={styles.favToggle}
            onPress={() => setFilter('is_favorite', !filters.is_favorite)}
          >
            <Ionicons
              name={filters.is_favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={filters.is_favorite ? '#f97316' : '#475569'}
            />
            <Text style={[styles.favToggleText, filters.is_favorite && styles.favToggleActive]}>
              Favorites only
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlashList
          data={recipes}
          estimatedItemSize={180}
          keyExtractor={(item) => item.id}
          numColumns={1}
          renderItem={({ item }: { item: Recipe }) => (
            <RecipeCard recipe={item} variant="vertical" />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🍽</Text>
              <Text style={styles.emptyTitle}>No recipes found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#0f172a' },
  filterToggle: { padding: 10, borderRadius: 10, backgroundColor: '#f1f5f9', minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  filterToggleActive: { backgroundColor: '#fff7ed' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', marginHorizontal: 16, marginVertical: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0', minHeight: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#0f172a', paddingVertical: 0 },
  filtersPanel: { backgroundColor: '#ffffff', marginHorizontal: 16, borderRadius: 14, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  filterLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#475569', marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', minHeight: 36 },
  chipActive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f97316' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569' },
  chipTextActive: { color: '#f97316' },
  favToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 44 },
  favToggleText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#475569' },
  favToggleActive: { color: '#f97316' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  skeletonGrid: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 4 },
});
