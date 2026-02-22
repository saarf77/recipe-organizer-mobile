import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');

interface OptionCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function OptionCard({ icon, iconBg, iconColor, title, subtitle, onPress }: OptionCardProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.75}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
    </TouchableOpacity>
  );
}

export default function AddRecipeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={goBack} style={styles.navBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Add Recipe</Text>
        <View style={styles.navBtn} />
      </View>

      {/* Prompt */}
      <View style={styles.promptWrap}>
        <Text style={styles.promptTitle}>How do you want to add it?</Text>
        <Text style={styles.promptSubtitle}>Choose the fastest way to save this recipe.</Text>
      </View>

      {/* Options */}
      <View style={styles.list}>
        <OptionCard
          icon="pencil-outline"
          iconBg={Colors.primaryBg}
          iconColor={Colors.primary}
          title="Enter manually"
          subtitle="Type in your own recipe from scratch"
          onPress={() => router.push('/recipe/new')}
        />
        <OptionCard
          icon="sparkles-outline"
          iconBg="#f0f4ff"
          iconColor="#6366f1"
          title="AI Generate"
          subtitle="Describe ingredients — AI crafts the recipe"
          onPress={() => router.push('/recipe/generate')}
        />
        <OptionCard
          icon="link-outline"
          iconBg={Colors.bgMuted}
          iconColor={Colors.textSecondary}
          title="Import from URL"
          subtitle="Paste a link from any cooking website"
          onPress={() => router.push('/recipe/import-url')}
        />
        <OptionCard
          icon="camera-outline"
          iconBg={Colors.primaryBg}
          iconColor={Colors.primaryMid}
          title="Scan a recipe"
          subtitle="Take or upload a photo — we'll read the text"
          onPress={() => router.push('/recipe/new?scan=true')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWhite,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg.size,
    color: Colors.textPrimary,
  },
  promptWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  promptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  promptSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm.size,
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base.size,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm.size,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
