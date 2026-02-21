import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Modal, FlatList, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMealPlanStore, MealSlot, MealEntry } from '@/features/mealplan/mealPlanStore';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { Recipe } from '@/types';
import { router } from 'expo-router';
import { Colors, Spacing, FontFamily, FontSize, Shadows } from '@/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const SLOT_ICONS: Record<MealSlot, string> = {
  breakfast: '☀️',
  lunch: '🌤',
  dinner: '🌙',
  snack: '🍎',
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDateKey(new Date());
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MealPlanScreen() {
  const { entries, addEntry, removeEntry, getEntriesForWeek, clearWeek } = useMealPlanStore();
  const { recipes, loadAll } = useRecipeStore();

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const weekStartStr = formatDateKey(weekStart);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => formatDateKey(addDays(weekStart, i))), [weekStart]);
  const weekEntries = useMemo(() => getEntriesForWeek(weekStartStr), [entries, weekStartStr]);

  const getEntry = useCallback((date: string, slot: MealSlot): MealEntry | undefined => {
    return weekEntries.find((e) => e.date === date && e.slot === slot);
  }, [weekEntries]);

  const handlePrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const handleNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const handleThisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  const openPicker = useCallback((date: string, slot: MealSlot) => {
    setPickerTarget({ date, slot });
    setPickerSearch('');
    loadAll();
    setPickerVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [loadAll]);

  const handleSelectRecipe = useCallback((recipe: Recipe) => {
    if (!pickerTarget) return;
    addEntry(
      pickerTarget.date,
      pickerTarget.slot,
      recipe.id,
      recipe.title,
      recipe.images?.[0]?.storage_path ?? null,
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPickerVisible(false);
    setPickerTarget(null);
    setPickerSearch('');
  }, [pickerTarget, addEntry]);

  const handleRemoveEntry = useCallback((id: string) => {
    Alert.alert('Remove meal?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => { removeEntry(id); Haptics.selectionAsync(); },
      },
    ]);
  }, [removeEntry]);

  const handleClearWeek = useCallback(() => {
    Alert.alert('Clear this week?', 'All meal plan entries for this week will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => { clearWeek(weekStartStr); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
      },
    ]);
  }, [weekStartStr, clearWeek]);

  const filteredRecipes = useMemo(() => {
    if (!pickerSearch.trim()) return recipes;
    const q = pickerSearch.toLowerCase();
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, pickerSearch]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const s = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  }, [weekStart]);

  const hasAnyEntries = weekEntries.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Meal Planner</Text>
        {hasAnyEntries ? (
          <TouchableOpacity style={styles.navBtn} onPress={handleClearWeek}>
            <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
        )}
      </View>

      {/* ─── Week navigator ─────────────────────────────────────────────────── */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.weekNavBtn} onPress={handlePrevWeek}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleThisWeek}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekNavBtn} onPress={handleNextWeek}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─── Weekly grid ────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        horizontal={false}
      >
        {weekDates.map((dateStr, dayIdx) => (
          <View key={dateStr} style={styles.dayRow}>
            {/* Day header */}
            <View style={[styles.dayHeader, isToday(dateStr) && styles.dayHeaderToday]}>
              <Text style={[styles.dayName, isToday(dateStr) && styles.dayNameToday]}>
                {DAY_NAMES[dayIdx]}
              </Text>
              <Text style={[styles.dayDate, isToday(dateStr) && styles.dayDateToday]}>
                {formatDisplayDate(dateStr)}
              </Text>
            </View>

            {/* Meal slots */}
            <View style={styles.daySlots}>
              {SLOTS.map((slot) => {
                const entry = getEntry(dateStr, slot);
                return (
                  <View key={slot} style={styles.slotWrap}>
                    <Text style={styles.slotLabel}>{SLOT_ICONS[slot]} {SLOT_LABELS[slot]}</Text>
                    {entry ? (
                      <TouchableOpacity
                        style={styles.entryCard}
                        onPress={() => router.push(`/recipe/${entry.recipeId}`)}
                        onLongPress={() => handleRemoveEntry(entry.id)}
                        accessibilityLabel={`${entry.recipeName}, long press to remove`}
                      >
                        {entry.recipeImageUri ? (
                          <Image
                            source={{ uri: entry.recipeImageUri }}
                            style={styles.entryImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.entryImagePlaceholder}>
                            <Text style={styles.entryImageEmoji}>🍽</Text>
                          </View>
                        )}
                        <View style={styles.entryContent}>
                          <Text style={styles.entryName} numberOfLines={2}>{entry.recipeName}</Text>
                          <TouchableOpacity
                            style={styles.entryRemoveBtn}
                            onPress={() => handleRemoveEntry(entry.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={18} color={Colors.textFaint} />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.emptySlot}
                        onPress={() => openPicker(dateStr, slot)}
                        accessibilityLabel={`Add ${SLOT_LABELS[slot]} for ${dateStr}`}
                      >
                        <Ionicons name="add-circle-outline" size={18} color={Colors.borderStrong} />
                        <Text style={styles.emptySlotText}>Add recipe</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ─── Recipe picker modal ────────────────────────────────────────────── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setPickerVisible(false); setPickerSearch(''); }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {pickerTarget ? `${SLOT_ICONS[pickerTarget.slot]} ${SLOT_LABELS[pickerTarget.slot]}` : 'Pick a Recipe'}
            </Text>
            {pickerTarget && (
              <Text style={styles.modalSubtitle}>{formatDisplayDate(pickerTarget.date)}</Text>
            )}

            {/* Search */}
            <View style={styles.pickerSearch}>
              <Ionicons name="search-outline" size={16} color={Colors.textFaint} />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search recipes…"
                placeholderTextColor={Colors.textFaint}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                returnKeyType="search"
                autoCorrect={false}
              />
            </View>

            <FlatList
              data={filteredRecipes}
              keyExtractor={(r) => r.id}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => handleSelectRecipe(item)}
                >
                  {item.images?.[0]?.storage_path ? (
                    <Image
                      source={{ uri: item.images[0].storage_path }}
                      style={styles.pickerRowImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.pickerRowImage, styles.pickerRowImagePlaceholder]}>
                      <Text style={{ fontSize: 18 }}>🍽</Text>
                    </View>
                  )}
                  <View style={styles.pickerRowContent}>
                    <Text style={styles.pickerRowTitle} numberOfLines={1}>{item.title}</Text>
                    {item.category && <Text style={styles.pickerRowCategory}>{item.category}</Text>}
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>No recipes yet. Create some first!</Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },

  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary },

  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  weekNavBtn: { padding: Spacing.sm },
  weekLabel: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textPrimary },

  scrollContent: { padding: Spacing.md, paddingBottom: 80 },

  dayRow: {
    backgroundColor: Colors.bgWhite, borderRadius: Spacing.lg, marginBottom: Spacing.md,
    ...Shadows.card,
    overflow: 'hidden',
  },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
    backgroundColor: Colors.bgSurface, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  dayHeaderToday: { backgroundColor: Colors.primaryBg },
  dayName: { fontSize: FontSize.sm.size, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  dayNameToday: { color: Colors.primary },
  dayDate: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint },
  dayDateToday: { color: Colors.primary },

  daySlots: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },

  slotWrap: { marginBottom: Spacing.xs },
  slotLabel: { fontSize: 11, fontFamily: FontFamily.semibold, color: Colors.textMuted, marginBottom: Spacing.xs, letterSpacing: 0.3 },

  entryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgSurface, borderRadius: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  entryImage: { width: 52, height: 52 },
  entryImagePlaceholder: {
    width: 52, height: 52, backgroundColor: Colors.primaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  entryImageEmoji: { fontSize: 22 },
  entryContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, gap: Spacing.sm,
  },
  entryName: { flex: 1, fontSize: 13, fontFamily: FontFamily.semibold, color: Colors.textPrimary, lineHeight: 18 },
  entryRemoveBtn: { padding: Spacing.xs },

  emptySlot: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgSurface, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, borderStyle: 'dashed',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  emptySlotText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textMuted },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: Spacing.md, paddingBottom: 40, maxHeight: '80%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary, paddingHorizontal: 20, marginBottom: 2 },
  modalSubtitle: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, paddingHorizontal: 20, marginBottom: Spacing.md },

  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: 20, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.bgSurface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  pickerSearchInput: { flex: 1, fontSize: FontSize.sm.size, color: Colors.textFaint, fontFamily: FontFamily.regular },

  pickerList: { paddingHorizontal: 20 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted,
  },
  pickerRowImage: { width: 44, height: 44, borderRadius: 10 },
  pickerRowImagePlaceholder: { backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  pickerRowContent: { flex: 1 },
  pickerRowTitle: { fontSize: FontSize.sm.size, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  pickerRowCategory: { fontSize: FontSize.xs.size, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 2 },
  pickerEmpty: { padding: Spacing['2xl'], alignItems: 'center' },
  pickerEmptyText: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textFaint, textAlign: 'center' },
});
