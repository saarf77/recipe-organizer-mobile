import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShoppingStore, ShoppingItem } from '@/features/shopping/shoppingStore';
import UnitPickerModal from '@/components/UnitPickerModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useHistoryStore } from '@/features/shopping/historyStore';
import { GROCERY_ITEMS } from '@/constants/groceryItems';
import { Colors, Spacing, Radii, FontFamily, FontSize } from '@/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type ListRow =
  | { type: 'section'; key: string; label: string }
  | { type: 'item'; key: string; item: ShoppingItem }
  | { type: 'add-row'; key: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const MANUAL_GROUP = 'Other';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLabel(item: ShoppingItem): string {
  const parts: string[] = [];
  if (item.quantity) parts.push(item.quantity);
  if (item.unit) parts.push(item.unit);
  parts.push(item.name);
  return parts.join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
}

function Checkbox({ checked, onPress }: CheckboxProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.checkbox, checked && styles.checkboxChecked]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {checked && (
        <Ionicons name="checkmark" size={14} color={Colors.bgWhite} />
      )}
    </TouchableOpacity>
  );
}

interface ItemRowProps {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function ItemRow({ item, onToggle, onRemove }: ItemRowProps) {
  return (
    <View style={styles.itemRow}>
      <Checkbox checked={item.checked} onPress={() => onToggle(item.id)} />
      <Text
        style={[styles.itemLabel, item.checked && styles.itemLabelChecked]}
        numberOfLines={2}
      >
        {buildLabel(item)}
      </Text>
      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.deleteBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.6}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

interface AddRowProps {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  quantity: string;
  onQuantityChange: (v: string) => void;
  unit: string;
  onUnitPress: () => void;
  suggestions: string[];
  onSuggestionSelect: (name: string) => void;
}

function AddRow({
  value, onChange, onAdd,
  quantity, onQuantityChange,
  unit, onUnitPress,
  suggestions, onSuggestionSelect,
}: AddRowProps) {
  return (
    <View style={styles.addRowWrap}>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Item name…"
          placeholderTextColor={Colors.textFaint}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
      </View>

      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestionsContent}
          style={styles.suggestionsRow}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionChip}
              onPress={() => onSuggestionSelect(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionChipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.addRowSecond}>
        <TextInput
          style={styles.qtyInput}
          placeholder="Qty"
          placeholderTextColor={Colors.textFaint}
          value={quantity}
          onChangeText={onQuantityChange}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.unitBtn} onPress={onUnitPress} activeOpacity={0.7}>
          <Text style={[styles.unitBtnText, !unit && styles.unitBtnPlaceholder]}>
            {unit || 'Unit'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={Colors.textFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, !value.trim() && styles.addButtonDisabled]}
          onPress={onAdd}
          disabled={!value.trim()}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={Colors.bgWhite} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShoppingListScreen() {
  const { items, toggleItem, removeItem, clearChecked, clearAll } = useShoppingStore();
  const { history, load: loadHistory, add: addToHistory } = useHistoryStore();
  const [inputValue, setInputValue] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const [clearAllModal, setClearAllModal] = useState(false);

  const addManual = useShoppingStore((s) => s.addManual);

  useEffect(() => { loadHistory(); }, []);

  const suggestions = useMemo<string[]>(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    const results: string[] = [];
    const push = (name: string) => {
      const key = name.toLowerCase();
      if (!seen.has(key) && key.includes(q)) { seen.add(key); results.push(name); }
    };
    history.forEach(push);
    GROCERY_ITEMS.forEach(push);
    return results.slice(0, 8);
  }, [inputValue, history]);

  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);
  const remainingCount = items.length - checkedCount;

