import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Image, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import { useShoppingStore } from '@/features/shopping/shoppingStore';
import { pickImageFromLibrary, takePhoto, uploadRecipeImage } from '@/services/imageService';
import { extractTextFromImage } from '@/services/ocrService';
import { parseRecipeText } from '@/services/parsingService';
import { Difficulty } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/services/supabaseClient';
import UnitPickerModal from '@/components/UnitPickerModal';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snacks', 'Drinks', 'Soups', 'Salads', 'Other'];

/**
 * AI sometimes returns combined strings like "225g", "1 medium", "2tbsp".
 * Split them into a proper { quantity, unit } pair.
 */
function parseAIIngredient(
  rawQty: string | number | null,
  rawUnit: string | null,
): { quantity: string; unit: string } {
  // Treat the string "null" the same as actual null; coerce numbers to string
  const qty = (rawQty === 'null' || rawQty == null) ? '' : String(rawQty).trim();
  const unit = (rawUnit === 'null' || rawUnit == null) ? '' : String(rawUnit).trim();

  if (!qty) return { quantity: '', unit };

  // If unit is already set by the AI, trust it — just clean the quantity
  if (unit) {
    const numOnly = qty.replace(/[^\d.\/\s]/g, '').trim();
    return { quantity: numOnly || qty, unit };
  }

  // Try to split "225g" / "2tbsp" / "1.5kg" / "300ml" → number + letters
  const match = qty.match(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*([a-zA-Z].*)$/);
  if (match) {
    return { quantity: match[1]!.replace(',', '.'), unit: match[2]!.trim() };
  }

  // "1 medium", "2 large" — number + space + word
  const spaceMatch = qty.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (spaceMatch) {
    return { quantity: spaceMatch[1]!, unit: spaceMatch[2]!.trim() };
  }

  // Plain number or unparseable — keep as-is
  return { quantity: qty, unit };
}

