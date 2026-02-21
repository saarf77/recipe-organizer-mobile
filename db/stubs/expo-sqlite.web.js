/**
 * Web stub for expo-sqlite.
 * expo-sqlite is a native-only module with no web support.
 * This stub prevents the native module load error on web.
 * The app uses Supabase for data on web; SQLite is mobile-only.
 */
const noop = async () => {};
const noopRun = async () => ({ changes: 0, lastInsertRowId: 0 });

const stubDb = {
  execAsync: noop,
  runAsync: noopRun,
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  closeAsync: noop,
};

module.exports = {
  openDatabaseAsync: async () => stubDb,
  openDatabaseSync: () => stubDb,
  deleteDatabaseAsync: noop,
  deleteDatabaseSync: noop,
  SQLiteDatabase: class SQLiteDatabase {},
};
