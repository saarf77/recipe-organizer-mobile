import { getDatabase } from '../client';
import { Recipe, Ingredient, Step, RecipeImage, RecipeFilters } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToRecipe(row: Record<string, unknown>): Recipe {
  return {
    ...(row as unknown as Recipe),
    tags: JSON.parse((row['tags'] as string) ?? '[]'),
    is_favorite: Boolean(row['is_favorite']),
  };
}

// ─── Recipe Repository ────────────────────────────────────────────────────────

export const recipeRepository = {
  async findAll(filters?: Partial<RecipeFilters>): Promise<Recipe[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM recipes WHERE is_deleted = 0';
    const params: (string | number | null)[] = [];

    if (filters?.search) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term);
    }
    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.difficulty) {
      query += ' AND difficulty = ?';
      params.push(filters.difficulty);
    }
    if (filters?.is_favorite) {
      query += ' AND is_favorite = 1';
    }
    if (filters?.group_id) {
      query += ' AND group_id = ?';
      params.push(filters.group_id);
    }
    if (filters?.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        query += ' AND tags LIKE ?';
        params.push(`%"${tag}"%`);
      }
    }

    query += ' ORDER BY updated_at DESC';

    const rows = await db.getAllAsync<Record<string, unknown>>(query, params);
    return rows.map(rowToRecipe);
  },

  async findById(id: string): Promise<Recipe | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM recipes WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!row) return null;
    const recipe = rowToRecipe(row);
    recipe.ingredients = await ingredientRepository.findByRecipeId(id);
    recipe.steps = await stepRepository.findByRecipeId(id);
    recipe.images = await recipeImageRepository.findByRecipeId(id);
    return recipe;
  },

  async findRecent(limit = 10): Promise<Recipe[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM recipes WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map(rowToRecipe);
  },

  async findFavorites(): Promise<Recipe[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM recipes WHERE is_favorite = 1 AND is_deleted = 0 ORDER BY updated_at DESC'
    );
    return rows.map(rowToRecipe);
  },

  async findRandom(): Promise<Recipe | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM recipes WHERE is_deleted = 0 ORDER BY RANDOM() LIMIT 1'
    );
    if (!row) return null;
    return rowToRecipe(row);
  },

  async upsert(recipe: Omit<Recipe, 'ingredients' | 'steps' | 'images'>): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO recipes (
        id, group_id, owner_user_id, created_by, title, description,
        difficulty, prep_time_minutes, cook_time_minutes, servings,
        cuisine, category, is_favorite, tags, created_at, updated_at,
        updated_by, is_deleted, local_only
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        recipe.id,
        recipe.group_id ?? null,
        recipe.owner_user_id,
        recipe.created_by,
        recipe.title,
        recipe.description ?? null,
        recipe.difficulty,
        recipe.prep_time_minutes ?? null,
        recipe.cook_time_minutes ?? null,
        recipe.servings ?? null,
        recipe.cuisine ?? null,
        recipe.category ?? null,
        recipe.is_favorite ? 1 : 0,
        JSON.stringify(recipe.tags ?? []),
        recipe.created_at,
        recipe.updated_at,
        recipe.updated_by,
        0,
        0,
      ]
    );
  },

  async create(
    recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'ingredients' | 'steps' | 'images'>
  ): Promise<Recipe> {
    const now = new Date().toISOString();
    const full: Recipe = {
      ...recipe,
      id: uuidv4(),
      created_at: now,
      updated_at: now,
    };
    await recipeRepository.upsert(full);
    return full;
  },

  async update(id: string, data: Partial<Recipe>): Promise<void> {
    const db = await getDatabase();
    const existing = await recipeRepository.findById(id);
    if (!existing) throw new Error(`Recipe ${id} not found`);
    const updated = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await recipeRepository.upsert(updated);
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ is_favorite: number }>(
      'SELECT is_favorite FROM recipes WHERE id = ?',
      [id]
    );
    if (!row) return false;
    const next = row.is_favorite ? 0 : 1;
    await db.runAsync(
      'UPDATE recipes SET is_favorite = ?, updated_at = ? WHERE id = ?',
      [next, new Date().toISOString(), id]
    );
    return Boolean(next);
  },

  async softDelete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE recipes SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  },

  async getCategories(): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ category: string }>(
      'SELECT DISTINCT category FROM recipes WHERE category IS NOT NULL AND is_deleted = 0 ORDER BY category'
    );
    return rows.map((r) => r.category);
  },

  async searchByIngredient(term: string): Promise<Recipe[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT DISTINCT r.* FROM recipes r
       JOIN ingredients i ON i.recipe_id = r.id
       WHERE r.is_deleted = 0 AND i.name LIKE ?
       ORDER BY r.updated_at DESC`,
      [`%${term}%`]
    );
    return rows.map(rowToRecipe);
  },
};

// ─── Ingredient Repository ────────────────────────────────────────────────────

export const ingredientRepository = {
  async findByRecipeId(recipeId: string): Promise<Ingredient[]> {
    const db = await getDatabase();
    return db.getAllAsync<Ingredient>(
      'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY position ASC',
      [recipeId]
    );
  },

  async upsertMany(recipeId: string, items: Omit<Ingredient, 'recipe_id'>[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM ingredients WHERE recipe_id = ?', [recipeId]);
      for (const item of items) {
        await db.runAsync(
          'INSERT INTO ingredients (id, recipe_id, name, quantity, unit, position) VALUES (?,?,?,?,?,?)',
          [item.id || uuidv4(), recipeId, item.name, item.quantity ?? null, item.unit ?? null, item.position]
        );
      }
    });
  },
};

// ─── Step Repository ──────────────────────────────────────────────────────────

export const stepRepository = {
  async findByRecipeId(recipeId: string): Promise<Step[]> {
    const db = await getDatabase();
    return db.getAllAsync<Step>(
      'SELECT * FROM steps WHERE recipe_id = ? ORDER BY position ASC',
      [recipeId]
    );
  },

  async upsertMany(recipeId: string, items: Omit<Step, 'recipe_id'>[]): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM steps WHERE recipe_id = ?', [recipeId]);
      for (const item of items) {
        await db.runAsync(
          'INSERT INTO steps (id, recipe_id, instruction, position) VALUES (?,?,?,?)',
          [item.id || uuidv4(), recipeId, item.instruction, item.position]
        );
      }
    });
  },
};

// ─── Image Repository ─────────────────────────────────────────────────────────

export const recipeImageRepository = {
  async findByRecipeId(recipeId: string): Promise<RecipeImage[]> {
    const db = await getDatabase();
    return db.getAllAsync<RecipeImage>(
      'SELECT * FROM recipe_images WHERE recipe_id = ? ORDER BY created_at ASC',
      [recipeId]
    );
  },

  async insert(image: Omit<RecipeImage, 'created_at'>): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO recipe_images (id, recipe_id, storage_path, local_uri, created_at) VALUES (?,?,?,?,?)',
      [image.id, image.recipe_id, image.storage_path, image.local_uri ?? null, new Date().toISOString()]
    );
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM recipe_images WHERE id = ?', [id]);
  },
};
