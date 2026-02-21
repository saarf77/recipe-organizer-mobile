/**
 * AI Recipe Generator Screen
 *
 * Two modes:
 *  1. Photo mode  — take/pick a fridge photo, AI vision identifies ingredients & creates recipe
 *  2. Text mode   — type a list of ingredients, AI suggests a recipe
 *
 * On success → navigates to New Recipe screen pre-filled with the AI result.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { takePhoto, pickImageFromLibrary } from '@/services/imageService';
import { supabase } from '@/services/supabaseClient';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

type Mode = 'photo' | 'text';

async function imageToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  // Already a data URL (common on web)
  if (uri.startsWith('data:')) {
    const [header, base64] = uri.split(',');
    const mimeType = header?.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
    return { base64: base64 ?? '', mimeType };
  }

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve({ base64: result.split(',')[1] ?? '', mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Native: use expo-file-system
  const FileSystem = await import('expo-file-system');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, mimeType: 'image/jpeg' };
}

export default function GenerateRecipeScreen() {
  const [mode, setMode] = useState<Mode>('text');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ingredientText, setIngredientText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickImage = useCallback(async (source: 'camera' | 'gallery') => {
    const uri = source === 'camera' ? await takePhoto() : await pickImageFromLibrary();
    if (uri) { setImageUri(uri); setError(null); }
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsGenerating(true);
    try {
      let body: Record<string, unknown>;

      if (mode === 'photo') {
        if (!imageUri) {
          setError('Please take or pick a photo first.');
          return;
        }
        const { base64, mimeType } = await imageToBase64(imageUri);
        body = { image_base64: base64, mime_type: mimeType };
      } else {
        const ingredients = ingredientText
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (ingredients.length === 0) {
          setError('Please enter at least one ingredient.');
          return;
        }
        body = { ingredients };
      }

      const { data, error: fnError } = await supabase.functions.invoke('generate-recipe', { body });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      router.push({
        pathname: '/recipe/new',
        params: { parsed: JSON.stringify(data), fromAI: 'true' },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [mode, imageUri, ingredientText]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>AI Recipe Generator</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.sparkle}>✨</Text>
          <Text style={styles.headerTitle}>What's in your fridge?</Text>
          <Text style={styles.headerSubtitle}>
            Take a photo or list ingredients — the AI will craft a recipe for you.
          </Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'text' && styles.modeBtnActive]}
            onPress={() => setMode('text')}
          >
            <Ionicons name="list-outline" size={18} color={mode === 'text' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.modeBtnText, mode === 'text' && styles.modeBtnTextActive]}>
              Type ingredients
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'photo' && styles.modeBtnActive]}
            onPress={() => setMode('photo')}
          >
            <Ionicons name="camera-outline" size={18} color={mode === 'photo' ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.modeBtnText, mode === 'photo' && styles.modeBtnTextActive]}>
              Fridge photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Text mode */}
        {mode === 'text' && (
          <View style={styles.section}>
            <Text style={styles.label}>Ingredients you have</Text>
            <TextInput
              style={styles.textarea}
              value={ingredientText}
              onChangeText={setIngredientText}
              placeholder={'e.g.\nchicken breast\npasta\ntomatoes\ngarlic\nolive oil'}
              placeholderTextColor={Colors.textFaint}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <Text style={styles.hint}>One per line, or comma-separated</Text>
          </View>
        )}

        {/* Photo mode */}
        {mode === 'photo' && (
          <View style={styles.section}>
            <Text style={styles.label}>Fridge or pantry photo</Text>
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <TouchableOpacity style={styles.changeImageBtn} onPress={() => setImageUri(null)}>
                  <Ionicons name="close-circle" size={26} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPickerRow}>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={() => handlePickImage('camera')}>
                  <Ionicons name="camera-outline" size={28} color={Colors.primary} />
                  <Text style={styles.photoPickerBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoPickerBtn} onPress={() => handlePickImage('gallery')}>
                  <Ionicons name="image-outline" size={28} color={Colors.primary} />
                  <Text style={styles.photoPickerBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.hint}>
              AI vision analyzes your photo and identifies ingredients automatically
            </Text>
          </View>
        )}

        {/* Inline error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.8}
        >
          {isGenerating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={Colors.bgWhite} size="small" />
              <Text style={styles.generateBtnText}>Generating recipe…</Text>
            </View>
          ) : (
            <View style={styles.generatingRow}>
              <Ionicons name="sparkles-outline" size={20} color={Colors.bgWhite} />
              <Text style={styles.generateBtnText}>Generate Recipe</Text>
            </View>
          )}
        </TouchableOpacity>

        {isGenerating && (
          <Text style={styles.generatingHint}>
            This can take up to 15 seconds…
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgMuted,
  },
  navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  scroll: { padding: Spacing.xl, paddingBottom: 60 },
  headerCard: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  sparkle: { fontSize: 40, marginBottom: Spacing.sm },
  headerTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: 6 },
  headerSubtitle: {
    fontSize: FontSize.sm.size,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: FontSize.sm.lineHeight,
  },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
    minHeight: 48,
  },
  modeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  modeBtnText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.medium, color: Colors.textMuted },
  modeBtnTextActive: { color: Colors.primary },
  section: { marginBottom: Spacing.xl },
  label: { fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  textarea: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
    minHeight: 160,
  },
  hint: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 6 },
  photoPickerRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  photoPickerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 24,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
    backgroundColor: Colors.primaryBg,
    minHeight: 100,
  },
  photoPickerBtnText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.primary },
  imagePreviewWrap: { position: 'relative', borderRadius: Radii.lg, overflow: 'hidden', marginBottom: Spacing.sm },
  imagePreview: { width: '100%', height: 220, borderRadius: Radii.lg },
  changeImageBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: Colors.bgWhite, borderRadius: Radii.lg },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorText: { flex: 1, fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.danger },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  generateBtnDisabled: { backgroundColor: Colors.primaryMid },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateBtnText: { fontSize: FontSize.base.size, fontFamily: FontFamily.semibold, color: Colors.bgWhite },
  generatingHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: Colors.textFaint,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
