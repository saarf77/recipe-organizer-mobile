/**
 * Offline-first sync service.
 * - Optimistic local writes → sync_queue
 * - Pull remote changes since lastSyncAt
 * - Last-write-wins conflict resolution
 * - Automatic retry with exponential backoff
 */

import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';
import { syncRepository } from '@/db/repositories/syncRepository';
import { recipeRepository, ingredientRepository, stepRepository } from '@/db/repositories/recipeRepository';
import { SyncQueueItem } from '@/types';

const MAX_RETRIES = 5;
const SYNC_INTERVAL_MS = 30_000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// ─── Push (local → remote) ────────────────────────────────────────────────────

async function pushItem(item: SyncQueueItem): Promise<void> {
  await syncRepository.markInProgress(item.id);
  const payload = JSON.parse(item.payload);

  try {
    if (item.operation === 'DELETE') {
      const { error } = await supabase.from(item.table_name).delete().eq('id', item.record_id);
      if (error) throw error;
    } else {
      // INSERT or UPDATE — upsert
      const { error } = await supabase.from(item.table_name).upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    }

    await syncRepository.markDone(item.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await syncRepository.markFailed(item.id, msg);
    throw err;
  }
}

// ─── Pull (remote → local) ────────────────────────────────────────────────────

async function pullRecipes(since: string | null): Promise<number> {
  let query = supabase.from('recipes').select('*');
  if (since) query = query.gt('updated_at', since);

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return 0;

  let count = 0;
  for (const remote of data) {
    // conflict check: local row with same id and newer updated_at
    const local = await recipeRepository.findById(remote.id);

    if (local && local.updated_at > remote.updated_at) {
      // Local wins (last-write-wins) — log conflict
      await syncRepository.logConflict('recipes', remote.id, local, remote);
      continue;
    }

    await recipeRepository.upsert(remote);

    // Pull related ingredients + steps
    const { data: ings } = await supabase.from('ingredients').select('*').eq('recipe_id', remote.id);
    if (ings) await ingredientRepository.upsertMany(remote.id, ings);

    const { data: stps } = await supabase.from('steps').select('*').eq('recipe_id', remote.id);
    if (stps) await stepRepository.upsertMany(remote.id, stps);

    count++;
  }
  return count;
}

// ─── Main Sync Loop ───────────────────────────────────────────────────────────

export async function runSync(): Promise<{ pushed: number; pulled: number; errors: number }> {
  if (isSyncing) return { pushed: 0, pulled: 0, errors: 0 };

  const net = await NetInfo.fetch();
  if (!net.isConnected) return { pushed: 0, pulled: 0, errors: 0 };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { pushed: 0, pulled: 0, errors: 0 };

  isSyncing = true;
  let pushed = 0;
  let errors = 0;
  let pulled = 0;

  try {
    // 1) Push pending items (respect MAX_RETRIES threshold)
    const pending = await syncRepository.getPending(MAX_RETRIES);
    for (const item of pending) {
      try {
        await pushItem(item);
        pushed++;
      } catch {
        errors++;
      }
    }

    // 2) Pull remote changes
    const lastSyncAt = await syncRepository.getLastSyncAt();
    pulled += await pullRecipes(lastSyncAt);

    // 3) Update lastSyncAt
    await syncRepository.setLastSyncAt(new Date().toISOString());

    // 4) Cleanup done items
    await syncRepository.clearDone();
  } finally {
    isSyncing = false;
  }

  return { pushed, pulled, errors };
}

// ─── Background Sync ──────────────────────────────────────────────────────────

export function startBackgroundSync(): void {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    runSync().catch((e) => console.warn('[Sync] background error', e));
  }, SYNC_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

// ─── Optimistic Helpers ───────────────────────────────────────────────────────

export async function enqueueRecipeUpsert(recipe: object): Promise<void> {
  const r = recipe as { id: string };
  await syncRepository.enqueue('recipes', r.id, 'UPDATE', recipe);
}

export async function enqueueRecipeDelete(id: string): Promise<void> {
  await syncRepository.enqueue('recipes', id, 'DELETE', { id });
}

export async function enqueueIngredientsUpdate(recipeId: string, ingredients: object[]): Promise<void> {
  for (const ing of ingredients) {
    const i = ing as { id: string };
    await syncRepository.enqueue('ingredients', i.id, 'UPDATE', ing);
  }
}

export async function enqueueStepsUpdate(recipeId: string, steps: object[]): Promise<void> {
  for (const step of steps) {
    const s = step as { id: string };
    await syncRepository.enqueue('steps', s.id, 'UPDATE', step);
  }
}
