import 'react-native-get-random-values';
import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/features/auth/authStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { getDatabase } from '@/db/client';
import { startBackgroundSync } from '@/services/syncService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const { initialize, isInitialized } = useAuthStore();
  const { initialize: initializeSettings } = useSettingsStore();

  useEffect(() => {
    async function boot() {
      await getDatabase();
      await Promise.all([initialize(), initializeSettings()]);
    }
    boot();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      startBackgroundSync();
    }
  }, [isInitialized]);

  useEffect(() => {
    if (fontsLoaded && isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isInitialized]);

  if (!fontsLoaded || !isInitialized) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="recipe/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="recipe/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe/import-url" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recipe/edit/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ocr/review" options={{ presentation: 'modal' }} />
          <Stack.Screen name="group/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="group/join" options={{ presentation: 'modal' }} />
          <Stack.Screen name="group/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="collection/list" options={{ presentation: 'card' }} />
          <Stack.Screen name="collection/[id]" options={{ presentation: 'card' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
