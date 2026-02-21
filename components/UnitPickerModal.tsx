/**
 * UnitPickerModal
 * A bottom-sheet style modal for selecting a cooking unit,
 * optionally converting the current quantity to the new unit.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

// ─── Unit definitions ────────────────────────────────────────────────────────

export type UnitCategory = 'volume' | 'weight' | 'count' | 'other';

export interface CookingUnit {
  label: string;       // display name: "cup", "ml", "g", …
  abbr: string;        // short form used in the abbreviation slot
  category: UnitCategory;
  toBase: number;      // multiply quantity by this to get base unit
  // base unit: ml for volume, g for weight, 1 for count/other
}

export const COOKING_UNITS: CookingUnit[] = [
  // ── Volume ──────────────────────────────────────────────────────────────
  { label: 'teaspoon',    abbr: 'tsp',   category: 'volume', toBase: 4.92892 },
  { label: 'tablespoon',  abbr: 'tbsp',  category: 'volume', toBase: 14.7868 },
  { label: 'fluid oz',    abbr: 'fl oz', category: 'volume', toBase: 29.5735 },
  { label: 'cup',         abbr: 'cup',   category: 'volume', toBase: 236.588 },
  { label: 'pint',        abbr: 'pt',    category: 'volume', toBase: 473.176 },
  { label: 'quart',       abbr: 'qt',    category: 'volume', toBase: 946.353 },
  { label: 'liter',       abbr: 'L',     category: 'volume', toBase: 1000 },
  { label: 'milliliter',  abbr: 'ml',    category: 'volume', toBase: 1 },
  // ── Weight ──────────────────────────────────────────────────────────────
  { label: 'gram',        abbr: 'g',     category: 'weight', toBase: 1 },
  { label: 'kilogram',    abbr: 'kg',    category: 'weight', toBase: 1000 },
  { label: 'ounce',       abbr: 'oz',    category: 'weight', toBase: 28.3495 },
  { label: 'pound',       abbr: 'lb',    category: 'weight', toBase: 453.592 },
  // ── Count ───────────────────────────────────────────────────────────────
  { label: 'piece',       abbr: 'pc',    category: 'count',  toBase: 1 },
  { label: 'slice',       abbr: 'slice', category: 'count',  toBase: 1 },
  { label: 'clove',       abbr: 'clove', category: 'count',  toBase: 1 },
  { label: 'pinch',       abbr: 'pinch', category: 'count',  toBase: 1 },
  { label: 'handful',     abbr: 'hdfl',  category: 'count',  toBase: 1 },
  { label: 'bunch',       abbr: 'bunch', category: 'count',  toBase: 1 },
  { label: 'can',         abbr: 'can',   category: 'count',  toBase: 1 },
  { label: 'package',     abbr: 'pkg',   category: 'count',  toBase: 1 },
  { label: 'stick',       abbr: 'stick', category: 'count',  toBase: 1 },
  // ── Other ───────────────────────────────────────────────────────────────
  { label: '(no unit)',   abbr: '',      category: 'other',  toBase: 1 },
];

const CATEGORY_ORDER: UnitCategory[] = ['volume', 'weight', 'count', 'other'];
const CATEGORY_LABELS: Record<UnitCategory, string> = {
  volume: 'Volume',
  weight: 'Weight',
  count:  'Count / Misc',
  other:  'Other',
};

/**
 * Convert quantity from one unit to another.
 * Returns null if the units are in different categories (incompatible).
 */
export function convertQuantity(
  quantity: number,
  fromUnit: CookingUnit,
  toUnit: CookingUnit,
): number | null {
  if (fromUnit.category !== toUnit.category) return null;
  if (fromUnit.category === 'count' || fromUnit.category === 'other') {
    // Count units don't have a meaningful conversion factor — just keep the number
    return quantity;
  }
  const baseValue = quantity * fromUnit.toBase;
  return baseValue / toUnit.toBase;
}

/** Find a CookingUnit by its label or abbr (case-insensitive). */
export function findUnit(raw: string | null | undefined): CookingUnit | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return (
    COOKING_UNITS.find(
      (u) => u.abbr.toLowerCase() === lower || u.label.toLowerCase() === lower,
    ) ?? null
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface UnitPickerModalProps {
  visible: boolean;
  currentUnit: string;
  currentQuantity: string;
  onSelect: (unit: string, newQuantity: string) => void;
  onClose: () => void;
}

export default function UnitPickerModal({
  visible,
  currentUnit,
  currentQuantity,
  onSelect,
  onClose,
}: UnitPickerModalProps) {
  const fromUnit = useMemo(() => findUnit(currentUnit), [currentUnit]);
  const qty = parseFloat(currentQuantity);

  const grouped = useMemo(() => {
    const map: Partial<Record<UnitCategory, CookingUnit[]>> = {};
    for (const cat of CATEGORY_ORDER) {
      map[cat] = COOKING_UNITS.filter((u) => u.category === cat);
    }
    return map;
  }, []);

  const handleSelect = (unit: CookingUnit) => {
    let newQty = currentQuantity;

    if (fromUnit && !isNaN(qty) && qty > 0) {
      const converted = convertQuantity(qty, fromUnit, unit);
      if (converted !== null) {
        // Round to sensible precision
        newQty = parseFloat(converted.toFixed(3)).toString();
      }
    }

    onSelect(unit.abbr || unit.label, newQty);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Unit</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!isNaN(qty) && qty > 0 && fromUnit && (
          <Text style={styles.conversionNote}>
            Quantities will be converted from {fromUnit.label} automatically
          </Text>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {CATEGORY_ORDER.map((cat) => (
            <View key={cat}>
              <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat]}</Text>
              <View style={styles.chipGrid}>
                {(grouped[cat] ?? []).map((unit) => {
                  const isSelected =
                    currentUnit?.toLowerCase() === unit.abbr.toLowerCase() ||
                    currentUnit?.toLowerCase() === unit.label.toLowerCase();

                  // Show preview conversion if applicable
                  let preview: string | null = null;
                  if (fromUnit && !isNaN(qty) && qty > 0 && !isSelected) {
                    const converted = convertQuantity(qty, fromUnit, unit);
                    if (converted !== null) {
                      preview = `≈ ${parseFloat(converted.toFixed(2))}`;
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={unit.abbr || unit.label}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleSelect(unit)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                        {unit.label}
                      </Text>
                      {unit.abbr ? (
                        <Text style={[styles.chipAbbr, isSelected && styles.chipAbbrSelected]}>
                          {unit.abbr}
                        </Text>
                      ) : null}
                      {preview && (
                        <Text style={styles.chipPreview}>{preview}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: Colors.bgWhite,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginTop: Spacing.sm + 2,
    marginBottom: Spacing.md / 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgMuted,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FontFamily.semibold,
    color: Colors.textPrimary,
  },
  conversionNote: {
    fontSize: FontSize.xs.size,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgMuted,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    backgroundColor: Colors.bgMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  chipLabel: {
    fontSize: FontSize.sm.size - 1,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },
  chipLabelSelected: {
    color: Colors.primary,
  },
  chipAbbr: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textFaint,
  },
  chipAbbrSelected: {
    color: Colors.primaryMid,
  },
  chipPreview: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: Colors.textFaint,
    marginLeft: 2,
  },
});
