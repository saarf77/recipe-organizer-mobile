import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabaseClient';
import { compressImageForUpload } from './ocrService';
import { v4 as uuidv4 } from 'uuid';

export async function pickImageFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

export async function uploadRecipeImage(
  localUri: string,
  userId: string
): Promise<{ storagePath: string; publicUrl: string } | null> {
  try {
    const compressed = await compressImageForUpload(localUri);
    const filename = `${userId}/${uuidv4()}.jpg`;

    const response = await fetch(compressed);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('recipe-images')
      .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });

    if (error || !data) return null;

    const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(data.path);
    return { storagePath: data.path, publicUrl: urlData.publicUrl };
  } catch (e) {
    console.error('[ImageService] upload failed', e);
    return null;
  }
}

export async function deleteRecipeImage(storagePath: string): Promise<void> {
  await supabase.storage.from('recipe-images').remove([storagePath]);
}
