import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  recipeId?: string;
  recipeName?: string;
}

interface ShoppingStore {
  items: ShoppingItem[];
  addFromRecipe: (
    recipeId: string,
    recipeName: string,
    ingredients: Array<{ id: string; name: string; quantity: string | null; unit: string | null }>,
    scale?: number,
  ) => number;
  addManual: (name: string, quantity?: string, unit?: string) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
}

export const useShoppingStore = create<ShoppingStore>((set, get) => ({
  items: [],

  addFromRecipe: (recipeId, recipeName, ingredients, scale = 1) => {
    const { items } = get();
    const existingKeys = new Set(
      items
        .filter((item) => item.recipeId === recipeId)
        .map((item) => item.name.toLowerCase()),
    );

    const newItems: ShoppingItem[] = [];

    for (const ingredient of ingredients) {
      if (existingKeys.has(ingredient.name.toLowerCase())) {
        continue;
      }

      let scaledQuantity = ingredient.quantity;
      if (scaledQuantity !== null && scale !== 1) {
        const parsed = parseFloat(scaledQuantity);
        if (!isNaN(parsed)) {
          const scaled = parsed * scale;
          // Keep up to 2 decimal places, strip trailing zeros
          scaledQuantity = parseFloat(scaled.toFixed(2)).toString();
        }
      }

      newItems.push({
        id: uuidv4(),
        name: ingredient.name,
        quantity: scaledQuantity,
        unit: ingredient.unit,
        checked: false,
        recipeId,
        recipeName,
      });
    }

    if (newItems.length > 0) {
      set((state) => ({ items: [...state.items, ...newItems] }));
    }
    return newItems.length;
  },

  addManual: (name, quantity, unit) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const newItem: ShoppingItem = {
      id: uuidv4(),
      name: trimmed,
      quantity: quantity?.trim() || null,
      unit: unit?.trim() || null,
      checked: false,
    };

    set((state) => ({ items: [...state.items, newItem] }));
  },

  toggleItem: (id) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    }));
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  clearChecked: () => {
    set((state) => ({ items: state.items.filter((item) => !item.checked) }));
  },

  clearAll: () => {
    set({ items: [] });
  },
}));
