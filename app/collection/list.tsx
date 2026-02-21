import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCollectionStore } from '@/features/collections/collectionStore';
import { Collection } from '@/types';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

export default function CollectionListScreen() {
  const { collections, isLoading, loadAll, createCollection, deleteCollection } = useCollectionStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createCollection({ name: newName.trim(), description: newDesc.trim() || undefined });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewName('');
      setNewDesc('');
      setShowNewModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (collection: Collection) => {
    Alert.alert('Delete Collection', `Delete "${collection.name}"? Recipes won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteCollection(collection.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/collection/${item.id}`)}
      accessibilityLabel={`Open collection ${item.name}`}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="folder-open-outline" size={24} color={Colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
        ) : null}
        <Text style={styles.cardMeta}>{item.recipe_ids.length} recipe{item.recipe_ids.length !== 1 ? 's' : ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        accessibilityLabel={`Delete collection ${item.name}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={18} color={Colors.borderStrong} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Collections</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewModal(true)} accessibilityLabel="New collection">
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : collections.length === 0 ? (
        <View style={styles.centeredState}>
          <Ionicons name="folder-open-outline" size={56} color={Colors.border} />
          <Text style={styles.emptyTitle}>No collections yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to create your first collection</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowNewModal(true)}>
            <Text style={styles.emptyBtnText}>New Collection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New Collection Modal */}
      <Modal visible={showNewModal} transparent animationType="slide" onRequestClose={() => setShowNewModal(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowNewModal(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>New Collection</Text>
          <TextInput
            style={styles.sheetInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Collection name"
            placeholderTextColor={Colors.textFaint}
            autoFocus
            accessibilityLabel="Collection name"
          />
          <TextInput
            style={[styles.sheetInput, styles.sheetInputMulti]}
            value={newDesc}
            onChangeText={setNewDesc}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.textFaint}
            multiline
            numberOfLines={2}
            accessibilityLabel="Collection description"
          />
          <TouchableOpacity
            style={[styles.sheetSave, (!newName.trim() || saving) && styles.sheetSaveDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim() || saving}
          >
            {saving ? <ActivityIndicator color={Colors.bgWhite} size="small" /> : <Text style={styles.sheetSaveText}>Create</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted, backgroundColor: Colors.bgWhite },
  backBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginLeft: Spacing.sm },
  addBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, gap: 10, paddingBottom: 60 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgWhite, borderRadius: Radii.lg, padding: 14, gap: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  cardDesc: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textSlate, marginTop: 2 },
  cardMeta: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 3 },
  deleteBtn: { padding: Spacing.sm },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: FontFamily.semibold, color: '#334155' },
  emptySubtitle: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textFaint },
  emptyBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: Spacing.md, borderRadius: Radii.md },
  emptyBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 15 },
  backdrop: { flex: 1 },
  sheet: { backgroundColor: Colors.bgWhite, borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md },
  sheetTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  sheetInput: { backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, minHeight: 48 },
  sheetInputMulti: { minHeight: 72, textAlignVertical: 'top' },
  sheetSave: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 14, alignItems: 'center', minHeight: 48 },
  sheetSaveDisabled: { opacity: 0.5 },
  sheetSaveText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 16 },
});
