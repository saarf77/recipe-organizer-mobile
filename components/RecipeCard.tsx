import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Recipe } from '@/types';
import { useRecipeStore } from '@/features/recipes/recipeStore';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
};

interface Props {
  recipe: Recipe;
  variant: 'horizontal' | 'vertical';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const RecipeCard = memo(({ recipe, variant }: Props) => {
  const { toggleFavorite } = useRecipeStore();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97); };
  const handlePressOut = () => { scale.value = withSpring(1); };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(recipe.id);
  };

  const heroUri = recipe.images?.[0]?.local_uri ?? recipe.images?.[0]?.storage_path;
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const isHorizontal = variant === 'horizontal';

  return (
    <AnimatedTouchable
      style={[
        styles.card,
        isHorizontal ? styles.horizontal : styles.vertical,
        animatedStyle,
      ]}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Recipe: ${recipe.title}`}
      accessibilityHint="Double tap to open recipe"
    >
      {/* Image */}
      {heroUri ? (
        <Image
          source={{ uri: heroUri }}
          style={isHorizontal ? styles.imgHorizontal : styles.imgVertical}
          resizeMode="cover"
          accessibilityLabel={`Photo of ${recipe.title}`}
        />
      ) : (
        <View style={[
          styles.imgPlaceholder,
          isHorizontal ? styles.imgHorizontal : styles.imgVertical,
        ]}>
          <Text style={styles.imgPlaceholderText}>🍽</Text>
        </View>
      )}

      {/* Content */}
      <View style={[styles.content, isHorizontal && styles.contentHorizontal]}>
        {/* Badges */}
        <View style={styles.topRow}>
          <View style={[styles.diffBadge, { backgroundColor: `${DIFFICULTY_COLORS[recipe.difficulty]}20` }]}>
            <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[recipe.difficulty] }]}>
              {recipe.difficulty}
            </Text>
          </View>
          {recipe.group_id ? (
            <View style={styles.groupBadge}>
              <Ionicons name="people-outline" size={11} color="#475569" />
            </View>
          ) : (
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={11} color="#22c55e" />
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>

        {recipe.category && (
          <Text style={styles.category} numberOfLines={1}>{recipe.category}</Text>
        )}

        <View style={styles.footer}>
          {totalTime > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color="#94a3b8" />
              <Text style={styles.metaText}>{totalTime}m</Text>
            </View>
          )}
          {recipe.servings != null && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color="#94a3b8" />
              <Text style={styles.metaText}>{recipe.servings}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.favBtn}
            onPress={handleFavorite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={recipe.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={16}
              color={recipe.is_favorite ? '#f97316' : '#cbd5e1'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedTouchable>
  );
});

RecipeCard.displayName = 'RecipeCard';
export default RecipeCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  horizontal: { width: 200, marginRight: 12, marginBottom: 0 },
  vertical: { width: '100%' },
  imgHorizontal: { width: '100%', height: 130 },
  imgVertical: { width: '100%', height: 180 },
  imgPlaceholder: { backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  imgPlaceholderText: { fontSize: 40 },
  content: { padding: 12 },
  contentHorizontal: { padding: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  groupBadge: { backgroundColor: '#f1f5f9', padding: 4, borderRadius: 6 },
  privateBadge: { backgroundColor: '#f0fdf4', padding: 4, borderRadius: 6 },
  title: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#0f172a', lineHeight: 20 },
  category: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8' },
  favBtn: { marginLeft: 'auto', padding: 4 },
});