  // Build FlatList data: section headers + items, grouped by recipeName
  const listData = useMemo<ListRow[]>(() => {
    if (items.length === 0) return [{ type: 'add-row', key: 'add-row' }];

    // Collect group names preserving insertion order
    const groupOrder: string[] = [];
    const groupMap: Record<string, ShoppingItem[]> = {};

    for (const item of items) {
      const group = item.recipeName ?? MANUAL_GROUP;
      if (!groupMap[group]) {
        groupMap[group] = [];
        groupOrder.push(group);
      }
      groupMap[group].push(item);
    }

    const rows: ListRow[] = [];
    for (const group of groupOrder) {
      rows.push({ type: 'section', key: `section-${group}`, label: group });
      for (const item of (groupMap[group] ?? [])) {
        rows.push({ type: 'item', key: `item-${item.id}`, item });
      }
    }
    rows.push({ type: 'add-row', key: 'add-row' });
    return rows;
  }, [items]);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    addManual(trimmed, inputQty.trim() || undefined, inputUnit || undefined);
    addToHistory(trimmed);
    setInputValue('');
    setInputQty('');
    setInputUnit('');
  }, [inputValue, inputQty, inputUnit, addManual, addToHistory]);

  const handleToggle = useCallback((id: string) => {
    toggleItem(id);
  }, [toggleItem]);

  const handleRemove = useCallback((id: string) => {
    removeItem(id);
  }, [removeItem]);

  const handleClearAll = useCallback(() => {
    setClearAllModal(true);
  }, []);

  const handleClearChecked = useCallback(() => {
    clearChecked();
  }, [clearChecked]);

  const renderRow = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.type === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{row.label.toUpperCase()}</Text>
        </View>
      );
    }
    if (row.type === 'item') {
      return (
        <ItemRow
          item={row.item}
          onToggle={handleToggle}
          onRemove={handleRemove}
        />
      );
    }
    // add-row
    return (
      <AddRow
        value={inputValue}
        onChange={setInputValue}
        onAdd={handleAdd}
        quantity={inputQty}
        onQuantityChange={setInputQty}
        unit={inputUnit}
        onUnitPress={() => setUnitPickerVisible(true)}
        suggestions={suggestions}
        onSuggestionSelect={(name) => setInputValue(name)}
      />
    );
  }, [inputValue, inputQty, inputUnit, suggestions, handleToggle, handleRemove, handleAdd]);

  const keyExtractor = useCallback((row: ListRow) => row.key, []);

  const isEmpty = items.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Shopping List</Text>
        {!isEmpty && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Empty state */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your list is empty</Text>
          <Text style={styles.emptySubtitle}>Add ingredients from any recipe</Text>
          {/* Still allow manual adds even when empty */}
          <View style={styles.emptyAddRow}>
            <AddRow
              value={inputValue}
              onChange={setInputValue}
              onAdd={handleAdd}
              quantity={inputQty}
              onQuantityChange={setInputQty}
              unit={inputUnit}
              onUnitPress={() => setUnitPickerVisible(true)}
              suggestions={suggestions}
              onSuggestionSelect={(name) => setInputValue(name)}
            />
          </View>
        </View>
      ) : (
        <>
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            extraData={inputValue}
          />

          {/* Bottom action bar */}
          <View style={styles.bottomBar}>
            {checkedCount > 0 && (
              <TouchableOpacity style={styles.clearCheckedBtn} onPress={handleClearChecked} activeOpacity={0.7}>
                <Text style={styles.clearCheckedText}>Clear checked ({checkedCount})</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.remainingText}>
              {remainingCount} item{remainingCount !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        </>
      )}

      <UnitPickerModal
        visible={unitPickerVisible}
        currentUnit={inputUnit}
        currentQuantity={inputQty}
        onSelect={(unit, newQty) => {
          setInputUnit(unit);
          if (newQty) setInputQty(newQty);
        }}
        onClose={() => setUnitPickerVisible(false)}
      />
      <ConfirmModal
        visible={clearAllModal}
        title="Clear all items"
        message="Are you sure you want to remove everything from your shopping list?"
        confirmLabel="Clear all"
        destructive
        onConfirm={() => { setClearAllModal(false); clearAll(); }}
        onCancel={() => setClearAllModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWhite,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  navTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#111827',
  },

  // List
  listContent: {
    paddingBottom: Spacing.lg,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: Colors.primary,
    letterSpacing: 1,
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: '#111827',
    marginLeft: Spacing.md,
  },
  itemLabelChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textFaint,
  },
  deleteBtn: {
    marginLeft: 10,
    padding: Spacing.xs,
  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radii.sm,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgWhite,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  // Add row
  addRowWrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addRowSecond: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  qtyInput: {
    width: 72,
    height: 46,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: '#111827',
    backgroundColor: '#f9fafb',
    textAlign: 'center',
  },
  unitBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#f9fafb',
  },
  unitBtnText: {
    fontSize: FontSize.sm.size,
    fontFamily: FontFamily.medium,
    color: '#111827',
  },
  unitBtnPlaceholder: {
    color: Colors.textFaint,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.primaryMid,
  },

  // Suggestions
  suggestionsRow: {
    marginBottom: -2,
  },
  suggestionsContent: {
    gap: 6,
    paddingVertical: 2,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  suggestionChipText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: FontSize.sm.size,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyAddRow: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: Colors.bgWhite,
  },
  clearCheckedBtn: {
    paddingHorizontal: 14,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.sm,
    backgroundColor: '#f3f4f6',
  },
  clearCheckedText: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    color: '#374151',
  },
  remainingText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: Colors.textMuted,
  },
});
