import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, Alert, Share, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import { Ingredient, Step } from '@/types';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { fetchById, toggleFavorite, deleteRecipe } = useRecipeStore();

  const [recipe, setRecipe] = useState(useRecipeStore.getState().currentRecipe);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [cookingMode, setCookingMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      await fetchById(id);
      setRecipe(useRecipeStore.getState().currentRecipe);
      setIsLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (cookingMode) {
      KeepAwake.activateKeepAwakeAsync();
    } else {
      KeepAwake.deactivateKeepAwake();
    }
    return () => { KeepAwake.deactivateKeepAwake(); };
  }, [cookingMode]);

  const handleToggleFavorite = async () => {
    if (!recipe) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(recipe.id);
    setRecipe((r) => r ? { ...r, is_favorite: !r.is_favorite } : r);
  };

  const handleDelete = () => {
    Alert.alert('Delete Recipe', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteRecipe(recipe!.id);
          router.back();
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!recipe) return;
    const text = [
      `🍳 ${recipe.title}`,
      recipe.description ?? '',
      '',
      `⏱ Prep: ${recipe.prep_time_minutes ?? '?'} min | Cook: ${recipe.cook_time_minutes ?? '?'} min`,
      `👥 Serves: ${recipe.servings ?? '?'}`,
      '',
      '📋 Ingredients:',
      ...(recipe.ingredients ?? []).map((i) => `• ${i.quantity ?? ''} ${i.unit ?? ''} ${i.name}`.trim()),
      '',
      '📝 Steps:',
      ...(recipe.steps ?? []).map((s, idx) => `${idx + 1}. ${s.instruction}`),
    ].join('\n');
    await Share.share({ message: text, title: recipe.title });
  };

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  };

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#f97316" size="large" />
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

  const heroUri = recipe.images?.[0]?.local_uri ?? recipe.images?.[0]?.storage_path;

  return (
    <SafeAreaView style={[styles.container, cookingMode && styles.cookingModeContainer]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.hero} resizeMode="cover" accessibilityLabel={`Photo of ${recipe.title}`} />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroEmoji}>🍽</Text>
          </View>
        )}

        {/* Nav bar */}
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => router.back()} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.navActions}>
            <TouchableOpacity style={styles.navBtn} onPress={handleToggleFavorite} accessibilityLabel="Toggle favorite">
              <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={22} color={recipe.is_favorite ? '#f97316' : '#0f172a'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={handleShare} accessibilityLabel="Share recipe">
              <Ionicons name="share-outline" size={22} color="#0f172a" />
            </TouchableOpacity>
            {user?.id === recipe.owner_user_id && (
              <>
                <TouchableOpacity style={styles.navBtn} onPress={() => router.push(`/recipe/edit/${recipe.id}`)} accessibilityLabel="Edit recipe">
                  <Ionicons name="pencil-outline" size={22} color="#0f172a" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navBtn} onPress={handleDelete} accessibilityLabel="Delete recipe">
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={[styles.content, cookingMode && styles.cookingContent]}>
          {/* Title */}
          <Animated.Text entering={FadeIn} style={[styles.title, cookingMode && styles.cookingTitle]}>
            {recipe.title}
          </Animated.Text>

          {/* Badges */}
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${DIFFICULTY_COLORS[recipe.difficulty]}20` }]}>
              <Text style={[styles.badgeText, { color: DIFFICULTY_COLORS[recipe.difficulty] }]}>
                {recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}
              </Text>
            </View>
            {!recipe.group_id && (
              <View style={styles.privateBadge}>
                <Ionicons name="lock-closed" size={11} color="#22c55e" />
                <Text style={styles.privateText}>Private</Text>
              </View>
            )}
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            {recipe.prep_time_minutes != null && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#94a3b8" />
                <Text style={styles.metaLabel}>Prep</Text>
                <Text style={styles.metaValue}>{recipe.prep_time_minutes}m</Text>
              </View>
            )}
            {recipe.cook_time_minutes != null && (
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={16} color="#94a3b8" />
                <Text style={styles.metaLabel}>Cook</Text>
                <Text style={styles.metaValue}>{recipe.cook_time_minutes}m</Text>
              </View>
            )}
            {recipe.servings != null && (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={16} color="#94a3b8" />
                <Text style={styles.metaLabel}>Serves</Text>
                <Text style={styles.metaValue}>{recipe.servings}</Text>
              </View>
            )}
          </View>

          {/* Cooking mode toggle */}
          <TouchableOpacity
            style={[styles.cookingToggle, cookingMode && styles.cookingToggleActive]}
            onPress={() => { setCookingMode((v) => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          >
            <Ionicons name="restaurant-outline" size={18} color={cookingMode ? '#ffffff' : '#f97316'} />
            <Text style={[styles.cookingToggleText, cookingMode && styles.cookingToggleTextActive]}>
              {cookingMode ? 'Exit Cooking Mode' : 'Cooking Mode'}
            </Text>
          </TouchableOpacity>

          {/* Description */}
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          {/* Ingredients */}
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {(recipe.ingredients ?? []).map((ing: Ingredient) => (
            <TouchableOpacity
              key={ing.id}
              style={[styles.ingredientRow, checkedIngredients.has(ing.id) && styles.ingredientChecked]}
              onPress={() => toggleIngredient(ing.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: checkedIngredients.has(ing.id) }}
              accessibilityLabel={`${ing.name}`}
            >
              <View style={[styles.checkbox, checkedIngredients.has(ing.id) && styles.checkboxChecked]}>
                {checkedIngredients.has(ing.id) && <Ionicons name="checkmark" size={14} color="#ffffff" />}
              </View>
              <Text style={[styles.ingredientText, cookingMode && styles.cookingText, checkedIngredients.has(ing.id) && styles.strikethrough]}>
                {[ing.quantity, ing.unit, ing.name].filter(Boolean).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Steps */}
          <Text style={styles.sectionTitle}>Instructions</Text>
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
                  <Ionicons name="checkmark" size={14} color="#ffffff" />
                ) : (
                  <Text style={styles.stepNumText}>{idx + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepText, cookingMode && styles.cookingStepText, completedSteps.has(step.id) && styles.strikethrough]}>
                {step.instruction}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {recipe.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  cookingModeContainer: { backgroundColor: '#0f172a' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#94a3b8', fontFamily: 'Inter_400Regular' },
  hero: { width: '100%', height: 280 },
  heroPlaceholder: { height: 200, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 64 },
  navbar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, zIndex: 10 },
  navBtn: { backgroundColor: 'rgba(255,255,255,0.9)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  navActions: { flexDirection: 'row' },
  content: { padding: 20, paddingBottom: 60 },
  cookingContent: {},
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 12 },
  cookingTitle: { fontSize: 32, color: '#ffffff' },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  privateText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#22c55e' },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel: { fontSize: 12, color: '#94a3b8', fontFamily: 'Inter_400Regular' },
  metaValue: { fontSize: 14, color: '#0f172a', fontFamily: 'Inter_600SemiBold' },
  cookingToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, marginBottom: 20, minHeight: 48, borderWidth: 1, borderColor: '#fed7aa' },
  cookingToggleActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  cookingToggleText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#f97316' },
  cookingToggleTextActive: { color: '#ffffff' },
  description: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#475569', lineHeight: 22, marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 12, marginTop: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', minHeight: 44 },
  ingredientChecked: { opacity: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  ingredientText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#0f172a' },
  cookingText: { fontSize: 18, color: '#ffffff' },
  strikethrough: { textDecorationLine: 'line-through', color: '#94a3b8' },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', minHeight: 44 },
  stepCompleted: { opacity: 0.5 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  stepNumCompleted: { backgroundColor: '#22c55e' },
  stepNumText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#f97316' },
  stepText: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#0f172a', lineHeight: 22 },
  cookingStepText: { fontSize: 20, color: '#ffffff', lineHeight: 30 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  tag: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569' },
});