interface IngredientDraft { id: string; name: string; quantity: string; unit: string }
interface StepDraft { id: string; instruction: string }

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ parsed?: string }>();
  const { user } = useAuthStore();
  const { createRecipe, isLoading } = useRecipeStore();
  const addFromRecipe = useShoppingStore((s) => s.addFromRecipe);

  interface ParsedParams {
    title?: string;
    description?: string;
    difficulty?: Difficulty;
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    servings?: number;
    category?: string;
    cuisine?: string;
    tags?: string[];
    ingredients?: { name: string; quantity: string | null; unit: string | null }[];
    steps?: string[];
    cover_image_url?: string;
  }
  let initParsed: ParsedParams | null = null;
  try {
    initParsed = params.parsed ? JSON.parse(params.parsed) : null;
  } catch {
    // malformed params — start with blank form
  }

  const initIngredients: IngredientDraft[] = initParsed?.ingredients?.map(
    (i: { name: string; quantity: string | null; unit: string | null }) => {
      const { quantity, unit } = parseAIIngredient(i.quantity, i.unit);
      return { id: uuidv4(), name: i.name, quantity, unit };
    },
  ) ?? [{ id: uuidv4(), name: '', quantity: '', unit: '' }];

  const [title, setTitle] = useState<string>(initParsed?.title ?? '');
  const [description, setDescription] = useState<string>(initParsed?.description ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initParsed?.difficulty ?? 'medium');
  const [prepTime, setPrepTime] = useState<string>(String(initParsed?.prep_time_minutes ?? ''));
  const [cookTime, setCookTime] = useState<string>(String(initParsed?.cook_time_minutes ?? ''));
  const [servings, setServings] = useState<string>(String(initParsed?.servings ?? ''));
  const [category, setCategory] = useState<string>(initParsed?.category ?? '');
  const [cuisine, setCuisine] = useState<string>(initParsed?.cuisine ?? '');
  const [tags, setTags] = useState<string>(initParsed?.tags?.join(', ') ?? '');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(initIngredients);
  const [steps, setSteps] = useState<StepDraft[]>(
    initParsed?.steps?.map((s: string) => ({ id: uuidv4(), instruction: s })) ?? [{ id: uuidv4(), instruction: '' }],
  );
  const [ocrLoading, setOcrLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const [coverImages, setCoverImages] = useState<string[]>(
    initParsed?.cover_image_url ? [initParsed.cover_image_url] : [],
  );

  // Servings scaling: snapshot base values on first non-empty servings entry
  const baseServingsRef = useRef<number | null>(
    initParsed?.servings != null ? initParsed.servings : null,
  );
  const baseIngredientsRef = useRef<IngredientDraft[]>(initIngredients.map((i) => ({ ...i })));

  // Unit picker modal
  const [unitPickerTarget, setUnitPickerTarget] = useState<string | null>(null);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  // ─── OCR ────────────────────────────────────────────────────────────────────
  const handleOCR = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (!uri) return;
    setOcrLoading(true);
    try {
      const ocrResult = await extractTextFromImage(uri, source);
      if (!ocrResult.raw_text) {
        showToast('Could not extract text. You can type manually.', 'error');
        return;
      }
      const parsed = parseRecipeText(ocrResult.raw_text);
      if (parsed.title && !title) setTitle(parsed.title);
      if (parsed.prep_time_minutes && !prepTime) setPrepTime(String(parsed.prep_time_minutes));
      if (parsed.cook_time_minutes && !cookTime) setCookTime(String(parsed.cook_time_minutes));
      if (parsed.servings && !servings) {
        setServings(String(parsed.servings));
        baseServingsRef.current = parsed.servings;
      }
      setDifficulty(parsed.difficulty);
      if (parsed.ingredients.length > 0) {
        const newIngs = parsed.ingredients.map((i) => ({
          id: uuidv4(), name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '',
        }));
        setIngredients(newIngs);
        baseIngredientsRef.current = newIngs.map((i) => ({ ...i }));
      }
      if (parsed.steps.length > 0) {
        setSteps(parsed.steps.map((s) => ({ id: uuidv4(), instruction: s })));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setOcrLoading(false);
    }
  };

  // ─── Photos ─────────────────────────────────────────────────────────────────
  const handlePickCover = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (uri) setCoverImages((prev) => [...prev, uri]);
  };

  const handleRemoveCoverImage = (uri: string) => {
    setCoverImages((prev) => prev.filter((u) => u !== uri));
  };

  // ─── Servings scaling ───────────────────────────────────────────────────────
  const handleServingsChange = useCallback((val: string) => {
    setServings(val);
    const newServings = parseInt(val, 10);
    const base = baseServingsRef.current;
    if (!base || isNaN(newServings) || newServings <= 0) return;

    const ratio = newServings / base;
    setIngredients(
      baseIngredientsRef.current.map((ing) => {
        const parsed = parseFloat(ing.quantity);
        if (isNaN(parsed) || ing.quantity === '') return { ...ing };
        return { ...ing, quantity: String(parseFloat((parsed * ratio).toFixed(3))) };
      }),
    );
  }, []);

  const handleServingsBlur = useCallback(() => {
    const n = parseInt(servings, 10);
    if (!isNaN(n) && n > 0) {
      baseServingsRef.current = n;
      baseIngredientsRef.current = ingredients.map((i) => ({ ...i }));
    }
  }, [servings, ingredients]);

  // ─── Ingredients ────────────────────────────────────────────────────────────
  const addIngredient = () => {
    const blank: IngredientDraft = { id: uuidv4(), name: '', quantity: '', unit: '' };
    setIngredients((prev) => [...prev, blank]);
    baseIngredientsRef.current = [...baseIngredientsRef.current, blank];
  };

  const updateIngredient = (ingId: string, field: keyof IngredientDraft, value: string) => {
    setIngredients((prev) => prev.map((i) => i.id === ingId ? { ...i, [field]: value } : i));
    baseIngredientsRef.current = baseIngredientsRef.current.map((i) =>
      i.id === ingId ? { ...i, [field]: value } : i,
    );
  };

  const removeIngredient = (ingId: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== ingId));
    baseIngredientsRef.current = baseIngredientsRef.current.filter((i) => i.id !== ingId);
  };

  // ─── Unit picker ────────────────────────────────────────────────────────────
  const openUnitPicker = (ingId: string) => {
    setUnitPickerTarget(ingId);
    setUnitPickerVisible(true);
  };

  const handleUnitSelect = (unit: string, newQuantity: string) => {
    if (!unitPickerTarget) return;
    updateIngredient(unitPickerTarget, 'unit', unit);
    updateIngredient(unitPickerTarget, 'quantity', newQuantity);
  };

  const targetIngredient = ingredients.find((i) => i.id === unitPickerTarget);

  // ─── Steps ──────────────────────────────────────────────────────────────────
  const addStep = () => setSteps((prev) => [...prev, { id: uuidv4(), instruction: '' }]);
  const updateStep = (stepId: string, value: string) => {
    setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, instruction: value } : s));
  };
  const removeStep = (stepId: string) => setSteps((prev) => prev.filter((s) => s.id !== stepId));

  // ─── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { showToast('Please enter a recipe title', 'error'); return; }
    if (!user) { showToast('Please sign in to save recipes', 'error'); return; }

    let recipe;
    try {
      recipe = await createRecipe({
        title: title.trim(),
        description: description.trim() || null,
        difficulty,
        prep_time_minutes: prepTime ? parseInt(prepTime, 10) : null,
        cook_time_minutes: cookTime ? parseInt(cookTime, 10) : null,
        servings: servings ? parseInt(servings, 10) : null,
        category: category || null,
        cuisine: cuisine || null,
        group_id: null,
        is_favorite: false,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        owner_user_id: user.id,
        created_by: user.id,
        updated_by: user.id,
        ingredients: ingredients.filter((i) => i.name.trim()).map((i, idx) => ({
          id: uuidv4(), name: i.name.trim(), quantity: i.quantity || null, unit: i.unit || null, position: idx,
        })),
        steps: steps.filter((s) => s.instruction.trim()).map((s, idx) => ({
          id: uuidv4(), instruction: s.instruction.trim(), position: idx,
        })),
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed. Please try again.', 'error');
      return;
    }

    for (const imgUri of coverImages) {
      const imageId = uuidv4();
      if (imgUri.startsWith('http')) {
        const imageRow = { id: imageId, recipe_id: recipe.id, storage_path: imgUri };
        if (Platform.OS === 'web') {
          supabase.from('recipe_images').insert(imageRow).then(({ error }) => {
            if (error) console.warn('[NewRecipe] remote image insert failed', error);
          });
        } else {
          import('@/db/repositories/recipeRepository').then(({ recipeImageRepository }) =>
            recipeImageRepository.insert(imageRow),
          ).catch((e) => console.warn('[NewRecipe] remote image insert failed', e));
        }
      } else {
        uploadRecipeImage(imgUri, user.id).then((result) => {
          if (!result) return;
          const imageRow = { id: imageId, recipe_id: recipe.id, storage_path: result.storagePath, local_uri: imgUri };
          if (Platform.OS === 'web') {
            supabase.from('recipe_images').insert(imageRow).then(({ error }) => {
              if (error) console.warn('[NewRecipe] local image insert failed', error);
            });
          } else {
            import('@/db/repositories/recipeRepository').then(({ recipeImageRepository }) =>
              recipeImageRepository.insert(imageRow),
            ).catch((e: unknown) => console.warn('[NewRecipe] local image insert failed', e));
          }
        }).catch((e: unknown) => console.warn('[NewRecipe] image upload failed', e));
      }
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Recipe saved!', 'success');
    setTimeout(() => router.replace(`/recipe/${recipe.id}`), 1500);
  }, [title, description, difficulty, prepTime, cookTime, servings, category, cuisine, tags, ingredients, steps, coverImages, user, addFromRecipe, showToast]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={goBack} style={styles.navBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Recipe</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={Colors.bgWhite} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Import options */}
        <View style={styles.importRow}>
          <TouchableOpacity style={styles.importBtn} onPress={() => handleOCR('camera')} disabled={ocrLoading}>
            <Ionicons name="camera-outline" size={18} color={Colors.primary} />
            <Text style={styles.importBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtn} onPress={() => handleOCR('gallery')} disabled={ocrLoading}>
            <Ionicons name="image-outline" size={18} color={Colors.primary} />
            <Text style={styles.importBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.importBtnUrl} onPress={() => router.push('/recipe/import-url')} disabled={ocrLoading}>
            <Ionicons name="link-outline" size={18} color={Colors.bgWhite} />
            <Text style={styles.importBtnUrlText}>Import URL</Text>
          </TouchableOpacity>
          {ocrLoading && <ActivityIndicator color={Colors.primary} />}
        </View>

        {/* AI Recipe Generator */}
        <TouchableOpacity
          style={styles.aiBtn}
          onPress={() => router.push('/recipe/generate')}
          disabled={ocrLoading}
          accessibilityLabel="Generate recipe with AI"
        >
          <Ionicons name="sparkles-outline" size={18} color={Colors.bgWhite} />
          <Text style={styles.aiBtnText}>Generate Recipe from Fridge / Ingredients</Text>
        </TouchableOpacity>

        {/* Photos */}
        <View style={styles.photosSection}>
          <Text style={styles.fieldLabel}>Photos</Text>
          <FlatList
            data={[...coverImages.map((uri) => ({ id: uri, uri })), { id: '__add__', uri: '' }]}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosList}
            renderItem={({ item }) => {
              if (item.id === '__add__') {
                return (
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={() => handlePickCover('gallery')} accessibilityLabel="Add photo">
                    <Ionicons name="add" size={28} color={Colors.textFaint} />
                    <Text style={styles.addPhotoBtnText}>Add</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.photoThumbWrap}>
                  <Image source={{ uri: item.uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => handleRemoveCoverImage(item.uri)}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>

        {/* Basic info */}
        <Field label="Title *">
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Spaghetti Carbonara" placeholderTextColor={Colors.textFaint} accessibilityLabel="Recipe title" />
        </Field>
        <Field label="Description">
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="A short description..." placeholderTextColor={Colors.textFaint} multiline numberOfLines={3} accessibilityLabel="Recipe description" />
        </Field>

        {/* Times & servings */}
        <View style={styles.row3}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Prep (min)</Text>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" placeholder="15" placeholderTextColor={Colors.textFaint} accessibilityLabel="Prep time in minutes" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Cook (min)</Text>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholder="30" placeholderTextColor={Colors.textFaint} accessibilityLabel="Cook time in minutes" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Servings</Text>
            <TextInput
              style={styles.input}
              value={servings}
              onChangeText={handleServingsChange}
              onBlur={handleServingsBlur}
              keyboardType="numeric"
              placeholder="4"
              placeholderTextColor={Colors.textFaint}
              accessibilityLabel="Number of servings"
            />
          </View>
        </View>
        {baseServingsRef.current != null && (
          <Text style={styles.scalingHint}>Ingredient amounts scale automatically when you change servings</Text>
        )}

        {/* Difficulty */}
        <Field label="Difficulty">
          <View style={styles.diffRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
                onPress={() => setDifficulty(d)}
              >
                <Text style={[styles.diffBtnText, difficulty === d && styles.diffBtnTextActive]}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {/* Category */}
        <Field label="Category">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(category === cat ? '' : cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        <Field label="Cuisine">
          <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="e.g. Italian" placeholderTextColor={Colors.textFaint} accessibilityLabel="Cuisine type" />
        </Field>

        <Field label="Tags (comma separated)">
          <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="e.g. vegan, quick, family" placeholderTextColor={Colors.textFaint} accessibilityLabel="Recipe tags" />
        </Field>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredients.map((ing, idx) => (
          <View key={ing.id} style={styles.ingRow}>
            <TextInput
              style={[styles.input, styles.qtyInput]}
              value={ing.quantity}
              onChangeText={(v) => updateIngredient(ing.id, 'quantity', v)}
              placeholder="1"
              placeholderTextColor={Colors.textFaint}
              keyboardType="decimal-pad"
              accessibilityLabel={`Ingredient ${idx + 1} quantity`}
            />
            {/* Unit picker button */}
            <TouchableOpacity
              style={styles.unitBtn}
              onPress={() => openUnitPicker(ing.id)}
              accessibilityLabel={`Ingredient ${idx + 1} unit`}
            >
              <Text style={styles.unitBtnText} numberOfLines={1}>
                {ing.unit || 'unit'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={Colors.textFaint} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { flex: 2 }]}
              value={ing.name}
              onChangeText={(v) => updateIngredient(ing.id, 'name', v)}
              placeholder="Flour"
              placeholderTextColor={Colors.textFaint}
              accessibilityLabel={`Ingredient ${idx + 1} name`}
            />
            <TouchableOpacity onPress={() => removeIngredient(ing.id)} style={styles.removeBtn} accessibilityLabel="Remove ingredient">
              <Ionicons name="remove-circle-outline" size={22} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowBtnText}>Add Ingredient</Text>
        </TouchableOpacity>

        {/* Steps */}
        <Text style={styles.sectionTitle}>Instructions</Text>
        {steps.map((step, idx) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{idx + 1}</Text></View>
            <TextInput
              style={[styles.input, styles.multiline, { flex: 1 }]}
              value={step.instruction}
              onChangeText={(v) => updateStep(step.id, v)}
              placeholder="Describe this step..."
              placeholderTextColor={Colors.textFaint}
              multiline
              accessibilityLabel={`Step ${idx + 1}`}
            />
            <TouchableOpacity onPress={() => removeStep(step.id)} style={styles.removeBtn} accessibilityLabel="Remove step">
              <Ionicons name="remove-circle-outline" size={22} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowBtnText}>Add Step</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Unit picker modal */}
      <UnitPickerModal
        visible={unitPickerVisible}
        currentUnit={targetIngredient?.unit ?? ''}
        currentQuantity={targetIngredient?.quantity ?? ''}
        onSelect={handleUnitSelect}
        onClose={() => setUnitPickerVisible(false)}
      />

      {toast && (
        <View style={[styles.toast, toast.type === 'error' && styles.toastError, toast.type === 'success' && styles.toastSuccess]}>
          <Ionicons name={toast.type === 'error' ? 'alert-circle' : toast.type === 'success' ? 'checkmark-circle' : 'information-circle'} size={18} color={Colors.bgWhite} />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted },
  navBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radii.md, minHeight: 40, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 15 },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  importRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, alignItems: 'center' },
  importBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primaryBg, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.primaryBorder, minHeight: 44 },
  importBtnText: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.primary },
  importBtnUrl: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.textPrimary, borderRadius: 12, paddingVertical: 11, minHeight: 44 },
  importBtnUrlText: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.bgWhite },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryMid, borderRadius: 12, paddingVertical: 13, marginBottom: 20, minHeight: 48 },
  aiBtnText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.bgWhite },
  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 48 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row3: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  scalingHint: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textFaint, marginBottom: Spacing.lg, marginLeft: 2 },
  diffRow: { flexDirection: 'row', gap: Spacing.sm },
  diffBtn: { flex: 1, padding: Spacing.md, borderRadius: Radii.md, backgroundColor: Colors.bgMuted, alignItems: 'center', minHeight: 44 },
  diffBtnActive: { backgroundColor: Colors.primaryBg, borderWidth: 1, borderColor: Colors.primary },
  diffBtnText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  diffBtnTextActive: { color: Colors.primary },
  chip: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: Radii.full, backgroundColor: Colors.bgMuted, marginRight: Spacing.sm, minHeight: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.primaryBg, borderWidth: 1, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  sectionTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginTop: Spacing.lg, marginBottom: 10 },
  ingRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm, alignItems: 'center' },
  qtyInput: { flex: 1, maxWidth: 90, minWidth: 44 },
  unitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    maxWidth: 100,
    minWidth: 56,
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    justifyContent: 'center',
  },
  unitBtnText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.medium, color: '#374151', flexShrink: 1 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.primary },
  removeBtn: { padding: Spacing.xs, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: 10, marginTop: Spacing.xs, minHeight: 44 },
  addRowBtnText: { fontSize: 15, fontFamily: FontFamily.medium, color: Colors.primary },
  photosSection: { marginBottom: 20 },
  photosList: { gap: 10, paddingBottom: Spacing.xs },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 100, height: 100, borderRadius: 12 },
  photoRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.bgWhite, borderRadius: Radii.md },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: 12,
    backgroundColor: Colors.bgMuted, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
  },
  addPhotoBtnText: { fontSize: FontSize.xs.size, fontFamily: FontFamily.medium, color: Colors.textFaint },

  toast: {
    position: 'absolute', bottom: Spacing['2xl'], left: 20, right: 20,
    backgroundColor: Colors.primary, borderRadius: Radii.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 13,
    ...Shadows.card,
  },
  toastError: { backgroundColor: Colors.danger },
  toastSuccess: { backgroundColor: Colors.primaryMid },
  toastText: { flex: 1, fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.bgWhite },
});
