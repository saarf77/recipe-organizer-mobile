import React, { useEffect, useState, useCallback } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, // Switch used in keep-awake row
  StyleSheet, Image, Share, ActivityIndicator, Modal, FlatList,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import { Platform } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import { useCollectionStore } from '@/features/collections/collectionStore';
import { useShoppingStore } from '@/features/shopping/shoppingStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { convertForDisplay } from '@/utils/unitConversion';
import { Ingredient, Step } from '@/types';
import { Colors, DifficultyColors, Spacing, Radii, FontFamily, FontSize, Shadows, DietaryTagMap } from '@/constants';

const SCREEN_WIDTH = Dimensions.get('window').width;

const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

function smartRound(n: number): string {
  if (n <= 0) return parseFloat(n.toFixed(2)).toString();
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return parseFloat(n.toFixed(1)).toString();
  if (n >= 1) return parseFloat(n.toFixed(1)).toString();
  return parseFloat(n.toPrecision(2)).toString();
}

function scaleQuantity(qty: string | null, scale: number): string | null {
  if (qty === null || scale === 1) return qty;
  // Handle fractions like "1/2", "3/4"
  const fracMatch = qty.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const val = parseInt(fracMatch[1]!) / parseInt(fracMatch[2]!);
    return smartRound(val * scale);
  }
  // Handle mixed numbers like "1 1/2"
  const mixedMatch = qty.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const val = parseInt(mixedMatch[1]!) + parseInt(mixedMatch[2]!) / parseInt(mixedMatch[3]!);
    return smartRound(val * scale);
  }
  const num = parseFloat(qty);
  if (isNaN(num)) return qty;
  return smartRound(num * scale);
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { fetchById, toggleFavorite, deleteRecipe } = useRecipeStore();
  const { collections, loadAll: loadCollections, addRecipe: addToCollection } = useCollectionStore();
  const { addFromRecipe: addIngredientsToShoppingList } = useShoppingStore();
  const { unitSystem } = useSettingsStore();

  const [recipe, setRecipe] = useState(useRecipeStore.getState().currentRecipe);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [cookingMode, setCookingMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [collectionModal, setCollectionModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<string | null>(null);
  const [servingsScale, setServingsScale] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [keepAwake, setKeepAwake] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  async function loadRecipe(showRefresh = false) {
    if (!id) return;
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    await fetchById(id);
    setRecipe(useRecipeStore.getState().currentRecipe);
    if (showRefresh) setIsRefreshing(false);
    else setIsLoading(false);
    setServingsScale(1);
  }

  useEffect(() => { loadRecipe(); }, [id]);

  const handleRefresh = useCallback(() => loadRecipe(true), [id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (cookingMode || keepAwake) {
      KeepAwake.activateKeepAwakeAsync();
    } else {
      KeepAwake.deactivateKeepAwake();
    }
    return () => { KeepAwake.deactivateKeepAwake(); };
  }, [cookingMode, keepAwake]);

  const handleOpenCollectionModal = useCallback(async () => {
    await loadCollections();
    setCollectionModal(true);
  }, [loadCollections]);

  const handleAddToCollection = useCallback(async (collectionId: string) => {
    if (!recipe) return;
    setAddingToCollection(collectionId);
    await addToCollection(collectionId, recipe.id);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddingToCollection(null);
    setCollectionModal(false);
  }, [recipe, addToCollection]);

  const handleToggleFavorite = async () => {
    if (!recipe) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(recipe.id);
    setRecipe((r) => r ? { ...r, is_favorite: !r.is_favorite } : r);
  };

  const handleDelete = () => setDeleteModal(true);

  const confirmDelete = async () => {
    setDeleteModal(false);
    try {
      await deleteRecipe(recipe!.id);
      goBack();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not delete.', 'error');
    }
  };

  const handleShare = async () => {
    if (!recipe) return;
    const scaledServings = recipe.servings != null ? Math.round(recipe.servings * servingsScale) : null;
    const text = [
      `🍳 ${recipe.title}`,
      recipe.description ?? '',
      '',
      `⏱ Prep: ${recipe.prep_time_minutes ?? '?'} min | Cook: ${recipe.cook_time_minutes ?? '?'} min`,
      scaledServings != null ? `👥 Serves: ${scaledServings}` : '',
      '',
      '📋 Ingredients:',
      ...(recipe.ingredients ?? []).map((i) => {
        const qty = scaleQuantity(i.quantity, servingsScale);
        const { quantity: dQty, unit: dUnit } = convertForDisplay(qty, i.unit, unitSystem);
        return `• ${[dQty, dUnit, i.name].filter(Boolean).join(' ')}`.trim();
      }),
      '',
      '📝 Steps:',
      ...(recipe.steps ?? []).map((s, idx) => `${idx + 1}. ${s.instruction}`),
    ].filter((l) => l !== '').join('\n');
    await Share.share({ message: text, title: recipe.title });
  };

  const handleAddToShoppingList = () => {
    if (!recipe) return;
    const ingredients = recipe.ingredients ?? [];
    if (ingredients.length === 0) {
      showToast('This recipe has no ingredients', 'info');
      return;
    }
    const added = addIngredientsToShoppingList(recipe.id, recipe.title, ingredients, servingsScale);
    if (added === 0) {
      showToast('Already in your shopping list', 'info');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`${added} ingredient${added !== 1 ? 's' : ''} added to shopping list`, 'success');
  };

  const toggleIngredient = (ingId: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId); else next.add(ingId);
      return next;
    });
    Haptics.selectionAsync();
  };

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId); else next.add(stepId);
      return next;
    });
    Haptics.selectionAsync();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.errorText}>Recipe not found</Text>
      </View>
    );
  }

  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const completedCount = completedSteps.size;
  const totalSteps = recipe.steps?.length ?? 0;
  const baseServings = recipe.servings ?? 1;
  const displayServings = Math.max(1, Math.round(baseServings * servingsScale));

  return (
    <SafeAreaView style={[styles.container, cookingMode && styles.cookingModeContainer]} edges={['top', 'bottom']}>
      {/* Floating navbar — overlays hero */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navBtn} onPress={handleToggleFavorite} accessibilityLabel="Toggle favorite">
            <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={22} color={recipe.is_favorite ? Colors.danger : Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={handleOpenCollectionModal} accessibilityLabel="Add to collection">
            <Ionicons name="bookmark-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={handleAddToShoppingList} accessibilityLabel="Add to shopping list">
            <Ionicons name="cart-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={handleShare} accessibilityLabel="Share recipe">
            <Ionicons name="share-outline" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          {user?.id === recipe.owner_user_id && (
            <>
              <TouchableOpacity style={styles.navBtn} onPress={() => router.push(`/recipe/edit/${recipe.id}`)} accessibilityLabel="Edit recipe">
                <Ionicons name="pencil-outline" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.navBtn} onPress={handleDelete} accessibilityLabel="Delete recipe">
                <Ionicons name="trash-outline" size={22} color={Colors.danger} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {/* Hero gallery */}
        {recipe.images && recipe.images.length > 0 ? (
          <View>
            <FlatList
              data={recipe.images}
              keyExtractor={(img) => img.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setGalleryIndex(idx);
              }}
              renderItem={({ item }) => {
                const uri = item.local_uri ?? item.storage_path;
                return (
                  <Image
                    source={{ uri }}
                    style={styles.hero}
                    resizeMode="cover"
                    accessibilityLabel={`Photo of ${recipe.title}`}
                  />
                );
              }}
            />
            {recipe.images.length > 1 && (
              <View style={styles.dotRow}>
                {recipe.images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroEmoji}>🍽</Text>
          </View>
        )}

        <View style={[styles.content, cookingMode && styles.cookingContent]}>
          {/* Title */}
          <Animated.Text entering={FadeIn} style={[styles.title, cookingMode && styles.cookingTitle]}>
            {recipe.title}
          </Animated.Text>

          {/* Badges row */}
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${DifficultyColors[recipe.difficulty]}18` }]}>
              <View style={[styles.diffDot, { backgroundColor: DifficultyColors[recipe.difficulty] }]} />
              <Text style={[styles.badgeText, { color: DifficultyColors[recipe.difficulty] }]}>
                {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
              </Text>
            </View>
            {recipe.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{recipe.category}</Text>
              </View>
            )}
            {recipe.cuisine && (
              <View style={styles.cuisineBadge}>
                <Text style={styles.cuisineBadgeText}>{recipe.cuisine}</Text>
              </View>
            )}
            {!recipe.group_id && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={11} color={Colors.privateGreen} />
                <Text style={styles.privateText}>Private</Text>
              </View>
            )}
          </View>

          {/* Meta row */}
          <View style={[styles.metaCard, cookingMode && styles.cookingMetaCard]}>
            {recipe.prep_time_minutes != null && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={[styles.metaValue, cookingMode && styles.cookingMetaValue]}>{recipe.prep_time_minutes}m</Text>
                <Text style={[styles.metaLabel, cookingMode && styles.cookingMetaLabel]}>Prep</Text>
              </View>
            )}
            {recipe.cook_time_minutes != null && (
              <>
                {recipe.prep_time_minutes != null && <View style={styles.metaDivider} />}
                <View style={styles.metaItem}>
                  <Ionicons name="flame-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.metaValue, cookingMode && styles.cookingMetaValue]}>{recipe.cook_time_minutes}m</Text>
                  <Text style={[styles.metaLabel, cookingMode && styles.cookingMetaLabel]}>Cook</Text>
                </View>
              </>
            )}
            {totalTime > 0 && (recipe.prep_time_minutes != null || recipe.cook_time_minutes != null) && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Ionicons name="hourglass-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.metaValue, cookingMode && styles.cookingMetaValue]}>{totalTime}m</Text>
                  <Text style={[styles.metaLabel, cookingMode && styles.cookingMetaLabel]}>Total</Text>
                </View>
              </>
            )}
            {recipe.servings != null && (
              <>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={20} color={Colors.primary} />
                  <Text style={[styles.metaValue, cookingMode && styles.cookingMetaValue]}>{displayServings}</Text>
                  <Text style={[styles.metaLabel, cookingMode && styles.cookingMetaLabel]}>Serves</Text>
                </View>
              </>
            )}
          </View>

          {/* Servings scaler */}
          {recipe.servings != null && (
            <View style={[styles.scalerRow, cookingMode && styles.cookingScalerRow]}>
              <Text style={[styles.scalerLabel, cookingMode && styles.cookingScalerLabel]}>Scale recipe:</Text>
              <View style={styles.scalerControls}>
                <TouchableOpacity
                  style={[styles.scalerBtn, displayServings <= 1 && styles.scalerBtnDisabled]}
                  onPress={() => {
                    const step = 1 / baseServings;
                    const next = Math.max(step, parseFloat((servingsScale - step).toFixed(10)));
                    setServingsScale(next);
                    Haptics.selectionAsync();
                  }}
                  disabled={displayServings <= 1}
                  accessibilityLabel="Decrease servings"
                >
                  <Ionicons name="remove" size={18} color={displayServings <= 1 ? Colors.borderStrong : Colors.primary} />
                </TouchableOpacity>
                <View style={styles.scalerDisplay}>
                  <Text style={[styles.scalerServings, cookingMode && styles.cookingScalerServings]}>
                    {displayServings}
                  </Text>
                  <Text style={[styles.scalerUnit, cookingMode && styles.cookingScalerUnit]}>servings</Text>
                  {servingsScale !== 1 && (
                    <TouchableOpacity onPress={() => { setServingsScale(1); Haptics.selectionAsync(); }}>
                      <Text style={styles.scalerReset}>reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.scalerBtn}
                  onPress={() => {
                    const step = 1 / baseServings;
                    const next = parseFloat((servingsScale + step).toFixed(10));
                    setServingsScale(next);
                    Haptics.selectionAsync();
                  }}
                  accessibilityLabel="Increase servings"
                >
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Keep screen awake row */}
          <TouchableOpacity
            style={[styles.keepAwakeRow, cookingMode && styles.keepAwakeRowDark]}
            onPress={() => { setKeepAwake((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.7}
          >
            <Ionicons name="sunny-outline" size={18} color={keepAwake ? Colors.primary : (cookingMode ? Colors.textFaint : Colors.textSlate)} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.keepAwakeLabel, cookingMode && styles.keepAwakeLabelDark]}>Keep Screen Awake</Text>
              <Text style={styles.keepAwakeSub}>Prevent screen from sleeping while reading</Text>
            </View>
            <Switch
              value={keepAwake}
              onValueChange={(v) => { setKeepAwake(v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              trackColor={{ false: Colors.border, true: Colors.primaryBorder }}
              thumbColor={keepAwake ? Colors.primary : Colors.bgWhite}
              pointerEvents="none"
            />
          </TouchableOpacity>

          {/* Cooking mode toggle */}
          <TouchableOpacity
            style={[styles.cookingToggle, cookingMode && styles.cookingToggleActive]}
            onPress={() => { setCookingMode((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          >
            <Ionicons name="restaurant-outline" size={18} color={cookingMode ? Colors.bgWhite : Colors.primary} />
            <Text style={[styles.cookingToggleText, cookingMode && styles.cookingToggleTextActive]}>
              {cookingMode ? 'Exit Cooking Mode' : 'Start Cooking Mode'}
            </Text>
            {cookingMode && totalSteps > 0 && (
              <View style={styles.progressPill}>
                <Text style={styles.progressPillText}>{completedCount}/{totalSteps}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Dietary & Tags */}
          {recipe.tags.length > 0 && (
            <View style={styles.dietarySection}>
              {recipe.tags.map((tag) => {
                const known = DietaryTagMap[tag.toLowerCase()];
                if (known) {
                  return (
                    <View key={tag} style={[styles.dietaryBadge, { backgroundColor: known.bg }]}>
                      <Text style={styles.dietaryEmoji}>{known.emoji}</Text>
                      <Text style={[styles.dietaryText, { color: known.color }]}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Text>
                    </View>
                  );
                }
                return (
                  <View key={tag} style={[styles.tag, cookingMode && styles.cookingTag]}>
                    <Text style={[styles.tagText, cookingMode && styles.cookingTagText]}>#{tag}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Description */}
          {recipe.description && (
            <Text style={[styles.description, cookingMode && styles.cookingDescription]}>{recipe.description}</Text>
          )}

          {/* Ingredients */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, cookingMode && styles.cookingSectionTitle]}>Ingredients</Text>
            {checkedIngredients.size > 0 && (
              <TouchableOpacity onPress={() => setCheckedIngredients(new Set())}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {(recipe.ingredients ?? []).map((ing: Ingredient) => {
            const scaledQty = scaleQuantity(ing.quantity, servingsScale);
            const { quantity: dQty, unit: dUnit } = convertForDisplay(scaledQty, ing.unit, unitSystem);
            return (
              <TouchableOpacity
                key={ing.id}
                style={[styles.ingredientRow, checkedIngredients.has(ing.id) && styles.ingredientChecked]}
                onPress={() => toggleIngredient(ing.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: checkedIngredients.has(ing.id) }}
                accessibilityLabel={`${ing.name}`}
              >
                <View style={[styles.checkbox, checkedIngredients.has(ing.id) && styles.checkboxChecked]}>
                  {checkedIngredients.has(ing.id) && <Ionicons name="checkmark" size={14} color={Colors.bgWhite} />}
                </View>
                <Text style={[styles.ingredientText, cookingMode && styles.cookingText, checkedIngredients.has(ing.id) && styles.strikethrough]}>
                  {[dQty, dUnit, ing.name].filter(Boolean).join(' ')}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add to Shopping List */}
          {(recipe.ingredients ?? []).length > 0 && (
            <TouchableOpacity
              style={styles.shoppingBtn}
              onPress={handleAddToShoppingList}
              activeOpacity={0.8}
            >
              <Ionicons name="cart-outline" size={18} color={Colors.primary} />
              <Text style={styles.shoppingBtnText}>Add to Shopping List</Text>
              <Text style={styles.shoppingBtnCount}>
                {recipe.ingredients!.length} item{recipe.ingredients!.length !== 1 ? 's' : ''}
              </Text>
            </TouchableOpacity>
          )}

          {/* Steps */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, cookingMode && styles.cookingSectionTitle]}>Instructions</Text>
            {completedSteps.size > 0 && (
              <TouchableOpacity onPress={() => setCompletedSteps(new Set())}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {(recipe.steps ?? []).map((step: Step, idx: number) => (
            <TouchableOpacity
              key={step.id}
              style={[styles.stepRow, completedSteps.has(step.id) && styles.stepCompleted]}
              onPress={() => toggleStep(step.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: completedSteps.has(step.id) }}
            >
              <View style={[styles.stepNum, completedSteps.has(step.id) && styles.stepNumCompleted]}>
                {completedSteps.has(step.id) ? (
                  <Ionicons name="checkmark" size={14} color={Colors.bgWhite} />
                ) : (
                  <Text style={styles.stepNumText}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepText, cookingMode && styles.cookingStepText, completedSteps.has(step.id) && styles.strikethrough]}>
                {step.instruction}
              </Text>
            </TouchableOpacity>
          ))}

        </View>
      </ScrollView>

      {/* Add to Collection modal */}
      <Modal
        visible={collectionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCollectionModal(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCollectionModal(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add to Collection</Text>
            {collections.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No collections yet.</Text>
                <TouchableOpacity
                  style={styles.modalCreateBtn}
                  onPress={() => { setCollectionModal(false); router.push('/collection/list'); }}
                >
                  <Text style={styles.modalCreateBtnText}>Create a Collection</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={collections}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => {
                  const alreadyAdded = item.recipe_ids.includes(recipe.id);
                  return (
                    <TouchableOpacity
                      style={[styles.collectionRow, alreadyAdded && styles.collectionRowAdded]}
                      onPress={() => !alreadyAdded && handleAddToCollection(item.id)}
                      disabled={alreadyAdded || addingToCollection === item.id}
                    >
                      <View style={styles.collectionIcon}>
                        <Text style={styles.collectionIconText}>{item.name[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.collectionName}>{item.name}</Text>
                        <Text style={styles.collectionCount}>{item.recipe_ids.length} recipe{item.recipe_ids.length !== 1 ? 's' : ''}</Text>
                      </View>
                      {addingToCollection === item.id ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : alreadyAdded ? (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.privateGreen} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                style={styles.collectionList}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={deleteModal}
        title="Delete Recipe"
        message="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal(false)}
      />

      {/* Toast banner */}
      {toast && (
        <View style={[styles.toast, toast.type === 'error' && styles.toastError, toast.type === 'info' && styles.toastInfo]}>
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'alert-circle' : 'information-circle'}
            size={18}
            color={Colors.bgWhite}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
          {toast.type === 'success' && (
            <TouchableOpacity onPress={() => { setToast(null); router.push('/shopping'); }}>
              <Text style={styles.toastAction}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  cookingModeContainer: { backgroundColor: Colors.textPrimary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: FontSize.base.size, color: Colors.textFaint, fontFamily: FontFamily.regular },

  // Navbar
  navbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  navBtn: {
    backgroundColor: Colors.bgSurface, width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  navActions: { flexDirection: 'row' },

  hero: { width: SCREEN_WIDTH, height: 260 },
  heroPlaceholder: { height: 180, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 64 },

  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgWhite,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 18,
  },

  content: { padding: 20, paddingBottom: 60 },
  cookingContent: {},
  title: { fontSize: 26, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: 32 },
  cookingTitle: { fontSize: 30, color: Colors.bgWhite },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.xl },
  diffDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 13, fontFamily: FontFamily.semibold },
  categoryBadge: { backgroundColor: Colors.primaryBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.xl },
  categoryBadgeText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.primary },
  cuisineBadge: { backgroundColor: Colors.primaryBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.xl },
  cuisineBadgeText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.primaryMid },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.xl },
  privateText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.medium, color: Colors.primaryMid },

  metaCard: {
    flexDirection: 'row', backgroundColor: Colors.bgSurface, borderRadius: 16,
    padding: Spacing.lg, marginBottom: Spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.bgMuted,
  },
  metaItem: { flex: 1, alignItems: 'center', gap: 3 },
  metaLabel: { fontSize: 11, color: Colors.textFaint, fontFamily: FontFamily.medium, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaValue: { fontSize: 17, color: Colors.textPrimary, fontFamily: FontFamily.bold },
  metaDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  cookingMetaCard: { backgroundColor: Colors.bgDarkSurface, borderColor: Colors.bgDarkBorder },
  cookingMetaValue: { color: Colors.bgWhite },
  cookingMetaLabel: { color: Colors.textFaint },

  // Servings scaler
  scalerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgSurface, borderRadius: Radii.lg, padding: Spacing.md,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.bgMuted,
  },
  cookingScalerRow: { backgroundColor: Colors.bgDarkSurface, borderColor: Colors.bgDarkBorder },
  scalerLabel: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.textSecondary },
  cookingScalerLabel: { color: Colors.textFaint },
  scalerControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scalerBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryBg,
    borderWidth: 1.5, borderColor: Colors.primaryBorder, alignItems: 'center', justifyContent: 'center',
  },
  scalerBtnDisabled: { backgroundColor: Colors.bgMuted, borderColor: Colors.border },
  scalerDisplay: { alignItems: 'center', minWidth: 60 },
  scalerServings: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  cookingScalerServings: { color: Colors.bgWhite },
  scalerUnit: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.3 },
  cookingScalerUnit: { color: Colors.textSlate },
  scalerReset: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.primary, marginTop: 2 },

  keepAwakeRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgSurface, borderRadius: Radii.lg, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.bgMuted,
  },
  keepAwakeRowDark: { backgroundColor: Colors.bgDarkSurface, borderColor: Colors.bgDarkBorder },
  keepAwakeLabel: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  keepAwakeLabelDark: { color: Colors.bgMuted },
  keepAwakeSub: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 1 },

  cookingToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryBg,
    padding: 14, borderRadius: Radii.lg, marginBottom: 20, minHeight: 50,
    borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  cookingToggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cookingToggleText: { flex: 1, fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.primary },
  cookingToggleTextActive: { color: Colors.bgWhite },
  progressPill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.xl },
  progressPillText: { fontSize: 13, fontFamily: FontFamily.bold, color: Colors.bgWhite },

  description: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textSecondary, lineHeight: 23, marginBottom: 20 },
  cookingDescription: { color: Colors.textFaint },

  shoppingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  shoppingBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  shoppingBtnCount: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: Colors.primaryMid,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md, marginTop: Spacing.sm },
  sectionTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  cookingSectionTitle: { color: Colors.bgWhite },
  clearText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textFaint },

  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted, minHeight: 44 },
  ingredientChecked: { opacity: 0.45 },
  checkbox: { width: 22, height: 22, borderRadius: Radii.sm, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  ingredientText: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary },
  cookingText: { fontSize: 18, color: Colors.bgWhite },
  strikethrough: { textDecorationLine: 'line-through', color: Colors.textFaint },

  stepRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted, minHeight: 44 },
  stepCompleted: { opacity: 0.45 },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  stepNumCompleted: { backgroundColor: Colors.privateGreen },
  stepNumText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.primary },
  stepText: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, lineHeight: 22 },
  cookingStepText: { fontSize: 20, color: Colors.bgWhite, lineHeight: 30 },

  dietarySection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dietaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radii.xl,
  },
  dietaryEmoji: { fontSize: 13 },
  dietaryText: { fontSize: 13, fontFamily: FontFamily.semibold },

  tag: { backgroundColor: Colors.bgMuted, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.xl },
  tagText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  cookingTag: { backgroundColor: Colors.bgDarkSurface },
  cookingTagText: { color: Colors.textFaint },

  // Collection modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.md, paddingBottom: 40, maxHeight: '75%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: Spacing.lg },
  modalEmpty: { alignItems: 'center', padding: Spacing['2xl'], gap: Spacing.md },
  modalEmptyText: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textFaint },
  modalCreateBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: Spacing.md, borderRadius: 12 },
  modalCreateBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: FontSize.sm.size },
  collectionList: { paddingHorizontal: 20 },
  collectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  collectionRowAdded: { opacity: 0.6 },
  collectionIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  collectionIconText: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.primary },
  collectionName: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  collectionCount: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 1 },

  toast: {
    position: 'absolute', bottom: Spacing['2xl'], left: 20, right: 20,
    backgroundColor: Colors.privateGreen, borderRadius: Radii.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 13,
    ...Shadows.card,
  },
  toastError: { backgroundColor: Colors.danger },
  toastInfo: { backgroundColor: Colors.primary },
  toastText: { flex: 1, fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.bgWhite },
  toastAction: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.bgWhite, textDecorationLine: 'underline' },
});
