import { Platform } from 'react-native';
import { create } from 'zustand';
import { Recipe, RecipeFilters, Ingredient, Step } from '@/types';
import {
  recipeRepository,
  ingredientRepository,
  stepRepository,
} from '@/db/repositories/recipeRepository';
import {
  enqueueRecipeUpsert,
  enqueueRecipeDelete,
  enqueueIngredientsUpdate,
  enqueueStepsUpdate,
} from '@/services/syncService';
import { supabase } from '@/services/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// ─── Supabase helpers (web-only) ──────────────────────────────────────────────

const RECIPE_SELECT = '*, ingredients(*), steps(*), recipe_images(*)';

function resolveImageUrl(storagePath: string): string {
  if (storagePath.startsWith('http')) return storagePath;
  const { data } = supabase.storage.from('recipe-images').getPublicUrl(storagePath);
  return data.publicUrl;
}

function mapSupabaseRecipe(r: Record<string, unknown>): Recipe {
  type RawImage = { id: string; recipe_id: string; storage_path: string; local_uri?: string; created_at: string };
  const rawImages = Array.isArray(r.recipe_images) ? (r.recipe_images as RawImage[]) : [];
  return {
    ...(r as unknown as Recipe),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    ingredients: Array.isArray(r.ingredients) ? (r.ingredients as Ingredient[]) : [],
    steps: Array.isArray(r.steps) ? (r.steps as Step[]) : [],
    images: rawImages.map((img) => ({ ...img, storage_path: resolveImageUrl(img.storage_path) })),
  };
}

async function webFindAll(filters: RecipeFilters): Promise<Recipe[]> {
  let query = supabase.from('recipes').select(RECIPE_SELECT);
  if (filters.search) query = query.ilike('title', `%${filters.search}%`);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
  if (filters.is_favorite) query = query.eq('is_favorite', true);
  if (filters.group_id) query = query.eq('group_id', filters.group_id);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) console.warn('[recipeStore] webFindAll error:', error.message, error.code);
  let recipes = (data ?? []).map(mapSupabaseRecipe);
  // Dietary filters: client-side tag matching
  if (filters.dietary && filters.dietary.length > 0) {
    recipes = recipes.filter((r) =>
      filters.dietary.every((d) => r.tags.map((t) => t.toLowerCase()).includes(d.toLowerCase()))
    );
  }
  return recipes;
}

async function webFindRecent(limit: number): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.warn('[recipeStore] webFindRecent error:', error.message, error.code);
  return (data ?? []).map(mapSupabaseRecipe);
}

async function webFindFavorites(): Promise<Recipe[]> {
  const { data } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('is_favorite', true)
    .order('updated_at', { ascending: false });
  return (data ?? []).map(mapSupabaseRecipe);
}

async function webFindRandom(): Promise<Recipe | null> {
  // Supabase doesn't have ORDER BY RANDOM() — fetch IDs and pick one
  const { data: ids } = await supabase
    .from('recipes')
    .select('id');
  if (!ids || ids.length === 0) return null;
  const picked = ids[Math.floor(Math.random() * ids.length)]!;
  const { data } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', picked.id)
    .single();
  return data ? mapSupabaseRecipe(data as Record<string, unknown>) : null;
}

async function webFindById(id: string): Promise<Recipe | null> {
  const { data } = await supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .single();
  return data ? mapSupabaseRecipe(data as Record<string, unknown>) : null;
}

