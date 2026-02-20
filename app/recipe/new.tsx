import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { useAuthStore } from '@/features/auth/authStore';
import { pickImageFromLibrary, takePhoto } from '@/services/imageService';
import { extractTextFromImage } from '@/services/ocrService';
import { parseRecipeText } from '@/services/parsingService';
import { Difficulty } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Desserts', 'Snacks', 'Drinks', 'Soups', 'Salads', 'Other'];

interface IngredientDraft { id: string; name: string; quantity: string; unit: string }
interface StepDraft { id: string; instruction: string }

export default function NewRecipeScreen() {
  const params = useLocalSearchParams<{ parsed?: string }>();
  const { user } = useAuthStore();
  const { createRecipe, isLoading } = useRecipeStore();

  const initParsed = params.parsed ? JSON.parse(params.parsed) : null;

  const [title, setTitle] = useState<string>(initParsed?.title ?? '');
  const [description, setDescription] = useState<string>(initParsed?.description ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initParsed?.difficulty ?? 'medium');
  const [prepTime, setPrepTime] = useState<string>(String(initParsed?.prep_time_minutes ?? ''));
  const [cookTime, setCookTime] = useState<string>(String(initParsed?.cook_time_minutes ?? ''));
  const [servings, setServings] = useState<string>(String(initParsed?.servings ?? ''));
  const [category, setCategory] = useState<string>(initParsed?.category ?? '');
  const [cuisine, setCuisine] = useState<string>('');
  const [tags, setTags] = useState<string>(initParsed?.tags?.join(', ') ?? '');

  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    initParsed?.ingredients?.map((i: { name: string; quantity: string | null; unit: string | null }) => ({
      id: uuidv4(), name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '',
    })) ?? [{ id: uuidv4(), name: '', quantity: '', unit: '' }]
  );

  const [steps, setSteps] = useState<StepDraft[]>(
    initParsed?.steps?.map((s: string) => ({ id: uuidv4(), instruction: s })) ?? [{ id: uuidv4(), instruction: '' }]
  );

  const [ocrLoading, setOcrLoading] = useState(false);

  const handleOCR = async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (!uri) return;
    setOcrLoading(true);
    try {
      const ocrResult = await extractTextFromImage(uri, source);
      if (!ocrResult.raw_text) {
        Alert.alert('OCR failed', 'Could not extract text. You can type manually.');
        return;
      }
      const parsed = parseRecipeText(ocrResult.raw_text);
      if (parsed.title && !title) setTitle(parsed.title);
      if (parsed.prep_time_minutes && !prepTime) setPrepTime(String(parsed.prep_time_minutes));
      if (parsed.cook_time_minutes && !cookTime) setCookTime(String(parsed.cook_time_minutes));
      if (parsed.servings && !servings) setServings(String(parsed.servings));
      setDifficulty(parsed.difficulty);
      if (parsed.ingredients.length > 0) {
        setIngredients(parsed.ingredients.map((i) => ({ id: uuidv4(), name: i.name, quantity: i.quantity ?? '', unit: i.unit ?? '' })));
      }
      if (parsed.steps.length > 0) {
        setSteps(parsed.steps.map((s) => ({ id: uuidv4(), instruction: s })));
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setOcrLoading(false);
    }
  };

  const addIngredient = () => setIngredients((prev) => [...prev, { id: uuidv4(), name: '', quantity: '', unit: '' }]);
  const updateIngredient = (id: string, field: keyof IngredientDraft, value: string) => {
    setIngredients((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };
  const removeIngredient = (id: string) => setIngredients((prev) => prev.filter((i) => i.id !== id));

  const addStep = () => setSteps((prev) => [...prev, { id: uuidv4(), instruction: '' }]);
  const updateStep = (id: string, value: string) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, instruction: value } : s));
  };
  const removeStep = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));

  const handleSave = useCallback(async () => {
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a recipe title.'); return; }
    if (!user) return;

    await createRecipe({
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

    router.back();
  }, [title, description, difficulty, prepTime, cookTime, servings, category, cuisine, tags, ingredients, steps, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="close" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Recipe</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* OCR capture */}
        <View style={styles.ocrRow}>
          <TouchableOpacity style={styles.ocrBtn} onPress={() => handleOCR('camera')} disabled={ocrLoading}>
            <Ionicons name="camera-outline" size={20} color="#f97316" />
            <Text style={styles.ocrBtnText}>Capture Recipe</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ocrBtn} onPress={() => handleOCR('gallery')} disabled={ocrLoading}>
            <Ionicons name="image-outline" size={20} color="#f97316" />
            <Text style={styles.ocrBtnText}>From Gallery</Text>
          </TouchableOpacity>
          {ocrLoading && <ActivityIndicator color="#f97316" />}
        </View>

        {/* Basic info */}
        <Field label="Title *">
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Spaghetti Carbonara" placeholderTextColor="#94a3b8" accessibilityLabel="Recipe title" />
        </Field>
        <Field label="Description">
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="A short description..." placeholderTextColor="#94a3b8" multiline numberOfLines={3} accessibilityLabel="Recipe description" />
        </Field>

        {/* Times & servings */}
        <View style={styles.row3}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Prep (min)</Text>
            <TextInput style={styles.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" placeholder="15" placeholderTextColor="#94a3b8" accessibilityLabel="Prep time in minutes" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Cook (min)</Text>
            <TextInput style={styles.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholder="30" placeholderTextColor="#94a3b8" accessibilityLabel="Cook time in minutes" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Servings</Text>
            <TextInput style={styles.input} value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="4" placeholderTextColor="#94a3b8" accessibilityLabel="Number of servings" />
          </View>
        </View>

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
          <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="e.g. Italian" placeholderTextColor="#94a3b8" accessibilityLabel="Cuisine type" />
        </Field>

        <Field label="Tags (comma separated)">
          <TextInput style={styles.input} value={tags} onChangeText={setTags} placeholder="e.g. vegan, quick, family" placeholderTextColor="#94a3b8" accessibilityLabel="Recipe tags" />
        </Field>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredients.map((ing, idx) => (
          <View key={ing.id} style={styles.ingRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={ing.quantity} onChangeText={(v) => updateIngredient(ing.id, 'quantity', v)} placeholder="1" placeholderTextColor="#94a3b8" accessibilityLabel={`Ingredient ${idx + 1} quantity`} />
            <TextInput style={[styles.input, { flex: 1 }]} value={ing.unit} onChangeText={(v) => updateIngredient(ing.id, 'unit', v)} placeholder="cup" placeholderTextColor="#94a3b8" accessibilityLabel={`Ingredient ${idx + 1} unit`} />
            <TextInput style={[styles.input, { flex: 2 }]} value={ing.name} onChangeText={(v) => updateIngredient(ing.id, 'name', v)} placeholder="Flour" placeholderTextColor="#94a3b8" accessibilityLabel={`Ingredient ${idx + 1} name`} />
            <TouchableOpacity onPress={() => removeIngredient(ing.id)} style={styles.removeBtn} accessibilityLabel="Remove ingredient">
              <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={20} color="#f97316" />
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
              placeholderTextColor="#94a3b8"
              multiline
              accessibilityLabel={`Step ${idx + 1}`}
            />
            <TouchableOpacity onPress={() => removeStep(step.id)} style={styles.removeBtn} accessibilityLabel="Remove step">
              <Ionicons name="remove-circle-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={20} color="#f97316" />
          <Text style={styles.addRowBtnText}>Add Step</Text>
        </TouchableOpacity>
      </ScrollView>
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  navBtn: { padding: 4, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  saveBtn: { backgroundColor: '#f97316', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10, minHeight: 40, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 60 },
  ocrRow: { flexDirection: 'row', gap: 12, marginBottom: 20, alignItems: 'center' },
  ocrBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fed7aa', minHeight: 48 },
  ocrBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#f97316' },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#475569', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#0f172a', minHeight: 48 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  row3: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  diffRow: { flexDirection: 'row', gap: 8 },
  diffBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', minHeight: 44 },
  diffBtnActive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f97316' },
  diffBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#475569' },
  diffBtnTextActive: { color: '#f97316' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, minHeight: 36, justifyContent: 'center' },
  chipActive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f97316' },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569' },
  chipTextActive: { color: '#f97316' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#0f172a', marginTop: 16, marginBottom: 10 },
  ingRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  stepRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  stepNumText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#f97316' },
  removeBtn: { padding: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 4, minHeight: 44 },
  addRowBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#f97316' },
});
