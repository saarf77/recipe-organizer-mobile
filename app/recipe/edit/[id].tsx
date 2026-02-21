import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Image, Platform, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { pickImageFromLibrary, uploadRecipeImage } from '@/services/imageService';
import { useAuthStore } from '@/features/auth/authStore';
import { Difficulty } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/services/supabaseClient';
import UnitPickerModal from '@/components/UnitPickerModal';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snacks', 'Drinks', 'Soups', 'Salads', 'Other'];

interface IngredientDraft { id: string; name: string; quantity: string; unit: string }
interface StepDraft { id: string; instruction: string }
interface ImageDraft { id: string; uri: string; isNew: boolean }

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { fetchById, updateRecipe, isLoading } = useRecipeStore();

  const [initialized, setInitialized] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [tags, setTags] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { id: uuidv4(), name: '', quantity: '', unit: '' },
  ]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepDraft[]>([
    { id: uuidv4(), instruction: '' },
  ]);

  // Servings scaling: keep a snapshot of ingredients at the "base" servings
  const baseServingsRef = useRef<number | null>(null);
  const baseIngredientsRef = useRef<IngredientDraft[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Unit picker modal
  const [unitPickerTarget, setUnitPickerTarget] = useState<string | null>(null);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      await fetchById(id);
      const recipe = useRecipeStore.getState().currentRecipe;
      if (!recipe) return;

      if (user && recipe.owner_user_id !== user.id) {
        Alert.alert('Permission denied', 'You can only edit your own recipes.');
        goBack();
        return;
      }

      setTitle(recipe.title);
      setDescription(recipe.description ?? '');
      setDifficulty(recipe.difficulty);
      setPrepTime(recipe.prep_time_minutes != null ? String(recipe.prep_time_minutes) : '');
      setCookTime(recipe.cook_time_minutes != null ? String(recipe.cook_time_minutes) : '');

      const srv = recipe.servings != null ? String(recipe.servings) : '';
      setServings(srv);

      setCategory(recipe.category ?? '');
      setCuisine(recipe.cuisine ?? '');
      setTags(recipe.tags.join(', '));

      const loadedIngredients: IngredientDraft[] = (recipe.ingredients && recipe.ingredients.length > 0)
        ? recipe.ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity ?? '',
            unit: i.unit ?? '',
          }))
        : [{ id: uuidv4(), name: '', quantity: '', unit: '' }];

      setIngredients(loadedIngredients);

      // Store base values for scaling
      if (recipe.servings != null) {
        baseServingsRef.current = recipe.servings;
        baseIngredientsRef.current = loadedIngredients.map((i) => ({ ...i }));
      }

      if (recipe.steps && recipe.steps.length > 0) {
        setSteps(recipe.steps.map((s) => ({ id: s.id, instruction: s.instruction })));
      }
      if (recipe.images && recipe.images.length > 0) {
        setImages(recipe.images.map((img) => ({
          id: img.id,
          uri: img.local_uri ?? img.storage_path,
          isNew: false,
        })));
      }
      setInitialized(true);
    }
    load();
  }, [id]);

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
        const scaled = parseFloat((parsed * ratio).toFixed(3));
        return { ...ing, quantity: String(scaled) };
      }),
    );
  }, []);

  // When user finishes editing servings field (blur / confirm), update base snapshot
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
    // keep base in sync when user edits manually
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

  // ─── Images ─────────────────────────────────────────────────────────────────
  const handleAddImage = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) {
      setImages((prev) => [...prev, { id: uuidv4(), uri, isNew: true }]);
    }
  };

  const handleRemoveImage = (imgId: string, isNew: boolean) => {
    setImages((prev) => prev.filter((img) => img.id !== imgId));
    if (!isNew) {
      setRemovedImageIds((prev) => [...prev, imgId]);
    }
  };

  // ─── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a recipe title.'); return; }
    if (!id) return;

    await updateRecipe(id, {
      title: title.trim(),
      description: description.trim() || null,
      difficulty,
      prep_time_minutes: prepTime ? parseInt(prepTime, 10) : null,
      cook_time_minutes: cookTime ? parseInt(cookTime, 10) : null,
      servings: servings ? parseInt(servings, 10) : null,
      category: category || null,
      cuisine: cuisine || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      ingredients: ingredients.filter((i) => i.name.trim()).map((i, idx) => ({
        id: i.id, name: i.name.trim(), quantity: i.quantity || null, unit: i.unit || null, position: idx,
      })),
      steps: steps.filter((s) => s.instruction.trim()).map((s, idx) => ({
        id: s.id, instruction: s.instruction.trim(), position: idx,
      })),
    });

    for (const imgId of removedImageIds) {
      if (Platform.OS === 'web') {
        supabase.from('recipe_images').delete().eq('id', imgId).then(({ error }) => {
          if (error) console.warn('[EditRecipe] image delete failed', error);
        });
      } else {
        import('@/db/repositories/recipeRepository').then(({ recipeImageRepository }) =>
          recipeImageRepository.delete(imgId)
        ).catch((e) => console.warn('[EditRecipe] image delete failed', e));
      }
    }

    if (user) {
      for (const img of images.filter((i) => i.isNew)) {
        const imageId = img.id;
        if (img.uri.startsWith('http')) {
          const imageRow = { id: imageId, recipe_id: id as string, storage_path: img.uri };
          if (Platform.OS === 'web') {
            supabase.from('recipe_images').insert(imageRow).then(({ error }) => {
              if (error) console.warn('[EditRecipe] remote image insert failed', error);
            });
          } else {
            import('@/db/repositories/recipeRepository').then(({ recipeImageRepository }) =>
              recipeImageRepository.insert(imageRow)
            ).catch((e: unknown) => console.warn('[EditRecipe] remote image insert failed', e));
          }
        } else {
          uploadRecipeImage(img.uri, user.id).then((result) => {
            if (!result) return;
            const imageRow = { id: imageId, recipe_id: id as string, storage_path: result.storagePath, local_uri: img.uri };
            if (Platform.OS === 'web') {
              supabase.from('recipe_images').insert(imageRow).then(({ error }) => {
                if (error) console.warn('[EditRecipe] image upload insert failed', error);
              });
            } else {
              import('@/db/repositories/recipeRepository').then(({ recipeImageRepository }) =>
                recipeImageRepository.insert(imageRow)
              ).catch((e: unknown) => console.warn('[EditRecipe] image upload insert failed', e));
            }
          }).catch((e: unknown) => console.warn('[EditRecipe] image upload failed', e));
        }
      }
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('Recipe updated!', 'success');
    setTimeout(() => goBack(), 1500);
  }, [id, title, description, difficulty, prepTime, cookTime, servings, category, cuisine, tags, ingredients, steps, images, removedImageIds, user, showToast]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (!initialized) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} accessibilityLabel="Cancel">
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Edit Recipe</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isLoading} accessibilityLabel="Save changes">
          {isLoading ? <ActivityIndicator color={Colors.bgWhite} size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photos */}
        <View style={styles.photosSection}>
          <Text style={styles.fieldLabel}>Photos</Text>
          <FlatList
            data={[...images, { id: '__add__', uri: '', isNew: false }]}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosList}
            renderItem={({ item }) => {
              if (item.id === '__add__') {
                return (
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddImage} accessibilityLabel="Add photo">
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
                    onPress={() => handleRemoveImage(item.id, item.isNew)}
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
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
          <Text style={styles.scalingHint}>
            Ingredient amounts scale automatically when you change servings
          </Text>
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
              <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
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
              <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
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
        <View style={[styles.toast, toast.type === 'error' && styles.toastError]}>
          <Ionicons name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={18} color={Colors.bgWhite} />
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
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted },
  navBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: Radii.md, minHeight: 40, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 15 },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  field: { marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 48 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row3: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  scalingHint: { fontSize: 11, fontFamily: FontFamily.regular, color: Colors.textFaint, marginBottom: Spacing.lg, marginLeft: 2 },
  diffRow: { flexDirection: 'row', gap: Spacing.sm },
  diffBtn: { flex: 1, padding: Spacing.md, borderRadius: Radii.md, backgroundColor: Colors.bgMuted, alignItems: 'center', minHeight: 44 },
  diffBtnActive: { backgroundColor: Colors.primaryBg, borderWidth: 1, borderColor: Colors.primary },
  diffBtnText: { fontSize: 14, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  diffBtnTextActive: { color: Colors.primary },
  chip: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: 20, backgroundColor: Colors.bgMuted, marginRight: Spacing.sm, minHeight: 36, justifyContent: 'center' },
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
  unitBtnText: { fontSize: 12, fontFamily: FontFamily.medium, color: '#374151', flexShrink: 1 },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumText: { fontSize: 14, fontFamily: FontFamily.bold, color: Colors.primary },
  removeBtn: { padding: Spacing.xs, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: 10, marginTop: 4, minHeight: 44 },
  addRowBtnText: { fontSize: 15, fontFamily: FontFamily.medium, color: Colors.primary },
  photosSection: { marginBottom: 20 },
  photosList: { gap: 10, paddingBottom: 4 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 100, height: 100, borderRadius: 12 },
  photoRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.bgWhite, borderRadius: Radii.md },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: 12,
    backgroundColor: Colors.bgMuted, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoBtnText: { fontSize: 12, fontFamily: FontFamily.medium, color: Colors.textFaint },
  toast: {
    position: 'absolute', bottom: 36, left: 20, right: 20,
    backgroundColor: Colors.primaryMid, borderRadius: Radii.lg,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 13,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  toastError: { backgroundColor: Colors.danger },
  toastText: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium, color: Colors.bgWhite },
});
