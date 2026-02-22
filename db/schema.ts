// SQLite local schema definitions
// Mirrors the Supabase schema with offline-first additions

export const SCHEMA_VERSION = 6;

export const CREATE_TABLES_SQL: string[] = [
  // ── profiles ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS profiles (
    id            TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    avatar_url    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── groups ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS groups (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    editing_mode  TEXT NOT NULL DEFAULT 'strict',
    created_by    TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── group_members ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS group_members (
    group_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member',
    joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
  )`,

  // ── recipes ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS recipes (
    id                  TEXT PRIMARY KEY,
    group_id            TEXT,
    owner_user_id       TEXT NOT NULL,
    created_by          TEXT NOT NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    difficulty          TEXT NOT NULL DEFAULT 'medium',
    prep_time_minutes   INTEGER,
    cook_time_minutes   INTEGER,
    servings            INTEGER,
    cuisine             TEXT,
    category            TEXT,
    is_favorite         INTEGER NOT NULL DEFAULT 0,
    tags                TEXT NOT NULL DEFAULT '[]',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by          TEXT NOT NULL,
    is_deleted          INTEGER NOT NULL DEFAULT 0,
    local_only          INTEGER NOT NULL DEFAULT 0,
    is_sample           INTEGER NOT NULL DEFAULT 0
  )`,

  // ── ingredients ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ingredients (
    id          TEXT PRIMARY KEY,
    recipe_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    quantity    TEXT,
    unit        TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  )`,

  // ── steps ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS steps (
    id          TEXT PRIMARY KEY,
    recipe_id   TEXT NOT NULL,
    instruction TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  )`,

  // ── recipe_images ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS recipe_images (
    id            TEXT PRIMARY KEY,
    recipe_id     TEXT NOT NULL,
    storage_path  TEXT NOT NULL,
    local_uri     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
  )`,

  // ── collections ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS collections (
    id              TEXT PRIMARY KEY,
    owner_user_id   TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    recipe_ids      TEXT NOT NULL DEFAULT '[]',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── sync_queue ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id                TEXT PRIMARY KEY,
    table_name        TEXT NOT NULL,
    record_id         TEXT NOT NULL,
    operation         TEXT NOT NULL,
    payload           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending',
    retry_count       INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    last_attempted_at TEXT,
    error             TEXT
  )`,

  // ── sync_conflicts ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sync_conflicts (
    id           TEXT PRIMARY KEY,
    table_name   TEXT NOT NULL,
    record_id    TEXT NOT NULL,
    local_data   TEXT NOT NULL,
    remote_data  TEXT NOT NULL,
    resolved_at  TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── meta ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sync_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  )`,

  // ── indexes ───────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_recipes_group_id      ON recipes(group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_owner         ON recipes(owner_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_favorite      ON recipes(is_favorite)`,
  `CREATE INDEX IF NOT EXISTS idx_recipes_category      ON recipes(category)`,
  `CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS idx_steps_recipe_id       ON steps(recipe_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status     ON sync_queue(status)`,
];
