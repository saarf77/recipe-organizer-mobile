-- ─────────────────────────────────────────────────────────────────────────────
-- Collections table + RLS
-- Collections were previously local-only (SQLite). This migration adds the
-- Supabase backend table so they sync across devices.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  recipe_ids      JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_user_id);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections_select_own" ON collections;
DROP POLICY IF EXISTS "collections_insert_own" ON collections;
DROP POLICY IF EXISTS "collections_update_own" ON collections;
DROP POLICY IF EXISTS "collections_delete_own" ON collections;

-- Only the owner can see, create, modify, or delete their collections
CREATE POLICY "collections_select_own"
  ON collections FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "collections_insert_own"
  ON collections FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "collections_update_own"
  ON collections FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "collections_delete_own"
  ON collections FOR DELETE
  USING (owner_user_id = auth.uid());
