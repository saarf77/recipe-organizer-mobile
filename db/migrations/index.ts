import * as SQLite from 'expo-sqlite';
import { SCHEMA_VERSION, CREATE_TABLES_SQL } from '../schema';

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // Create meta table first if it doesn't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version   INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM _migrations'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  console.log(`[DB] Migrating from v${currentVersion} to v${SCHEMA_VERSION}`);

  await db.withTransactionAsync(async () => {
    for (const sql of CREATE_TABLES_SQL) {
      await db.execAsync(sql);
    }

    // Seed migration version
    for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
      await db.runAsync(
        'INSERT OR IGNORE INTO _migrations (version) VALUES (?)',
        [v]
      );
    }
  });

  console.log(`[DB] Migration complete → v${SCHEMA_VERSION}`);
}
