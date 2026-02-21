/**
 * Group Shopping List Screen
 * Shared, real-time shopping list for a group.
 * All members see and edit the same list.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useGroupShoppingStore, GroupShoppingItem } from '@/features/shopping/groupShoppingStore';
import { useGroupStore } from '@/features/groups/groupStore';
import { useAuthStore } from '@/features/auth/authStore';
import UnitPickerModal from '@/components/UnitPickerModal';
import { useHistoryStore } from '@/features/shopping/historyStore';
import { GROCERY_ITEMS } from '@/constants/groceryItems';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

const MANUAL_GROUP = 'Other';

type ListRow =
  | { type: 'section'; key: string; label: string }
  | { type: 'item'; key: string; item: GroupShoppingItem }
  | { type: 'add-row'; key: string };

function buildLabel(item: GroupShoppingItem): string {
  const parts: string[] = [];
  if (item.quantity) parts.push(item.quantity);
  if (item.unit) parts.push(item.unit);
  parts.push(item.name);
  return parts.join(' ');
}

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
      {checked && <Ionicons name="checkmark" size={14} color={Colors.bgWhite} />}
    </TouchableOpacity>
  );
}

interface ItemRowProps {
  item: GroupShoppingItem;
  onToggle: (id: string, checked: boolean) => void;
  onRemove: (id: string) => void;
}

function ItemRow({ item, onToggle, onRemove }: ItemRowProps) {
  return (
    <View style={styles.itemRow}>
      <Checkbox checked={item.checked} onPress={() => onToggle(item.id, !item.checked)} />
      <Text style={[styles.itemLabel, item.checked && styles.itemLabelChecked]} numberOfLines={2}>
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

export default function GroupShoppingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { groups } = useGroupStore();
  const { items, isLoading, loadForGroup, addItem, toggleItem, removeItem, clearChecked, clearAll, subscribeToGroup } =
    useGroupShoppingStore();
  const { history, load: loadHistory, add: addToHistory } = useHistoryStore();

  const [inputValue, setInputValue] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

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

  const group = groups.find((g) => g.id === id);
  const isViewer = group?.my_role === 'viewer';

  useEffect(() => {
    if (!id) return;
    loadForGroup(id);
    // Subscribe to real-time changes
    const unsub = subscribeToGroup(id);
    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [id]);

  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);
  const remainingCount = items.length - checkedCount;

  const listData = useMemo<ListRow[]>(() => {
    if (items.length === 0) return [{ type: 'add-row', key: 'add-row' }];

    const groupOrder: string[] = [];
    const groupMap: Record<string, GroupShoppingItem[]> = {};

    for (const item of items) {
      const grp = item.recipe_name ?? MANUAL_GROUP;
      if (!groupMap[grp]) {
        groupMap[grp] = [];
        groupOrder.push(grp);
      }
      groupMap[grp]!.push(item);
    }

    const rows: ListRow[] = [];
    for (const grp of groupOrder) {
      rows.push({ type: 'section', key: `section-${grp}`, label: grp });
      for (const item of groupMap[grp] ?? []) {
        rows.push({ type: 'item', key: `item-${item.id}`, item });
      }
    }
    if (!isViewer) rows.push({ type: 'add-row', key: 'add-row' });
    return rows;
  }, [items, isViewer]);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !id || !user) return;
    addItem(id, user.id, trimmed, inputQty.trim() || undefined, inputUnit || undefined);
    addToHistory(trimmed);
    setInputValue('');
    setInputQty('');
    setInputUnit('');
  }, [inputValue, inputQty, inputUnit, id, user, addItem, addToHistory]);

  const handleToggle = useCallback(
    (itemId: string, checked: boolean) => {
      toggleItem(itemId, checked);
    },
    [toggleItem],
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      removeItem(itemId);
    },
    [removeItem],
  );

  const handleClearAll = useCallback(() => {
    if (!id) return;
    Alert.alert('Clear all items', 'Remove all items from the group shopping list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => clearAll(id) },
    ]);
  }, [id, clearAll]);

  const handleClearChecked = useCallback(() => {
    if (!id) return;
    clearChecked(id);
  }, [id, clearChecked]);

  const renderRow = useCallback(
    ({ item: row }: { item: ListRow }) => {
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
            onToggle={isViewer ? () => {} : handleToggle}
            onRemove={isViewer ? () => {} : handleRemove}
          />
        );
      }
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
    },
    [inputValue, inputQty, inputUnit, suggestions, handleToggle, handleRemove, handleAdd, isViewer],
  );

  const keyExtractor = useCallback((row: ListRow) => row.key, []);
  const isEmpty = items.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>Shopping List</Text>
          {group && <Text style={styles.navSubtitle}>{group.name}</Text>}
        </View>
        {!isEmpty && !isViewer && (
          <TouchableOpacity onPress={handleClearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Realtime badge */}
      <View style={styles.realtimeBadge}>
        <View style={styles.realtimeDot} />
        <Text style={styles.realtimeText}>Live — all members see changes instantly</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Group list is empty</Text>
          <Text style={styles.emptySubtitle}>Add items and all members will see them</Text>
          {!isViewer && (
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
          )}
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

          <View style={styles.bottomBar}>
            {checkedCount > 0 && !isViewer && (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  navBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', fontFamily: FontFamily.bold, color: '#111827' },
  navSubtitle: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textMuted, marginTop: 1 },
  realtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  realtimeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.privateGreen },
  realtimeText: { fontSize: 11, fontFamily: FontFamily.medium, color: '#16a34a' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: Spacing.lg },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold, color: Colors.primary, letterSpacing: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    backgroundColor: '#f9fafb',
    borderRadius: Radii.md,
  },
  itemLabel: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular, color: '#111827', marginLeft: Spacing.md },
  itemLabelChecked: { textDecorationLine: 'line-through', color: Colors.textFaint },
  deleteBtn: { marginLeft: 10, padding: Spacing.xs },
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
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  addRowWrap: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.xs, gap: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  addRowSecond: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: Radii.md,
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
    borderRadius: Radii.md,
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
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#f9fafb',
  },
  unitBtnText: { fontSize: 14, fontFamily: FontFamily.medium, color: '#111827' },
  unitBtnPlaceholder: { color: Colors.textFaint },
  addButton: { width: 46, height: 46, borderRadius: Radii.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  addButtonDisabled: { backgroundColor: Colors.primaryMid },
  suggestionsRow: { marginBottom: -2 },
  suggestionsContent: { gap: 6, paddingVertical: 2 },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  suggestionChipText: { fontSize: 13, fontFamily: FontFamily.medium, color: Colors.primary },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: Spacing.sm },
  emptyEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: 20, fontWeight: '700', fontFamily: FontFamily.bold, color: '#111827' },
  emptySubtitle: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textMuted, textAlign: 'center' },
  emptyAddRow: { alignSelf: 'stretch', marginTop: Spacing.xl },
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
  clearCheckedBtn: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: Spacing.sm, backgroundColor: '#f3f4f6' },
  clearCheckedText: { fontSize: 13, fontFamily: FontFamily.semibold, color: '#374151' },
  remainingText: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textMuted },
});
