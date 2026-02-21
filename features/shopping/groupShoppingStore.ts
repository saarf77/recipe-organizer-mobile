/**
 * Group Shopping Store
 * Shared shopping lists per group — persisted in Supabase.
 * Members of a group see the same list in real-time.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/services/supabaseClient';

export interface GroupShoppingItem {
  id: string;
  group_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  added_by: string;
  recipe_id: string | null;
  recipe_name: string | null;
  created_at: string;
}

interface GroupShoppingStore {
  items: GroupShoppingItem[];
  currentGroupId: string | null;
  isLoading: boolean;
  error: string | null;

  loadForGroup: (groupId: string) => Promise<void>;
  addItem: (groupId: string, userId: string, name: string, quantity?: string, unit?: string, recipeId?: string, recipeName?: string) => Promise<void>;
  addFromRecipe: (groupId: string, userId: string, recipeId: string, recipeName: string, ingredients: Array<{ id: string; name: string; quantity: string | null; unit: string | null }>, scale?: number) => Promise<void>;
  toggleItem: (id: string, checked: boolean) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearChecked: (groupId: string) => Promise<void>;
  clearAll: (groupId: string) => Promise<void>;
  subscribeToGroup: (groupId: string) => () => void;
}

export const useGroupShoppingStore = create<GroupShoppingStore>((set, get) => ({
  items: [],
  currentGroupId: null,
  isLoading: false,
  error: null,

  loadForGroup: async (groupId) => {
    set({ isLoading: true, error: null, currentGroupId: groupId });
    try {
      const { data, error } = await supabase
        .from('group_shopping_items')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ items: (data as GroupShoppingItem[]) ?? [] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load shopping list';
      set({ error: msg });
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (groupId, userId, name, quantity, unit, recipeId, recipeName) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newItem: GroupShoppingItem = {
      id: uuidv4(),
      group_id: groupId,
      name: trimmed,
      quantity: quantity?.trim() || null,
      unit: unit?.trim() || null,
      checked: false,
      added_by: userId,
      recipe_id: recipeId ?? null,
      recipe_name: recipeName ?? null,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    set((state) => ({ items: [...state.items, newItem] }));

    const { error } = await supabase.from('group_shopping_items').insert(newItem);
    if (error) {
      // Rollback
      set((state) => ({ items: state.items.filter((i) => i.id !== newItem.id), error: error.message }));
    }
  },

  addFromRecipe: async (groupId, userId, recipeId, recipeName, ingredients, scale = 1) => {
    const { items } = get();
    const existingKeys = new Set(
      items
        .filter((item) => item.recipe_id === recipeId)
        .map((item) => item.name.toLowerCase()),
    );

    const newItems: GroupShoppingItem[] = [];
    for (const ingredient of ingredients) {
      if (existingKeys.has(ingredient.name.toLowerCase())) continue;

      let scaledQuantity = ingredient.quantity;
      if (scaledQuantity !== null && scale !== 1) {
        const parsed = parseFloat(scaledQuantity);
        if (!isNaN(parsed)) {
          scaledQuantity = parseFloat((parsed * scale).toFixed(2)).toString();
        }
      }

      newItems.push({
        id: uuidv4(),
        group_id: groupId,
        name: ingredient.name,
        quantity: scaledQuantity,
        unit: ingredient.unit,
        checked: false,
        added_by: userId,
        recipe_id: recipeId,
        recipe_name: recipeName,
        created_at: new Date().toISOString(),
      });
    }

    if (newItems.length === 0) return;

    // Optimistic update
    set((state) => ({ items: [...state.items, ...newItems] }));

    const { error } = await supabase.from('group_shopping_items').insert(newItems);
    if (error) {
      // Rollback
      const newIds = new Set(newItems.map((i) => i.id));
      set((state) => ({ items: state.items.filter((i) => !newIds.has(i.id)), error: error.message }));
    }
  },

  toggleItem: async (id, checked) => {
    // Optimistic update
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, checked } : i)),
    }));

    const { error } = await supabase
      .from('group_shopping_items')
      .update({ checked })
      .eq('id', id);

    if (error) {
      // Rollback
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? { ...i, checked: !checked } : i)),
        error: error.message,
      }));
    }
  },

  removeItem: async (id) => {
    const prevItems = get().items;
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));

    const { error } = await supabase.from('group_shopping_items').delete().eq('id', id);
    if (error) {
      set({ items: prevItems, error: error.message });
    }
  },

  clearChecked: async (groupId) => {
    const checkedIds = get().items.filter((i) => i.checked && i.group_id === groupId).map((i) => i.id);
    if (checkedIds.length === 0) return;

    set((state) => ({ items: state.items.filter((i) => !checkedIds.includes(i.id)) }));

    const { error } = await supabase
      .from('group_shopping_items')
      .delete()
      .in('id', checkedIds);

    if (error) {
      set({ error: error.message });
    }
  },

  clearAll: async (groupId) => {
    const prevItems = get().items;
    set((state) => ({ items: state.items.filter((i) => i.group_id !== groupId) }));

    const { error } = await supabase
      .from('group_shopping_items')
      .delete()
      .eq('group_id', groupId);

    if (error) {
      set({ items: prevItems, error: error.message });
    }
  },

  subscribeToGroup: (groupId) => {
    const channel = supabase
      .channel(`group_shopping:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_shopping_items', filter: `group_id=eq.${groupId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as GroupShoppingItem;
            set((state) => {
              // Avoid duplicates (we may have already added it optimistically)
              if (state.items.find((i) => i.id === newItem.id)) return state;
              return { items: [...state.items, newItem] };
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as GroupShoppingItem;
            set((state) => ({
              items: state.items.map((i) => (i.id === updated.id ? updated : i)),
            }));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            set((state) => ({ items: state.items.filter((i) => i.id !== deleted.id) }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
