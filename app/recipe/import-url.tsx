import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Clipboard, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { extractRecipeFromUrl, UrlImportResult } from '@/services/recipeUrlService';
import { useShoppingStore } from '@/features/shopping/shoppingStore';
import { v4 as uuidv4 } from 'uuid';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

type ImportState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; result: UrlImportResult }
  | { type: 'error'; message: string };

const POPULAR_SITES = [
  { name: 'Love & Lemons', domain: 'loveandlemons.com' },
  { name: 'AllRecipes', domain: 'allrecipes.com' },
  { name: 'Food Network', domain: 'foodnetwork.com' },
  { name: 'NYT Cooking', domain: 'cooking.nytimes.com' },
  { name: 'Serious Eats', domain: 'seriouseats.com' },
  { name: 'Bon Appétit', domain: 'bonappetit.com' },
];

export default function ImportUrlScreen() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ImportState>({ type: 'idle' });
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const addFromRecipe = useShoppingStore((s) => s.addFromRecipe);

  const handleAddToShopping = () => {
    if (state.type !== 'success') return;
    const { result } = state;
    const tempId = `import-${Date.now()}`;
    const ingredients = result.ingredients.map((i) => ({ ...i, id: uuidv4() }));
    addFromRecipe(tempId, result.title ?? 'Imported Recipe', ingredients, 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Added to Shopping List',
      `${result.ingredients.length} ingredient${result.ingredients.length !== 1 ? 's' : ''} added.`,
      [
        { text: 'View List', onPress: () => router.push('/shopping') },
        { text: 'OK', style: 'cancel' },
      ],
    );
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (text) setUrl(text.trim());
    } catch {
      // Clipboard not available
    }
  };

  const handleExtract = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState({ type: 'loading' });
    try {
      const result = await extractRecipeFromUrl(trimmed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState({ type: 'success', result });
    } catch (e: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState({
        type: 'error',
        message: e instanceof Error ? e.message : 'Something went wrong.',
      });
    }
  };

  const handleImport = () => {
    if (state.type !== 'success') return;
    const { result } = state;
    const parsed = JSON.stringify({
      title: result.title,
      description: result.description,
      difficulty: result.difficulty,
      prep_time_minutes: result.prep_time_minutes,
      cook_time_minutes: result.cook_time_minutes,
      servings: result.servings,
      category: result.category,
      cuisine: result.cuisine,
      tags: result.tags,
      ingredients: result.ingredients,
      steps: result.steps,
      cover_image_url: result.cover_image_url,
    });
    router.replace({ pathname: '/recipe/new', params: { parsed } });
  };

  const handleRetry = () => {
    setState({ type: 'idle' });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={goBack} style={styles.navBtn} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Import from URL</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ─── Hero ───────────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🔗</Text>
          </View>
          <Text style={styles.heroTitle}>Paste a recipe link</Text>
          <Text style={styles.heroSubtitle}>
            Works with most popular recipe sites that use structured data
          </Text>
        </View>

        {/* ─── URL input ──────────────────────────────────────────────────────── */}
        <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
          <View style={styles.inputRow}>
            <Ionicons name="link-outline" size={18} color={inputFocused ? Colors.primary : Colors.textFaint} style={styles.inputIcon} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://..."
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleExtract}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              editable={state.type !== 'loading'}
              accessibilityLabel="Recipe URL"
            />
            {url.length > 0 ? (
              <TouchableOpacity
                onPress={() => { setUrl(''); setState({ type: 'idle' }); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn}>
                <Text style={styles.pasteBtnText}>Paste</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── Extract button ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.extractBtn, (state.type === 'loading' || !url.trim()) && styles.extractBtnDisabled]}
          onPress={handleExtract}
          disabled={state.type === 'loading' || !url.trim()}
          accessibilityLabel="Extract recipe"
        >
          {state.type === 'loading' ? (
            <>
              <ActivityIndicator color={Colors.bgWhite} size="small" />
              <Text style={styles.extractBtnText}>Extracting recipe...</Text>
            </>
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color={Colors.bgWhite} />
              <Text style={styles.extractBtnText}>Extract Recipe</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ─── Loading state ──────────────────────────────────────────────────── */}
        {state.type === 'loading' && (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingText}>Fetching page and parsing recipe data...</Text>
            <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
          </View>
        )}

        {/* ─── Error state ─────────────────────────────────────────────────────── */}
        {state.type === 'error' && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="warning-outline" size={24} color={Colors.danger} />
            </View>
            <Text style={styles.errorTitle}>Import failed</Text>
            <Text style={styles.errorMessage}>{state.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Success preview ─────────────────────────────────────────────────── */}
        {state.type === 'success' && (
          <View style={styles.previewCard}>
            {state.result.cover_image_url && (
              <Image
                source={{ uri: state.result.cover_image_url }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.previewHeader}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.privateGreen} />
                <Text style={styles.successBadgeText}>Recipe found!</Text>
              </View>
            </View>

            {state.result.title && (
              <Text style={styles.previewTitle}>{state.result.title}</Text>
            )}
            {state.result.description && (
              <Text style={styles.previewDescription} numberOfLines={3}>
                {state.result.description}
              </Text>
            )}

            <View style={styles.previewMeta}>
              {state.result.prep_time_minutes != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSlate} />
                  <Text style={styles.metaText}>Prep: {state.result.prep_time_minutes}m</Text>
                </View>
              )}
              {state.result.cook_time_minutes != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="flame-outline" size={14} color={Colors.textSlate} />
                  <Text style={styles.metaText}>Cook: {state.result.cook_time_minutes}m</Text>
                </View>
              )}
              {state.result.servings != null && (
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={14} color={Colors.textSlate} />
                  <Text style={styles.metaText}>{state.result.servings} servings</Text>
                </View>
              )}
            </View>

            <View style={styles.previewStats}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{state.result.ingredients.length}</Text>
                <Text style={styles.statLabel}>Ingredients</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{state.result.steps.length}</Text>
                <Text style={styles.statLabel}>Steps</Text>
              </View>
              {state.result.difficulty && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statNum}>
                      {state.result.difficulty === 'easy' ? '🟢' : state.result.difficulty === 'medium' ? '🟡' : '🔴'}
                    </Text>
                    <Text style={styles.statLabel}>{state.result.difficulty}</Text>
                  </View>
                </>
              )}
            </View>

            {state.result.tags.length > 0 && (
              <View style={styles.tagRow}>
                {state.result.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.importBtn} onPress={handleImport} accessibilityLabel="Import this recipe">
              <Ionicons name="add-circle-outline" size={20} color={Colors.bgWhite} />
              <Text style={styles.importBtnText}>Add to My Recipes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shoppingBtn} onPress={handleAddToShopping} accessibilityLabel="Add ingredients to shopping list">
              <Ionicons name="cart-outline" size={18} color={Colors.primary} />
              <Text style={styles.shoppingBtnText}>Add to Shopping List</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tryAnotherBtn} onPress={handleRetry}>
              <Text style={styles.tryAnotherText}>Import another URL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Supported sites hint ────────────────────────────────────────────── */}
        {state.type === 'idle' && (
          <View style={styles.hintsSection}>
            <Text style={styles.hintsTitle}>Works great with</Text>
            <View style={styles.siteGrid}>
              {POPULAR_SITES.map((site) => (
                <View key={site.domain} style={styles.siteTile}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={Colors.privateGreen} />
                  <Text style={styles.siteName}>{site.name}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.hintsNote}>
              Any site with structured recipe data (schema.org/Recipe) is supported — this includes most major cooking websites.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgMuted,
    backgroundColor: Colors.bgWhite,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },

  scroll: { padding: Spacing.xl, paddingBottom: 60 },

  // Hero
  hero: { alignItems: 'center', marginBottom: 28 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Shadows.primary,
  },
  heroEmoji: { fontSize: 32 },
  heroTitle: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: 6 },
  heroSubtitle: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textSlate, textAlign: 'center', lineHeight: FontSize.sm.lineHeight },

  // Input
  inputWrap: {
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputWrapFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: 52 },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  pasteBtn: {
    backgroundColor: Colors.bgMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Spacing.sm,
  },
  pasteBtnText: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.textSecondary },

  // Extract button
  extractBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: Radii.lg,
    marginBottom: 20,
    ...Shadows.primary,
  },
  extractBtnDisabled: { backgroundColor: Colors.borderStrong, shadowOpacity: 0 },
  extractBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.bold, fontSize: FontSize.base.size },

  // Loading
  loadingCard: {
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    gap: 6,
  },
  loadingText: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  loadingSubtext: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint },

  // Error
  errorCard: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    marginBottom: 20,
    gap: Spacing.sm,
  },
  errorIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  errorTitle: { fontSize: FontSize.base.size, fontFamily: FontFamily.bold, color: Colors.errorDark },
  errorMessage: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: '#b91c1c', textAlign: 'center', lineHeight: FontSize.sm.lineHeight },
  retryBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.errorDark,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  retryBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: FontSize.sm.size },

  // Success preview
  previewCard: {
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  previewImage: {
    width: '100%',
    height: 200,
  },
  previewHeader: { marginBottom: Spacing.md, paddingHorizontal: 20, paddingTop: Spacing.lg },
  successBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successBadgeText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.privateGreen },
  previewTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm, lineHeight: 26 },
  previewDescription: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textSlate, lineHeight: FontSize.sm.lineHeight, marginBottom: 14, paddingHorizontal: 20 },
  previewMeta: { flexDirection: 'row', gap: 14, marginBottom: Spacing.lg, flexWrap: 'wrap', paddingHorizontal: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSlate },

  previewStats: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  statLabel: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.lg, paddingHorizontal: 20 },
  tag: { backgroundColor: Colors.bgMuted, paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: Radii.full },
  tagText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.medium, color: Colors.textSecondary },

  importBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radii.lg,
    marginBottom: 10,
    marginHorizontal: 20,
    ...Shadows.primary,
  },
  importBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.bold, fontSize: FontSize.base.size },
  shoppingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 13,
    borderRadius: Radii.lg,
    marginBottom: 10,
    marginHorizontal: 20,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
  },
  shoppingBtnText: {
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  tryAnotherBtn: { alignItems: 'center', padding: Spacing.sm, marginBottom: Spacing.lg },
  tryAnotherText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.textFaint },

  // Hints
  hintsSection: { marginTop: Spacing.sm },
  hintsTitle: { fontSize: 13, fontFamily: FontFamily.bold, color: Colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.md },
  siteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: 14 },
  siteTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgWhite,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  siteName: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textPrimary },
  hintsNote: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, lineHeight: 18 },
});
