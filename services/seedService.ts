import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/db/client';
import { supabase } from '@/services/supabaseClient';
import { SEED_RECIPES } from '@/db/seedRecipes';

// Bump this key whenever the seed data changes significantly,
// or to force a re-seed after a broken previous run.
const SEED_DONE_KEY = 'sample_recipes_seeded_v11';

/** Returns true if recipes were actually inserted (first install), false if already seeded. */
export async function seedSampleRecipes(userId: string): Promise<boolean> {
  const already = await AsyncStorage.getItem(SEED_DONE_KEY);
  if (already) return false;

  if (Platform.OS === 'web') {
    await seedViaSupabase(userId);
  } else {
    await seedViaSQLite(userId);
  }

  await AsyncStorage.setItem(SEED_DONE_KEY, '1');
  console.log('[Seed] Inserted', SEED_RECIPES.length, 'sample recipes');
  return true;
}

// ─── Web: seed via Supabase ───────────────────────────────────────────────────

async function seedViaSupabase(userId: string): Promise<void> {
  const now = new Date().toISOString();

  // Delete any previously seeded sample recipes (matched by title) to avoid duplicates
  // across seed version bumps. Supabase cascades to ingredients, steps, recipe_images.
  const seedTitles = SEED_RECIPES.map((r) => r.title);
  await supabase
    .from('recipes')
    .delete()
    .eq('owner_user_id', userId)
    .in('title', seedTitles);

  for (const seed of SEED_RECIPES) {
    const recipeId = uuidv4();

    const { error: recipeErr } = await supabase.from('recipes').insert({
      id: recipeId,
      group_id: null,
      owner_user_id: userId,
      created_by: userId,
      title: seed.title,
      description: seed.description,
      difficulty: seed.difficulty,
      prep_time_minutes: seed.prep_time_minutes,
      cook_time_minutes: seed.cook_time_minutes,
      servings: seed.servings,
      cuisine: seed.cuisine,
      category: seed.category,
      is_favorite: false,
      tags: seed.tags,
      created_at: now,
      updated_at: now,
      updated_by: userId,
    });

    if (recipeErr) {
      throw new Error(`[Seed] Supabase recipe insert failed for "${seed.title}": ${recipeErr.message}`);
    }

    if (seed.ingredients.length > 0) {
      await supabase.from('ingredients').insert(
        seed.ingredients.map((ing, i) => ({
          id: uuidv4(),
          recipe_id: recipeId,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          position: i,
        }))
      );
    }

    if (seed.steps.length > 0) {
      await supabase.from('steps').insert(
        seed.steps.map((step, i) => ({
          id: uuidv4(),
          recipe_id: recipeId,
          instruction: step.instruction,
          position: i,
        }))
      );
    }

    if (seed.imageUrl) {
      const { error: imgErr } = await supabase.from('recipe_images').insert({
        id: uuidv4(),
        recipe_id: recipeId,
        storage_path: seed.imageUrl,
        created_at: now,
      });
      if (imgErr) {
        console.error(`[Seed] recipe_images insert failed for "${seed.title}":`, imgErr.message);
      }
    }
  }
}

// ─── Native: seed via SQLite ──────────────────────────────────────────────────

async function seedViaSQLite(userId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Delete any previously seeded sample recipes so we don't accumulate duplicates.
  // recipe_images, ingredients, and steps cascade via ON DELETE CASCADE.
  await db.runAsync(
    'DELETE FROM recipes WHERE owner_user_id = ? AND is_sample = 1',
    [userId]
  );

  for (const seed of SEED_RECIPES) {
    const recipeId = uuidv4();

    await db.runAsync(
      `INSERT OR IGNORE INTO recipes (
        id, group_id, owner_user_id, created_by, title, description,
        difficulty, prep_time_minutes, cook_time_minutes, servings,
        cuisine, category, is_favorite, tags, created_at, updated_at,
        updated_by, is_deleted, local_only, is_sample
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        recipeId,
        null,
        userId,
        userId,
        seed.title,
        seed.description,
        seed.difficulty,
        seed.prep_time_minutes,
        seed.cook_time_minutes,
        seed.servings,
        seed.cuisine,
        seed.category,
        0,
        JSON.stringify(seed.tags),
        now,
        now,
        userId,
        0,
        1, // local_only
        1, // is_sample
      ]
    );

    for (const [i, ing] of seed.ingredients.entries()) {
      await db.runAsync(
        'INSERT INTO ingredients (id, recipe_id, name, quantity, unit, position) VALUES (?,?,?,?,?,?)',
        [uuidv4(), recipeId, ing.name, ing.quantity ?? null, ing.unit ?? null, i]
      );
    }

    for (const [i, step] of seed.steps.entries()) {
      await db.runAsync(
        'INSERT INTO steps (id, recipe_id, instruction, position) VALUES (?,?,?,?)',
        [uuidv4(), recipeId, step.instruction, i]
      );
    }

    if (seed.imageUrl) {
      await db.runAsync(
        'INSERT INTO recipe_images (id, recipe_id, storage_path, local_uri, created_at) VALUES (?,?,?,?,?)',
        [uuidv4(), recipeId, seed.imageUrl, null, now]
      );
    }
  }
}
