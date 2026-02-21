import { create } from 'zustand';
import { Collection } from '@/types';
import { getDatabase } from '@/db/client';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/services/supabaseClient';

interface CollectionStore {
  collections: Collection[];
  isLoading: boolean;
  loadAll: () => Promise<void>;
  createCollection: (data: { name: string; description?: string }) => Promise<Collection>;
  updateCollection: (id: string, data: Partial<Pick<Collection, 'name' | 'description' | 'recipe_ids'>>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addRecipe: (collectionId: string, recipeId: string) => Promise<void>;
  removeRecipe: (collectionId: string, recipeId: string) => Promise<void>;
}

// ─── SQLite helpers ───────────────────────────────────────────────────────────

async function localUpsert(c: Collection): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO collections
       (id, owner_user_id, name, description, recipe_ids, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [c.id, c.owner_user_id, c.name, c.description ?? null, JSON.stringify(c.recipe_ids), c.created_at, c.updated_at]
  );
}

async function localDelete(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
}

async function localLoadAll(userId: string): Promise<Collection[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; owner_user_id: string; name: string;
    description: string | null; recipe_ids: string;
    created_at: string; updated_at: string;
  }>('SELECT * FROM collections WHERE owner_user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map((r) => ({ ...r, description: r.description ?? null, recipe_ids: JSON.parse(r.recipe_ids) as string[] }));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Try to pull from Supabase first, merge into local SQLite
      const { data: remote } = await supabase
        .from('collections')
        .select('*')
        .eq('owner_user_id', session.user.id)
        .order('updated_at', { ascending: false });

      if (remote && remote.length > 0) {
        for (const r of remote) {
          const c: Collection = {
            ...r,
            recipe_ids: Array.isArray(r.recipe_ids) ? (r.recipe_ids as string[]) : JSON.parse(r.recipe_ids as string),
          };
          await localUpsert(c);
        }
      }

      // Always read from local as source of truth (works offline too)
      const collections = await localLoadAll(session.user.id);
      set({ collections });
    } finally {
      set({ isLoading: false });
    }
  },

  createCollection: async (data) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const now = new Date().toISOString();
    const collection: Collection = {
      id: uuidv4(),
      owner_user_id: session.user.id,
      name: data.name,
      description: data.description ?? null,
      recipe_ids: [],
      created_at: now,
      updated_at: now,
    };

    // Local first
    await localUpsert(collection);

    // Sync to Supabase (best-effort)
    supabase.from('collections').insert({
      id: collection.id,
      owner_user_id: collection.owner_user_id,
      name: collection.name,
      description: collection.description,
      recipe_ids: collection.recipe_ids,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
    }).then(({ error }) => {
      if (error) console.warn('[collections] remote insert failed:', error.message);
    });

    set((state) => ({ collections: [collection, ...state.collections] }));
    return collection;
  },

  updateCollection: async (id, data) => {
    const now = new Date().toISOString();
    const current = get().collections.find((c) => c.id === id);
    if (!current) return;

    const updated: Collection = { ...current, ...data, updated_at: now };

    // Local first
    await localUpsert(updated);

    // Sync to Supabase (best-effort)
    const remoteData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) remoteData['name'] = data.name;
    if (data.description !== undefined) remoteData['description'] = data.description ?? null;
    if (data.recipe_ids !== undefined) remoteData['recipe_ids'] = data.recipe_ids;

    supabase.from('collections').update(remoteData).eq('id', id).then(({ error }) => {
      if (error) console.warn('[collections] remote update failed:', error.message);
    });

    set((state) => ({
      collections: state.collections.map((c) => c.id === id ? updated : c),
    }));
  },

  deleteCollection: async (id) => {
    await localDelete(id);

    // Sync to Supabase (best-effort)
    supabase.from('collections').delete().eq('id', id).then(({ error }) => {
      if (error) console.warn('[collections] remote delete failed:', error.message);
    });

    set((state) => ({ collections: state.collections.filter((c) => c.id !== id) }));
  },

  addRecipe: async (collectionId, recipeId) => {
    const collection = get().collections.find((c) => c.id === collectionId);
    if (!collection) return;
    if (collection.recipe_ids.includes(recipeId)) return;
    await get().updateCollection(collectionId, { recipe_ids: [...collection.recipe_ids, recipeId] });
  },

  removeRecipe: async (collectionId, recipeId) => {
    const collection = get().collections.find((c) => c.id === collectionId);
    if (!collection) return;
    await get().updateCollection(collectionId, { recipe_ids: collection.recipe_ids.filter((id) => id !== recipeId) });
  },
}));