async function webGetCategories(): Promise<string[]> {
  const { data } = await supabase
    .from('recipes')
    .select('category')
    .not('category', 'is', null);
  const set = new Set<string>();
  (data ?? []).forEach((r: { category: string | null }) => { if (r.category) set.add(r.category); });
  return Array.from(set).sort();
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface RecipeStore {
  recipes: Recipe[];
  recentRecipes: Recipe[];
  favoriteRecipes: Recipe[];
  randomRecipe: Recipe | null;
  currentRecipe: Recipe | null;
  categories: string[];
  isLoading: boolean;
  filters: RecipeFilters;
  ingredientSearchResults: Recipe[];
  ingredientSearchTerm: string;

  loadAll: (override?: Partial<RecipeFilters>) => Promise<void>;
  loadRecent: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadRandom: () => Promise<void>;
  loadCategories: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  setFilter: <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => void;
  searchByIngredient: (term: string) => Promise<void>;
  createRecipe: (data: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'ingredients' | 'steps' | 'images'> & {
    ingredients: Omit<Ingredient, 'recipe_id' | 'checked'>[];
    steps: Omit<Step, 'recipe_id' | 'completed'>[];
  }) => Promise<Recipe>;
  updateRecipe: (id: string, data: Partial<Omit<Recipe, 'ingredients' | 'steps' | 'images'>> & {
    ingredients?: Omit<Ingredient, 'recipe_id' | 'checked'>[];
    steps?: Omit<Step, 'recipe_id' | 'completed'>[];
  }) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

const DEFAULT_FILTERS: RecipeFilters = {
  search: '',
  category: null,
  tags: [],
  difficulty: null,
  is_favorite: false,
  group_id: null,
  dietary: [],
};

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  recentRecipes: [],
  favoriteRecipes: [],
  randomRecipe: null,
  currentRecipe: null,
  categories: [],
  isLoading: false,
  filters: DEFAULT_FILTERS,
  ingredientSearchResults: [],
  ingredientSearchTerm: '',

  loadAll: async (override) => {
    set({ isLoading: true });
    try {
      const filters = { ...get().filters, ...override };
      if (Platform.OS === 'web') {
        const recipes = await webFindAll(filters);
        set({ recipes, isLoading: false });
        return;
      }
      const recipes = await recipeRepository.findAll(filters);
      set({ recipes, isLoading: false });
    } catch (e) {
      console.error('[recipeStore] loadAll failed:', e);
      set({ isLoading: false });
    }
  },

  loadRecent: async () => {
    if (Platform.OS === 'web') {
      const recentRecipes = await webFindRecent(10);
      set({ recentRecipes });
      return;
    }
    const recentRecipes = await recipeRepository.findRecent(10);
    set({ recentRecipes });
  },

  loadFavorites: async () => {
    if (Platform.OS === 'web') {
      const favoriteRecipes = await webFindFavorites();
      set({ favoriteRecipes });
      return;
    }
    const favoriteRecipes = await recipeRepository.findFavorites();
    set({ favoriteRecipes });
  },

  loadRandom: async () => {
    if (Platform.OS === 'web') {
      const randomRecipe = await webFindRandom();
      set({ randomRecipe });
      return;
    }
    const randomRecipe = await recipeRepository.findRandom();
    set({ randomRecipe });
  },

  loadCategories: async () => {
    if (Platform.OS === 'web') {
      const categories = await webGetCategories();
      set({ categories });
      return;
    }
    const categories = await recipeRepository.getCategories();
    set({ categories });
  },

  fetchById: async (id) => {
    if (Platform.OS === 'web') {
      const currentRecipe = await webFindById(id);
      set({ currentRecipe });
      return;
    }
    const currentRecipe = await recipeRepository.findById(id);
    set({ currentRecipe });
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    void get().loadAll();
  },

  searchByIngredient: async (term) => {
    set({ ingredientSearchTerm: term });
    if (!term.trim()) {
      set({ ingredientSearchResults: [] });
      return;
    }
    if (Platform.OS === 'web') {
      // Fetch all ingredients matching term, then fetch those recipes
      const { data: ingRows } = await supabase
        .from('ingredients')
        .select('recipe_id')
        .ilike('name', `%${term}%`);
      const ids = [...new Set((ingRows ?? []).map((r: { recipe_id: string }) => r.recipe_id))];
      if (ids.length === 0) { set({ ingredientSearchResults: [] }); return; }
      const { data } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .in('id', ids)
        .order('updated_at', { ascending: false });
      set({ ingredientSearchResults: (data ?? []).map(mapSupabaseRecipe) });
      return;
    }
    const results = await recipeRepository.searchByIngredient(term);
    set({ ingredientSearchResults: results });
  },

  createRecipe: async (data) => {
    const now = new Date().toISOString();
    const recipe: Recipe = {
      id: uuidv4(),
      group_id: data.group_id,
      owner_user_id: data.owner_user_id,
      created_by: data.created_by,
      title: data.title,
      description: data.description ?? null,
      difficulty: data.difficulty,
      prep_time_minutes: data.prep_time_minutes ?? null,
      cook_time_minutes: data.cook_time_minutes ?? null,
      servings: data.servings ?? null,
      cuisine: data.cuisine ?? null,
      category: data.category ?? null,
      is_favorite: data.is_favorite ?? false,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
      updated_by: data.updated_by,
    };

    if (Platform.OS === 'web') {
      // Write directly to Supabase on web
      const { error: recipeError } = await supabase.from('recipes').insert({ ...recipe });
      if (recipeError) throw new Error(`Failed to save recipe: ${recipeError.message}`);
      if (data.ingredients.length > 0) {
        const { error: ingError } = await supabase.from('ingredients').insert(
          data.ingredients.map((i, idx) => ({ ...i, id: i.id ?? uuidv4(), recipe_id: recipe.id, position: idx }))
        );
        if (ingError) console.warn('[recipeStore] ingredients insert failed:', ingError.message);
      }
      if (data.steps.length > 0) {
        const { error: stepError } = await supabase.from('steps').insert(
          data.steps.map((s, idx) => ({ ...s, id: s.id ?? uuidv4(), recipe_id: recipe.id, position: idx }))
        );
        if (stepError) console.warn('[recipeStore] steps insert failed:', stepError.message);
      }
      const recipes = await webFindAll(get().filters);
      const recentRecipes = await webFindRecent(10);
      set({ recipes, recentRecipes });
      return recipe;
    }

    // Optimistic local write
    await recipeRepository.upsert(recipe);
    await ingredientRepository.upsertMany(recipe.id, data.ingredients.map((i, idx) => ({ ...i, position: idx })));
    await stepRepository.upsertMany(recipe.id, data.steps.map((s, idx) => ({ ...s, position: idx })));

    // Enqueue for remote sync
    await enqueueRecipeUpsert(recipe);
    await enqueueIngredientsUpdate(recipe.id, data.ingredients);
    await enqueueStepsUpdate(recipe.id, data.steps);

    // Update state
    const updated = await recipeRepository.findAll(get().filters);
    const recent = await recipeRepository.findRecent(10);
    set({ recipes: updated, recentRecipes: recent });

    return recipe;
  },

  updateRecipe: async (id, data) => {
    const { ingredients, steps, ...recipeFields } = data;

    if (Platform.OS === 'web') {
      await supabase.from('recipes').update({ ...recipeFields, updated_at: new Date().toISOString() }).eq('id', id);
      if (ingredients !== undefined) {
        await supabase.from('ingredients').delete().eq('recipe_id', id);
        if (ingredients.length > 0) {
          await supabase.from('ingredients').insert(
            ingredients.map((i, idx) => ({ ...i, id: i.id ?? uuidv4(), recipe_id: id, position: idx }))
          );
        }
      }
      if (steps !== undefined) {
        await supabase.from('steps').delete().eq('recipe_id', id);
        if (steps.length > 0) {
          await supabase.from('steps').insert(
            steps.map((s, idx) => ({ ...s, id: s.id ?? uuidv4(), recipe_id: id, position: idx }))
          );
        }
      }
      const recipes = await webFindAll(get().filters);
      set({ recipes });
      return;
    }

    await recipeRepository.update(id, { ...recipeFields, updated_at: new Date().toISOString() });
    if (ingredients !== undefined) {
      await ingredientRepository.upsertMany(id, ingredients.map((i, idx) => ({ ...i, position: idx })));
      await enqueueIngredientsUpdate(id, ingredients);
    }
    if (steps !== undefined) {
      await stepRepository.upsertMany(id, steps.map((s, idx) => ({ ...s, position: idx })));
      await enqueueStepsUpdate(id, steps);
    }
    const updated = await recipeRepository.findById(id);
    if (updated) await enqueueRecipeUpsert(updated);
    await get().loadAll();
  },

  deleteRecipe: async (id) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw new Error(`Delete failed: ${error.message}`);
      const recipes = await webFindAll(get().filters);
      const recentRecipes = await webFindRecent(10);
      set({ recipes, recentRecipes });
      return;
    }
    await recipeRepository.softDelete(id);
    await enqueueRecipeDelete(id);
    await get().loadAll();
    await get().loadRecent();
  },

  toggleFavorite: async (id) => {
    if (Platform.OS === 'web') {
      const current = await webFindById(id);
      if (!current) return;
      await supabase.from('recipes').update({ is_favorite: !current.is_favorite, updated_at: new Date().toISOString() }).eq('id', id);
      const recipes = await webFindAll(get().filters);
      const favoriteRecipes = await webFindFavorites();
      set({ recipes, favoriteRecipes });
      return;
    }
    await recipeRepository.toggleFavorite(id);
    const updated = await recipeRepository.findById(id);
    if (updated) await enqueueRecipeUpsert(updated);
    await get().loadAll();
    await get().loadFavorites();
  },
}));
