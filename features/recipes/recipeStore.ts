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
import { v4 as uuidv4 } from 'uuid';

interface RecipeStore {
  recipes: Recipe[];
  recentRecipes: Recipe[];
  favoriteRecipes: Recipe[];
  randomRecipe: Recipe | null;
  currentRecipe: Recipe | null;
  categories: string[];
  isLoading: boolean;
  filters: RecipeFilters;

  loadAll: (override?: Partial<RecipeFilters>) => Promise<void>;
  loadRecent: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  loadRandom: () => Promise<void>;
  loadCategories: () => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  setFilter: <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => void;
  createRecipe: (data: Omit<Recipe, 'id' | 'created_at' | 'updated_at'> & {
    ingredients: Omit<Ingredient, 'recipe_id' | 'checked'>[];
    steps: Omit<Step, 'recipe_id' | 'completed'>[];
  }) => Promise<Recipe>;
  updateRecipe: (id: string, data: Partial<Recipe>) => Promise<void>;
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

  loadAll: async (override) => {
    set({ isLoading: true });
    const filters = { ...get().filters, ...override };
    const recipes = await recipeRepository.findAll(filters);
    set({ recipes, isLoading: false });
  },

  loadRecent: async () => {
    const recentRecipes = await recipeRepository.findRecent(10);
    set({ recentRecipes });
  },

  loadFavorites: async () => {
    const favoriteRecipes = await recipeRepository.findFavorites();
    set({ favoriteRecipes });
  },

  loadRandom: async () => {
    const randomRecipe = await recipeRepository.findRandom();
    set({ randomRecipe });
  },

  loadCategories: async () => {
    const categories = await recipeRepository.getCategories();
    set({ categories });
  },

  fetchById: async (id) => {
    const currentRecipe = await recipeRepository.findById(id);
    set({ currentRecipe });
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
    get().loadAll();
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
    await recipeRepository.update(id, { ...data, updated_at: new Date().toISOString() });
    const updated = await recipeRepository.findById(id);
    if (updated) await enqueueRecipeUpsert(updated);
    await get().loadAll();
  },

  deleteRecipe: async (id) => {
    await recipeRepository.softDelete(id);
    await enqueueRecipeDelete(id);
    await get().loadAll();
    await get().loadRecent();
  },

  toggleFavorite: async (id) => {
    await recipeRepository.toggleFavorite(id);
    const updated = await recipeRepository.findById(id);
    if (updated) await enqueueRecipeUpsert(updated);
    await get().loadAll();
    await get().loadFavorites();
  },
}));
