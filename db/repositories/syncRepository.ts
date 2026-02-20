import { getDatabase } from '../client';
import { SyncQueueItem, SyncOperation, SyncConflict } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const syncRepository = {
  async enqueue(
    tableName: string,
    recordId: string,
    operation: SyncOperation,
    payload: object
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, operation, payload, status, retry_count)
       VALUES (?,?,?,?,?,?,?)`,
      [uuidv4(), tableName, recordId, operation, JSON.stringify(payload), 'pending', 0]
    );
  },

  async getPending(limit = 50): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    return db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status IN ('pending','failed') AND retry_count < 5
       ORDER BY created_at ASC LIMIT ?`,
      [limit]
    );
  },

  async markInProgress(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'in_progress', last_attempted_at = ? WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  },

  async markDone(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE sync_queue SET status = ? WHERE id = ?', ['done', id]);
  },

  async markFailed(id: string, error: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, error = ? WHERE id = ?`,
      [error, id]
    );
  },

  async clearDone(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM sync_queue WHERE status = 'done'");
  },

  async getLastSyncAt(): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'lastSyncAt'"
    );
    return row?.value ?? null;
  },

  async setLastSyncAt(ts: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('lastSyncAt', ?)",
      [ts]
    );
  },

  async logConflict(
    tableName: string,
    recordId: string,
    localData: object,
    remoteData: object
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_conflicts (id, table_name, record_id, local_data, remote_data)
       VALUES (?,?,?,?,?)`,
      [uuidv4(), tableName, recordId, JSON.stringify(localData), JSON.stringify(remoteData)]
    );
  },

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const db = await getDatabase();
    return db.getAllAsync<SyncConflict>(
      'SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC'
    );
  },

  async resolveConflict(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
  },

  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending','failed') AND retry_count < 5"
    );
    return row?.count ?? 0;
  },
};
