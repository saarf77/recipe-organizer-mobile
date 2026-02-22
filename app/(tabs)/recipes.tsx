import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import RecipeCard from '@/components/RecipeCard';
import { Recipe, Difficulty } from '@/types';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

const COL_GAP = 10;
const H_PADDING = 16;

function getNumColumns(width: number): number {
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

const DIFFICULTY_OPTIONS: Array<{ label: string; value: Difficulty | null; emoji: string }> = [
  { label: 'All',    value: null,     emoji: '✨' },
  { label: 'Easy',   value: 'easy',   emoji: '🟢' },
  { label: 'Medium', value: 'medium', emoji: '🟡' },
  { label: 'Hard',   value: 'hard',   emoji: '🔴' },
];

const DIETARY_OPTIONS: Array<{ label: string; value: string; emoji: string }> = [
  { label: 'Vegan',       value: 'vegan',       emoji: '🌱' },
  { label: 'Vegetarian',  value: 'vegetarian',  emoji: '🥦' },
  { label: 'Gluten-free', value: 'gluten-free', emoji: '🌾' },
  { label: 'Dairy-free',  value: 'dairy-free',  emoji: '🥛' },
  { label: 'Keto',        value: 'keto',        emoji: '🥩' },
  { label: 'Paleo',       value: 'paleo',       emoji: '🦴' },
];

export default function RecipesScreen() {
  const { width } = useWindowDimensions();
  const numColumns = getNumColumns(width);
  const gridItemWidth = (width - H_PADDING * 2 - COL_GAP * (numColumns - 1)) / numColumns;

  const params = useLocalSearchParams<{ category?: string }>();
  const {
    recipes, isLoading, categories,
    filters, setFilter, loadAll, loadCategories, deleteRecipe,
    ingredientSearchResults, ingredientSearchTerm, searchByIngredient,
  } = useRecipeStore();

  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchMode, setSearchMode] = useState<'title' | 'ingredient'>('title');

  useFocusEffect(useCallback(() => {
    loadAll();
    loadCategories();
  }, []));

  useEffect(() => {
    if (params.category) {
      setFilter('category', params.category);
    }
  }, [params.category]);

  const searchValue = searchMode === 'ingredient' ? ingredientSearchTerm : filters.search;
  // When in ingredient mode with no search term, show the full recipe list instead of empty
  const displayRecipes = (searchMode === 'ingredient' && ingredientSearchTerm.trim())
    ? ingredientSearchResults
    : recipes;

  // Exit select mode when recipes list changes significantly
  useEffect(() => {
    if (selectMode && displayRecipes.length === 0) {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [displayRecipes.length]);

  const onSearch = useCallback((text: string) => {
    if (searchMode === 'ingredient') {
      void searchByIngredient(text);
    } else {
      setFilter('search', text);
    }
  }, [searchMode, searchByIngredient, setFilter]);

  const handleSwitchSearchMode = useCallback((mode: 'title' | 'ingredient') => {
    setSearchMode(mode);
    // Clear the other mode's state and refresh
    if (mode === 'ingredient') {
      setFilter('search', '');
    } else {
      void searchByIngredient('');
      void loadAll();
    }
    Haptics.selectionAsync();
  }, [setFilter, searchByIngredient, loadAll]);

  const toggleDietary = useCallback((value: string) => {
    const current = filters.dietary ?? [];
    const next = current.includes(value)
      ? current.filter((d) => d !== value)
      : [...current, value];
    setFilter('dietary', next);
  }, [filters.dietary, setFilter]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === displayRecipes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRecipes.map((r) => r.id)));
    }
    Haptics.selectionAsync();
  }, [displayRecipes, selectedIds.size]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      `Delete ${selectedIds.size} recipe${selectedIds.size !== 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const ids = Array.from(selectedIds);
            const errors: string[] = [];
            for (const id of ids) {
              try { await deleteRecipe(id); }
              catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
            }
            setIsDeleting(false);
            setSelectMode(false);
            setSelectedIds(new Set());
            if (errors.length > 0) {
              Alert.alert('Some deletions failed', errors.join('\n'));
            }
          },
        },
      ],
    );
  }, [selectedIds, deleteRecipe]);

  const activeFilterChips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...(filters.difficulty !== null
      ? [{
          key: 'difficulty',
          label: DIFFICULTY_OPTIONS.find((o) => o.value === filters.difficulty)?.emoji
            + ' ' + DIFFICULTY_OPTIONS.find((o) => o.value === filters.difficulty)?.label,
          onRemove: () => setFilter('difficulty', null),
        }]
      : []),
    ...(filters.category !== null
      ? [{ key: 'category', label: filters.category, onRemove: () => setFilter('category', null) }]
      : []),
    ...(filters.is_favorite
      ? [{ key: 'favorite', label: '♥ Favorites', onRemove: () => setFilter('is_favorite', false) }]
      : []),
    ...(filters.dietary ?? []).map((d) => ({
      key: `dietary-${d}`,
      label: (DIETARY_OPTIONS.find((o) => o.value === d)?.emoji ?? '') + ' ' + d,
      onRemove: () => toggleDietary(d),
    })),
  ];

  const activeFilterCount = activeFilterChips.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Top bar ────────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Recipes</Text>
        <View style={styles.topBarActions}>
          {selectMode ? (
            <>
              <TouchableOpacity
                style={styles.selectAllBtn}
                onPress={handleSelectAll}
              >
                <Text style={styles.selectAllText}>
                  {selectedIds.size === displayRecipes.length ? 'Deselect all' : 'Select all'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteSelectedBtn, selectedIds.size === 0 && styles.deleteSelectedBtnDisabled]}
                onPress={handleBulkDelete}
                disabled={selectedIds.size === 0 || isDeleting}
              >
                <Ionicons name="trash-outline" size={18} color={selectedIds.size === 0 ? Colors.textFaint : Colors.danger} />
                {selectedIds.size > 0 && <Text style={styles.deleteSelectedCount}>{selectedIds.size}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelSelectBtn} onPress={toggleSelectMode}>
                <Text style={styles.cancelSelectText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>

      {/* ─── Search ─────────────────────────────────────────────────────────── */}
      {!selectMode && (
        <>
          <View style={styles.searchModeRow}>
            <TouchableOpacity
              style={[styles.searchModeBtn, searchMode === 'title' && styles.searchModeBtnActive]}
              onPress={() => handleSwitchSearchMode('title')}
              accessibilityRole="button"
              accessibilityLabel="Search by title"
            >
              <Ionicons name="text-outline" size={13} color={searchMode === 'title' ? Colors.primary : Colors.textFaint} />
              <Text style={[styles.searchModeBtnText, searchMode === 'title' && styles.searchModeBtnTextActive]}>By Title</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchModeBtn, searchMode === 'ingredient' && styles.searchModeBtnActive]}
              onPress={() => handleSwitchSearchMode('ingredient')}
              accessibilityRole="button"
              accessibilityLabel="Search by ingredient"
            >
              <Ionicons name="leaf-outline" size={13} color={searchMode === 'ingredient' ? Colors.primary : Colors.textFaint} />
              <Text style={[styles.searchModeBtnText, searchMode === 'ingredient' && styles.searchModeBtnTextActive]}>By Ingredient</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, showFilters && styles.filterPillActive]}
              onPress={() => setShowFilters((v) => !v)}
              accessibilityLabel="Toggle filters"
            >
              <Ionicons name="options-outline" size={13} color={showFilters ? Colors.primary : Colors.textFaint} />
              <Text style={[styles.searchModeBtnText, showFilters && styles.searchModeBtnTextActive]}>Filter</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterPillBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={Colors.textFaint} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchMode === 'ingredient' ? 'e.g. garlic, chicken...' : 'Search recipes...'}
              placeholderTextColor={Colors.textFaint}
              value={searchValue}
              onChangeText={onSearch}
              returnKeyType="search"
              accessibilityLabel={searchMode === 'ingredient' ? 'Search by ingredient' : 'Search recipes'}
            />
            {searchValue.length > 0 && (
              <TouchableOpacity
                onPress={() => onSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ─── Active filter chips strip ──────────────────────────────────────── */}
      {!showFilters && !selectMode && activeFilterChips.length > 0 && (
        <View style={styles.activeChipsScroll}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsRow}
          >
            {activeFilterChips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={styles.activeChip}
                onPress={() => { chip.onRemove(); Haptics.selectionAsync(); }}
              >
                <Text style={styles.activeChipText}>{chip.label}</Text>
                <Ionicons name="close" size={12} color={Colors.primaryMid} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ─── Filters panel ──────────────────────────────────────────────────── */}
      {showFilters && !selectMode && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Difficulty</Text>
            <View style={styles.chipRow}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.chip, filters.difficulty === opt.value && styles.chipActive]}
                  onPress={() => setFilter('difficulty', filters.difficulty === opt.value ? null : opt.value)}
                  accessibilityRole="button"
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.chipText, filters.difficulty === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Dietary</Text>
            <View style={styles.chipRow}>
              {DIETARY_OPTIONS.map((opt) => {
                const active = (filters.dietary ?? []).includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleDietary(opt.value)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {categories.length > 0 && (
            <View style={styles.filterSection}>
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
                    onPress={() => setFilter('category', filters.category === cat ? null : cat)}
                  >
                    <Text style={[styles.chipText, filters.category === cat && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.favToggle, filters.is_favorite && styles.favToggleActive]}
            onPress={() => setFilter('is_favorite', !filters.is_favorite)}
          >
            <Ionicons
              name={filters.is_favorite ? 'heart' : 'heart-outline'}
              size={16}
              color={filters.is_favorite ? Colors.bgWhite : Colors.primary}
            />
            <Text style={[styles.favToggleText, filters.is_favorite && styles.favToggleTextActive]}>
              Favorites only
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Select mode banner ─────────────────────────────────────────────── */}
      {selectMode && (
        <View style={styles.selectBanner}>
          <Text style={styles.selectBannerText}>
            {selectedIds.size === 0 ? 'Tap recipes to select' : `${selectedIds.size} selected`}
          </Text>
        </View>
      )}

      {/* ─── Recipe count ───────────────────────────────────────────────────── */}
      {!isLoading && displayRecipes.length > 0 && !selectMode && (
        <Text style={styles.countText}>
          {displayRecipes.length} recipe{displayRecipes.length !== 1 ? 's' : ''}
          {searchMode === 'ingredient' && ingredientSearchTerm ? ` with "${ingredientSearchTerm}"` : ''}
        </Text>
      )}

      {/* ─── Grid list ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.skeletonCard, { width: gridItemWidth }]} />
          ))}
        </View>
      ) : (
        <FlashList
          data={displayRecipes}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={String(numColumns)}
          renderItem={({ item }: { item: Recipe }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.gridItemWrap, isSelected && styles.gridItemSelected]}
                onPress={selectMode ? () => toggleSelect(item.id) : undefined}
                onLongPress={!selectMode ? () => { setSelectMode(true); toggleSelect(item.id); } : undefined}
                activeOpacity={selectMode ? 0.7 : 1}
              >
                {/* pointerEvents="none" blocks inner card gestures in select mode
                    so touches reach the outer TouchableOpacity instead */}
                <View pointerEvents={selectMode ? 'none' : 'box-none'}>
                  <RecipeCard recipe={item} variant="grid" />
                </View>
                {selectMode && (
                  <View
                    pointerEvents="none"
                    style={[styles.selectionOverlay, isSelected && styles.selectionOverlayActive]}
                  >
                    <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={Colors.bgWhite} />}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No recipes found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your filters or search</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  style={styles.clearFiltersBtn}
                  onPress={() => {
                    setFilter('difficulty', null);
                    setFilter('category', null);
                    setFilter('is_favorite', false);
                    setFilter('search', '');
                    setFilter('dietary', []);
                  }}
                >
                  <Text style={styles.clearFiltersBtnText}>Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: H_PADDING,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgMuted,
    minHeight: 34,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  filterPillBadge: {
    width: 16,
    height: 16,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontFamily: FontFamily.bold, color: Colors.bgWhite },

  // Bulk select toolbar
  selectAllBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Spacing.sm + 2, backgroundColor: Colors.bgMuted,
  },
  selectAllText: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  deleteSelectedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Spacing.sm + 2, backgroundColor: '#fee2e2',
    minHeight: 40,
  },
  deleteSelectedBtnDisabled: { backgroundColor: Colors.bgMuted },
  deleteSelectedCount: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.danger },
  cancelSelectBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Spacing.sm + 2, backgroundColor: Colors.primary,
  },
  cancelSelectText: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.semibold, color: Colors.bgWhite },

  selectBanner: {
    backgroundColor: Colors.primaryBg, marginHorizontal: H_PADDING, marginBottom: Spacing.sm,
    paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: Spacing.sm + 2,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  selectBannerText: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.medium, color: Colors.primary, textAlign: 'center' },

  searchModeRow: {
    flexDirection: 'row',
    marginHorizontal: H_PADDING,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  searchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgMuted,
    minHeight: 34,
  },
  searchModeBtnActive: {
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  searchModeBtnText: {
    fontSize: FontSize.sm.size - 1,
    fontFamily: FontFamily.medium,
    color: Colors.textFaint,
  },
  searchModeBtnTextActive: {
    color: Colors.primary,
    fontFamily: FontFamily.semibold,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgWhite,
    marginHorizontal: H_PADDING,
    marginVertical: Spacing.sm,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 50,
    ...Shadows.card,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, paddingVertical: 0 },

  filtersPanel: {
    backgroundColor: Colors.bgWhite,
    marginHorizontal: H_PADDING,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.card,
    gap: Spacing.md,
  },
  filterSection: { gap: Spacing.sm },
  filterLabel: { fontSize: FontSize.xs.size, fontFamily: FontFamily.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md / 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgMuted,
    minHeight: 34,
  },
  chipActive: { backgroundColor: Colors.primaryBg, borderWidth: 1.5, borderColor: Colors.primary },
  chipEmoji: { fontSize: 11 },
  chipText: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontFamily: FontFamily.semibold },
  favToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.md,
    alignSelf: 'flex-start',
  },
  favToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  favToggleText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.primary },
  favToggleTextActive: { color: Colors.bgWhite, fontFamily: FontFamily.semibold },

  activeChipsScroll: { height: 38, marginBottom: 2 },
  activeChipsRow: {
    paddingHorizontal: H_PADDING,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radii.full,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBgBorder,
  },
  activeChipText: {
    fontSize: FontSize.sm.size - 1,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },

  countText: {
    paddingHorizontal: 20,
    paddingBottom: Spacing.sm,
    fontSize: FontSize.sm.size - 1,
    fontFamily: FontFamily.regular,
    color: Colors.textFaint,
  },

  listContent: { paddingHorizontal: H_PADDING, paddingBottom: 120, paddingTop: Spacing.xs },
  gridItemWrap: { flex: 1, margin: COL_GAP / 2, position: 'relative' },
  gridItemSelected: { opacity: 0.85 },

  // Selection overlay
  selectionOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10, alignItems: 'flex-end', padding: Spacing.sm,
    borderRadius: Radii.lg, borderWidth: 2.5, borderColor: 'transparent',
  },
  selectionOverlayActive: { borderColor: Colors.primary, backgroundColor: 'rgba(56,102,65,0.08)' },
  selectionCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.bgWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  selectionCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },

  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: H_PADDING,
    gap: COL_GAP,
  },
  skeletonCard: {
    height: 180,
    borderRadius: Radii.lg,
    backgroundColor: Colors.border,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyIcon: { fontSize: 52, marginBottom: Spacing.xs },
  emptyTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  emptySubtitle: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textFaint },
  clearFiltersBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
  },
  clearFiltersBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: FontSize.sm.size },
});
