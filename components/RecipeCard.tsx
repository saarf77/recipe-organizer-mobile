import React, { memo, useRef, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Share, Platform } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import ConfirmModal from './ConfirmModal';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Recipe } from '@/types';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { Colors, DifficultyColors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

interface Props {
  recipe: Recipe;
  variant: 'horizontal' | 'vertical' | 'grid';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const RecipeCard = memo(({ recipe, variant }: Props) => {
  const { toggleFavorite, deleteRecipe } = useRecipeStore();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const scale = useSharedValue(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15 }); };

  const handleFavorite = async (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(recipe.id);
  };

  const handleShare = useCallback(async () => {
    swipeableRef.current?.close();
    const text = [
      recipe.title,
      recipe.description ?? '',
      recipe.prep_time_minutes ? `Prep: ${recipe.prep_time_minutes} min` : '',
      recipe.cook_time_minutes ? `Cook: ${recipe.cook_time_minutes} min` : '',
      recipe.servings ? `Serves: ${recipe.servings}` : '',
    ].filter(Boolean).join('\n');
    try {
      await Share.share({ message: text, title: recipe.title });
    } catch { /* cancelled */ }
  }, [recipe]);

  const handleEdit = useCallback(() => {
    swipeableRef.current?.close();
    router.push(`/recipe/edit/${recipe.id}`);
  }, [recipe.id]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    setShowDeleteConfirm(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    try {
      await deleteRecipe(recipe.id);
    } catch (e: unknown) {
      Alert.alert('Delete failed', e instanceof Error ? e.message : 'Could not delete.');
    }
  }, [recipe.id, deleteRecipe]);

  const handleLongPress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(recipe.title, 'What would you like to do?', [
      {
        text: recipe.is_favorite ? 'Remove from Favorites' : 'Add to Favorites',
        onPress: () => toggleFavorite(recipe.id),
      },
      { text: 'Share', onPress: handleShare },
      { text: 'Edit', onPress: handleEdit },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [recipe, toggleFavorite, handleShare, handleEdit, handleDelete]);

  // Right swipe actions: Edit (blue) + Delete (red)
  const renderRightActions = useCallback(() => (
    <View style={styles.swipeActions}>
      <TouchableOpacity style={styles.swipeEditBtn} onPress={handleEdit}>
        <Ionicons name="pencil-outline" size={20} color={Colors.bgWhite} />
        <Text style={styles.swipeActionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.swipeDeleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={20} color={Colors.bgWhite} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  ), [handleEdit, handleDelete]);

  // Left swipe actions: Share (gray)
  const renderLeftActions = useCallback(() => (
    <TouchableOpacity style={styles.swipeShareBtn} onPress={handleShare}>
      <Ionicons name="share-outline" size={20} color={Colors.bgWhite} />
      <Text style={styles.swipeActionText}>Share</Text>
    </TouchableOpacity>
  ), [handleShare]);

  const heroUri = recipe.images?.[0]?.local_uri ?? recipe.images?.[0]?.storage_path;
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  // ─── Card body ───────────────────────────────────────────────────────────────

  const cardContent = () => {
    if (variant === 'vertical') {
      return (
        <AnimatedTouchable
          style={[styles.vertCard, animatedStyle]}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          accessibilityRole="button"
          accessibilityLabel={`Recipe: ${recipe.title}`}
        >
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.imgPlaceholder]}>
              <Text style={styles.imgPlaceholderText}>🍽</Text>
            </View>
          )}
          <View style={styles.vertTopRow}>
            <View style={[styles.diffPill, { backgroundColor: `${DifficultyColors[recipe.difficulty]}cc` }]}>
              <Text style={styles.diffPillText}>{recipe.difficulty}</Text>
            </View>
            <TouchableOpacity
              style={[styles.favBtn, recipe.is_favorite && styles.favBtnActive]}
              onPress={handleFavorite}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={18} color={Colors.bgWhite} />
            </TouchableOpacity>
          </View>
          <View style={styles.vertBottom}>
            {recipe.category && <Text style={styles.cardCategory}>{recipe.category.toUpperCase()}</Text>}
            <Text style={styles.vertTitle} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.metaRow}>
              {totalTime > 0 && (
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.metaChipText}>{totalTime} min</Text>
                </View>
              )}
              {recipe.servings != null && (
                <View style={styles.metaChip}>
                  <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.metaChipText}>{recipe.servings} servings</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedTouchable>
      );
    }

    if (variant === 'grid') {
      return (
        <AnimatedTouchable
          style={[styles.gridCard, animatedStyle]}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          accessibilityRole="button"
          accessibilityLabel={`Recipe: ${recipe.title}`}
        >
          <View style={styles.gridImgWrap}>
            {heroUri ? (
              <Image source={{ uri: heroUri }} style={styles.gridImg} resizeMode="cover" />
            ) : (
              <View style={[styles.gridImg, styles.imgPlaceholder]}>
                <Text style={styles.imgPlaceholderText}>🍽</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.favBtnImg, recipe.is_favorite && styles.favBtnActive]}
              onPress={handleFavorite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={15} color={Colors.bgWhite} />
            </TouchableOpacity>
            {totalTime > 0 && (
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={10} color={Colors.bgWhite} />
                <Text style={styles.timeBadgeText}>{totalTime}m</Text>
              </View>
            )}
          </View>
          <View style={styles.gridContent}>
            {recipe.category && <Text style={styles.cardCategory} numberOfLines={1}>{recipe.category}</Text>}
            <Text style={styles.gridTitle} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.gridFooter}>
              <View style={[styles.diffBadge, { backgroundColor: `${DifficultyColors[recipe.difficulty]}18` }]}>
                <View style={[styles.diffDot, { backgroundColor: DifficultyColors[recipe.difficulty] }]} />
                <Text style={[styles.diffText, { color: DifficultyColors[recipe.difficulty] }]}>
                  {recipe.difficulty}
                </Text>
              </View>
              <View style={styles.gridActions}>
                <TouchableOpacity
                  onPress={handleEdit}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Edit recipe"
                >
                  <Ionicons name="pencil-outline" size={15} color={Colors.textFaint} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Delete recipe"
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedTouchable>
      );
    }

    // Horizontal — no swipe (conflicts with horizontal scroll)
    return (
      <AnimatedTouchable
        style={[styles.horizCard, animatedStyle]}
        onPress={() => router.push(`/recipe/${recipe.id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={`Recipe: ${recipe.title}`}
      >
        <View style={styles.horizImgWrap}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.horizImg} resizeMode="cover" />
          ) : (
            <View style={[styles.horizImg, styles.imgPlaceholder]}>
              <Text style={styles.imgPlaceholderText}>🍽</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.favBtnImg, recipe.is_favorite && styles.favBtnActive]}
            onPress={handleFavorite}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={14} color={Colors.bgWhite} />
          </TouchableOpacity>
          {totalTime > 0 && (
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={10} color={Colors.bgWhite} />
              <Text style={styles.timeBadgeText}>{totalTime}m</Text>
            </View>
          )}
        </View>
        <View style={styles.horizContent}>
          {recipe.category && <Text style={styles.cardCategory}>{recipe.category}</Text>}
          <Text style={styles.horizTitle} numberOfLines={2}>{recipe.title}</Text>
          <View style={styles.horizFooter}>
            <View style={[styles.diffBadge, { backgroundColor: `${DifficultyColors[recipe.difficulty]}18` }]}>
              <View style={[styles.diffDot, { backgroundColor: DifficultyColors[recipe.difficulty] }]} />
              <Text style={[styles.diffText, { color: DifficultyColors[recipe.difficulty] }]}>
                {recipe.difficulty}
              </Text>
            </View>
            {recipe.servings != null && (
              <View style={styles.servingsRow}>
                <Ionicons name="people-outline" size={11} color={Colors.textFaint} />
                <Text style={styles.servingsText}>{recipe.servings}</Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedTouchable>
    );
  };

  const deleteModal = (
    <ConfirmModal
      visible={showDeleteConfirm}
      title="Delete Recipe"
      message={`Delete "${recipe.title}"? This cannot be undone.`}
      confirmLabel="Delete"
      destructive
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
  );

  // Horizontal variant: no swipe (would conflict with horizontal FlatList scroll)
  if (variant === 'horizontal') {
    return <>{cardContent()}{deleteModal}</>;
  }

  // Grid and Vertical: wrap in Swipeable
  return (
    <>
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
      onSwipeableOpen={(direction) => {
        // Full swipe left (opens right actions fully) → auto-trigger delete
        if (direction === 'right') {
          handleDelete();
        }
        // Full swipe right (opens left actions fully) → auto-trigger share
        if (direction === 'left') {
          handleShare();
        }
      }}
    >
      {cardContent()}
    </ReanimatedSwipeable>
    {deleteModal}
    </>
  );
});

RecipeCard.displayName = 'RecipeCard';
export default RecipeCard;

const styles = StyleSheet.create({
  imgPlaceholder: { backgroundColor: Colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
  imgPlaceholderText: { fontSize: 32, opacity: 0.5 },
  cardCategory: { fontSize: FontSize.xs.size, fontFamily: FontFamily.bold, color: Colors.primaryMid, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },

  // Swipe actions
  swipeActions: { flexDirection: 'row', marginBottom: Spacing.sm + 2 },
  swipeDeleteBtn: {
    backgroundColor: Colors.danger, width: 75, justifyContent: 'center', alignItems: 'center',
    borderTopRightRadius: Radii.lg, borderBottomRightRadius: Radii.lg, gap: Spacing.xs,
  },
  swipeEditBtn: {
    backgroundColor: Colors.swipeEdit, width: 75, justifyContent: 'center', alignItems: 'center', gap: Spacing.xs,
  },
  swipeShareBtn: {
    backgroundColor: Colors.textSlate, width: 75, justifyContent: 'center', alignItems: 'center',
    borderTopLeftRadius: Radii.lg, borderBottomLeftRadius: Radii.lg, marginBottom: Spacing.sm + 2, gap: Spacing.xs,
  },
  swipeActionText: { fontSize: 11, fontFamily: FontFamily.semibold, color: Colors.bgWhite },

  // Shared badges
  favBtn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  favBtnImg: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  favBtnActive: { backgroundColor: Colors.primary },

  timeBadge: {
    position: 'absolute', bottom: Spacing.sm, left: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radii.md,
  },
  timeBadgeText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold, color: Colors.bgWhite },

  diffBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.sm + 2 },
  diffDot: { width: 6, height: 6, borderRadius: 3 },
  diffText: { fontSize: 11, fontFamily: FontFamily.semibold, textTransform: 'capitalize' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md / 2, marginTop: Spacing.md / 2 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.md,
  },
  metaChipText: { fontSize: 11, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.9)' },

  // ─── Vertical ──────────────────────────────────────────────────────────────
  vertCard: {
    width: '100%', height: 220, borderRadius: Radii.xl, overflow: 'hidden',
    marginBottom: 14, ...Shadows.elevated,
  },
  vertTopRow: {
    position: 'absolute', top: Spacing.md, left: Spacing.md, right: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  diffPill: { paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: Radii.xl },
  diffPillText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.semibold, color: Colors.bgWhite, textTransform: 'capitalize' },
  vertBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  vertTitle: { fontSize: FontSize.lg.size, fontFamily: FontFamily.bold, color: Colors.bgWhite, lineHeight: FontSize.base.lineHeight },

  // ─── Grid ──────────────────────────────────────────────────────────────────
  gridCard: {
    flex: 1, borderRadius: Radii.lg, overflow: 'hidden',
    backgroundColor: Colors.bgWhite, marginBottom: Spacing.sm + 2,
    ...Shadows.card,
  },
  gridImgWrap: { width: '100%', height: 130, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridContent: { padding: Spacing.sm + 2, paddingBottom: Spacing.md },
  gridTitle: { fontSize: FontSize.sm.size - 1, fontFamily: FontFamily.bold, color: Colors.textPrimary, lineHeight: 18, marginBottom: Spacing.md / 2 },
  gridFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gridActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },

  // ─── Horizontal ────────────────────────────────────────────────────────────
  horizCard: {
    width: 190, borderRadius: 18, overflow: 'hidden',
    marginRight: Spacing.md, backgroundColor: Colors.bgWhite,
    ...Shadows.elevated,
  },
  horizImgWrap: { width: '100%', height: 130, position: 'relative' },
  horizImg: { width: '100%', height: '100%' },
  horizContent: { padding: Spacing.md },
  horizTitle: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.textPrimary, lineHeight: 19, marginBottom: Spacing.sm },
  horizFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  servingsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  servingsText: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textFaint },
});
