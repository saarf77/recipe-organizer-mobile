/**
 * Web stub for the SQLite database client.
 * expo-sqlite is native-only and has no web implementation.
 * All DB operations are no-ops that return empty/default values.
 * The app works on web via Supabase (remote) data only.
 */

// Minimal stub that satisfies the SQLiteDatabase interface used in repositories
const noop = async () => {};
const noopRun = async () => ({ changes: 0, lastInsertRowId: 0 });

const stubDb = {
  execAsync: noop,
  runAsync: noopRun,
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  closeAsync: noop,
};

let _initialized = false;

export async function getDatabase(): Promise<typeof stubDb> {
  if (!_initialized) {
    console.warn('[DB] expo-sqlite is not available on web. Using no-op stub.');
    _initialized = true;
  }
  return stubDb;
}

export async function closeDatabase(): Promise<void> {}
