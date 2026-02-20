/**
 * OCR Service — on-device only (no paid AI).
 * Uses expo-camera + ML Kit Text Recognition via community library.
 * Falls back to Supabase Edge Function (Tesseract) when available.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { OCRResult } from '@/types';
import { supabase } from './supabaseClient';

// ─── Image Preprocessing ──────────────────────────────────────────────────────

export async function preprocessImageForOCR(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { resize: { width: 1500 } }, // normalize size for OCR
    ],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}

export async function compressImageForUpload(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  return result.uri;
}

// ─── On-Device OCR ────────────────────────────────────────────────────────────
// Uses @react-native-ml-kit/text-recognition (free, on-device)
// Install: npx expo install @react-native-ml-kit/text-recognition

async function onDeviceOCR(imageUri: string): Promise<OCRResult | null> {
  try {
    // Dynamic import so web builds don't break
    const TextRecognition = await import(
      '@react-native-ml-kit/text-recognition'
    ).catch(() => null);
    if (!TextRecognition) return null;

    const result = await TextRecognition.default.recognize(imageUri);
    const blocks = result.blocks ?? [];
    const raw_text = blocks.map((b: { text: string }) => b.text).join('\n');

    return {
      raw_text,
      confidence: 0.9, // ML Kit doesn't expose line-level confidence as a single number
      source: 'camera',
    };
  } catch (e) {
    console.warn('[OCR] on-device failed', e);
    return null;
  }
}

// ─── Server-Side OCR Fallback (Supabase Edge / Tesseract) ────────────────────

async function serverOCR(imageUri: string, source: OCRResult['source']): Promise<OCRResult | null> {
  try {
    // Convert local uri to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const { data, error } = await supabase.functions.invoke('ocr-extract', {
      body: { image_base64: base64, mime_type: 'image/jpeg' },
    });

    if (error || !data?.text) return null;

    return {
      raw_text: data.text as string,
      confidence: (data.confidence as number) ?? 0.7,
      source,
    };
  } catch (e) {
    console.warn('[OCR] server fallback failed', e);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractTextFromImage(
  uri: string,
  source: OCRResult['source'] = 'gallery'
): Promise<OCRResult> {
  const processedUri = await preprocessImageForOCR(uri);

  // Try on-device first
  const deviceResult = await onDeviceOCR(processedUri);
  if (deviceResult && deviceResult.raw_text.trim().length > 10) {
    return { ...deviceResult, source };
  }

  // Fallback to Supabase edge function (Tesseract)
  const serverResult = await serverOCR(processedUri, source);
  if (serverResult) return serverResult;

  // Return empty result with manual edit fallback
  return {
    raw_text: '',
    confidence: 0,
    source,
  };
}
