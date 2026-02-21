import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCollectionStore } from '@/features/collections/collectionStore';
import { useRecipeStore } from '@/features/recipes/recipeStore';
import { Collection, Recipe } from '@/types';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { collections, isLoading: collectionsLoading, loadAll, updateCollection, removeRecipe, addRecipe } = useCollectionStore();
  const { recipes, loadAll: loadRecipes } = useRecipeStore();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const collection: Collection | undefined = collections.find((c) => c.id === id);

  useEffect(() => {
    loadAll();
    loadRecipes();
  }, [id]);

  useEffect(() => {
    if (collection) setNameValue(collection.name);
  }, [collection?.name]);

  const handleRename = async () => {
    if (!id || !nameValue.trim() || nameValue.trim() === collection?.name) {
      setEditingName(false);
      return;
    }
    await updateCollection(id, { name: nameValue.trim() });
    await Haptics.selectionAsync();
    setEditingName(false);
  };

  const handleRemove = (recipe: Recipe) => {
    if (!id) return;
    Alert.alert('Remove from collection', `Remove "${recipe.title}" from this collection?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await removeRecipe(id, recipe.id);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ]);
  };

  const handleAdd = async (recipeId: string) => {
    if (!id) return;
    await addRecipe(id, recipeId);
    await Haptics.selectionAsync();
  };

  if (collectionsLoading || !collection) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const collectionRecipes = recipes.filter((r) => collection.recipe_ids.includes(r.id));

  const availableToAdd = recipes.filter(
    (r) =>
      !collection.recipe_ids.includes(r.id) &&
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRecipeItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/recipe/${item.id}`)}
      accessibilityLabel={`Open recipe ${item.title}`}
    >
      <View style={styles.cardIcon}>
        <Text style={styles.cardEmoji}>🍽</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        {item.category ? <Text style={styles.cardMeta}>{item.category}</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemove(item)}
        accessibilityLabel={`Remove ${item.title} from collection`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="remove-circle-outline" size={22} color={Colors.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>

        {editingName ? (
          <TextInput
            style={styles.titleInput}
            value={nameValue}
            onChangeText={setNameValue}
            onBlur={handleRename}
            onSubmitEditing={handleRename}
            autoFocus
            returnKeyType="done"
            accessibilityLabel="Collection name"
          />
        ) : (
          <TouchableOpacity style={styles.titleWrap} onPress={() => setEditingName(true)} accessibilityLabel="Rename collection">
            <Text style={styles.title} numberOfLines={1}>{collection.name}</Text>
            <Ionicons name="pencil-outline" size={14} color={Colors.textFaint} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)} accessibilityLabel="Add recipes">
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{collectionRecipes.length} recipe{collectionRecipes.length !== 1 ? 's' : ''}</Text>

      {collectionRecipes.length === 0 ? (
        <View style={styles.centeredState}>
          <Ionicons name="book-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No recipes yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to add recipes to this collection</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.emptyBtnText}>Add Recipes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={collectionRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipeItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Recipes Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowAddModal(false)} />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Recipes</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search recipes..."
            placeholderTextColor={Colors.textFaint}
            accessibilityLabel="Search recipes"
          />
          <FlatList
            data={availableToAdd}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => handleAdd(item.id)}
                accessibilityLabel={`Add ${item.title}`}
              >
                <Text style={styles.addRowTitle} numberOfLines={1}>{item.title}</Text>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.noResults}>
                {recipes.length === 0 ? 'No recipes found' : 'All recipes already in collection'}
              </Text>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.bgMuted, backgroundColor: Colors.bgWhite, gap: Spacing.sm },
  backBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, flexShrink: 1 },
  titleInput: { flex: 1, fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary, borderBottomWidth: 2, borderBottomColor: Colors.primary, paddingVertical: Spacing.xs },
  addBtn: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, paddingHorizontal: 20, paddingVertical: Spacing.sm },
  list: { padding: Spacing.lg, gap: 10, paddingBottom: 60 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgWhite, borderRadius: Radii.lg, padding: 14, gap: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 22 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  cardMeta: { fontSize: 12, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 2 },
  removeBtn: { padding: Spacing.xs },
  emptyTitle: { fontSize: 18, fontFamily: FontFamily.semibold, color: '#334155' },
  emptySubtitle: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textFaint },
  emptyBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: Spacing.md, borderRadius: Radii.md },
  emptyBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 15 },
  backdrop: { flex: 1 },
  sheet: { backgroundColor: Colors.bgWhite, borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, maxHeight: '75%', paddingBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: Spacing.md },
  sheetTitle: { fontSize: 18, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  searchInput: { marginHorizontal: Spacing.lg, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary, marginBottom: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.bgSurface, minHeight: 52 },
  addRowTitle: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular, color: Colors.textPrimary },
  noResults: { textAlign: 'center', padding: 32, fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textFaint },
});
