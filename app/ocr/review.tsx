import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { extractTextFromImage } from '@/services/ocrService';
import { parseRecipeText } from '@/services/parsingService';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

export default function OCRReviewScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [rawText, setRawText] = useState('');
  const [isOCRLoading, setIsOCRLoading] = useState(true);
  const [confidence, setConfidence] = useState(0);

  useEffect(() => {
    async function run() {
      if (!imageUri) return;
      setIsOCRLoading(true);
      const result = await extractTextFromImage(decodeURIComponent(imageUri), 'gallery');
      setRawText(result.raw_text);
      setConfidence(result.confidence);
      setIsOCRLoading(false);
    }
    run();
  }, [imageUri]);

  const handleUseText = () => {
    const parsed = parseRecipeText(rawText);
    router.push({ pathname: '/recipe/new', params: { parsed: JSON.stringify(parsed) } });
  };

  const handleManualEntry = () => {
    router.push('/recipe/new');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Review Extracted Text</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {imageUri && (
          <Image source={{ uri: decodeURIComponent(imageUri) }} style={styles.preview} resizeMode="cover" accessibilityLabel="Captured recipe image" />
        )}

        {isOCRLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Extracting text from image...</Text>
          </View>
        ) : (
          <>
            <View style={styles.confidenceRow}>
              <Ionicons name="scan-outline" size={16} color={Colors.textFaint} />
              <Text style={styles.confidenceText}>
                Confidence: {Math.round(confidence * 100)}%
              </Text>
              {confidence < 0.5 && (
                <Text style={styles.lowConfidence}> · Low confidence — please review</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Extracted Text</Text>
            <Text style={styles.hint}>Edit the text below before parsing.</Text>

            <TextInput
              style={styles.textArea}
              value={rawText}
              onChangeText={setRawText}
              multiline
              placeholder="Extracted text will appear here. You can edit it before parsing..."
              placeholderTextColor={Colors.textFaint}
              textAlignVertical="top"
              accessibilityLabel="Extracted recipe text"
            />

            {rawText.trim().length === 0 && (
              <View style={styles.noTextBanner}>
                <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                <Text style={styles.noTextMsg}>No text extracted. Switch to manual entry.</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, rawText.trim().length === 0 && styles.btnDisabled]}
                onPress={handleUseText}
                disabled={rawText.trim().length === 0}
              >
                <Ionicons name="sparkles-outline" size={18} color={Colors.bgWhite} />
                <Text style={styles.primaryBtnText}>Parse & Create Recipe</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleManualEntry}>
                <Text style={styles.secondaryBtnText}>Enter manually instead</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  navBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, paddingBottom: 60 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginBottom: Spacing.lg },
  loadingWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textSecondary },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  confidenceText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.textFaint },
  lowConfidence: { fontSize: 13, fontFamily: FontFamily.medium, color: '#f59e0b' },
  sectionTitle: { fontSize: 17, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  hint: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, marginBottom: 10 },
  textArea: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 200 },
  noTextBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#fffbeb', borderRadius: Radii.md, padding: Spacing.md, marginTop: Spacing.md },
  noTextMsg: { fontSize: 14, fontFamily: FontFamily.regular, color: '#92400e', flex: 1 },
  actions: { marginTop: 20, gap: 12 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 52 },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: Colors.bgWhite, fontSize: 16, fontFamily: FontFamily.semibold },
  secondaryBtn: { padding: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontFamily: FontFamily.medium, color: Colors.primary },
});
