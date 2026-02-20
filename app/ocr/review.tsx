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
          <Ionicons name="close" size={24} color="#0f172a" />
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
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Extracting text from image...</Text>
          </View>
        ) : (
          <>
            <View style={styles.confidenceRow}>
              <Ionicons name="scan-outline" size={16} color="#94a3b8" />
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
              placeholderTextColor="#94a3b8"
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
                <Ionicons name="sparkles-outline" size={18} color="#ffffff" />
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  navBtn: { padding: 4, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 60 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
  loadingWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#475569' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  confidenceText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#94a3b8' },
  lowConfidence: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#f59e0b' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 4 },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 10 },
  textArea: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#0f172a', minHeight: 200 },
  noTextBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginTop: 12 },
  noTextMsg: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#92400e', flex: 1 },
  actions: { marginTop: 20, gap: 12 },
  primaryBtn: { backgroundColor: '#f97316', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52 },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { padding: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#f97316' },
});
