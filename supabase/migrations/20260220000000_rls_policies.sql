-- ─────────────────────────────────────────────────────────────────────────────
-- RLS Policies for Recipe Organizer
--
-- Run this in your Supabase project via:
--   supabase db push
-- or paste directly into the Supabase SQL editor.
--
-- Tables covered: profiles, recipes, ingredients, steps, recipe_images,
--                 groups, group_members
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. PROFILES ──────────────────────────────────────────────────────────────
-- Users can read their own profile, and any profile that belongs to someone in
-- a group they are also a member of (needed to show member names in the Groups
-- screen).  Only the owner can update / delete their own row.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"          ON profiles;
DROP POLICY IF EXISTS "profiles_select_group_members" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own"           ON profiles;

-- Read own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Read fellow group-members' profiles
CREATE POLICY "profiles_select_group_members"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT gm2.user_id
      FROM   group_members gm1
      JOIN   group_members gm2 ON gm2.group_id = gm1.group_id
      WHERE  gm1.user_id = auth.uid()
    )
  );

-- Insert (auto-created on first sign-in by the app)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update own profile (display_name, avatar_url)
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Delete own account data
CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  USING (auth.uid() = id);


-- ─── 2. GROUPS ────────────────────────────────────────────────────────────────
-- Any authenticated member of a group can read it.
-- Only the group creator (owner role) can update or delete it.

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_select_members" ON groups;
DROP POLICY IF EXISTS "groups_insert_owner"   ON groups;
DROP POLICY IF EXISTS "groups_update_owner"   ON groups;
DROP POLICY IF EXISTS "groups_delete_owner"   ON groups;

-- Members can read groups they belong to
CREATE POLICY "groups_select_members"
  ON groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

-- Any authenticated user can create a group (they are added as owner separately)
CREATE POLICY "groups_insert_owner"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only owner / admin can edit group metadata
CREATE POLICY "groups_update_owner"
  ON groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE  user_id = auth.uid()
      AND    role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT group_id FROM group_members
      WHERE  user_id = auth.uid()
      AND    role IN ('owner', 'admin')
    )
  );

-- Only owner can delete group
CREATE POLICY "groups_delete_owner"
  ON groups FOR DELETE
  USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE  user_id = auth.uid()
      AND    role = 'owner'
    )
  );


-- ─── 3. GROUP_MEMBERS ─────────────────────────────────────────────────────────
-- Members can see other members in their groups.
-- Owner/admin can add or remove members.  A member can remove themselves.
--
-- NOTE: The select policy previously caused infinite recursion because it
-- queried group_members from within a group_members policy.  The fix is a
-- SECURITY DEFINER helper function that bypasses RLS when checking membership.

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_select" ON group_members;
DROP POLICY IF EXISTS "group_members_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_update" ON group_members;
DROP POLICY IF EXISTS "group_members_delete" ON group_members;

-- Helper: returns the group_ids the current user belongs to (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_user_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid();
$$;

-- Helper: returns true if the current user is owner/admin of the given group
CREATE OR REPLACE FUNCTION auth_user_is_group_admin(gid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = gid
    AND   user_id  = auth.uid()
    AND   role IN ('owner', 'admin')
  );
$$;

-- Members see all rows for groups they belong to
CREATE POLICY "group_members_select"
  ON group_members FOR SELECT
  USING (group_id IN (SELECT auth_user_group_ids()));

-- Owner/admin can add members; a user can always add themselves (group creation)
CREATE POLICY "group_members_insert"
  ON group_members FOR INSERT
  WITH CHECK (
    (user_id = auth.uid())
    OR auth_user_is_group_admin(group_id)
  );

-- Owner/admin can change roles
CREATE POLICY "group_members_update"
  ON group_members FOR UPDATE
  USING  (auth_user_is_group_admin(group_id))
  WITH CHECK (auth_user_is_group_admin(group_id));

-- Owner/admin can remove anyone; a member can remove themselves (leave group)
CREATE POLICY "group_members_delete"
  ON group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth_user_is_group_admin(group_id)
  );


-- ─── 4. RECIPES ───────────────────────────────────────────────────────────────
-- Private recipe  (group_id IS NULL): only the owner can read/write.
-- Group recipe    (group_id IS NOT NULL): all group members can read.
--   - strict mode  → only owner/admin can UPDATE/DELETE
--   - collaborative → any member can UPDATE/DELETE
-- The editing_mode check is embedded so we don't need a separate function.

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes_select"           ON recipes;
DROP POLICY IF EXISTS "recipes_insert_owner"     ON recipes;
DROP POLICY IF EXISTS "recipes_update"           ON recipes;
DROP POLICY IF EXISTS "recipes_delete"           ON recipes;

-- SELECT: own private recipes + any group recipe for groups you are in
CREATE POLICY "recipes_select"
  ON recipes FOR SELECT
  USING (
    -- private recipe, owned by me
    (group_id IS NULL AND owner_user_id = auth.uid())
    OR
    -- group recipe and I am a member
    (
      group_id IS NOT NULL
      AND group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: any authenticated user can create a recipe they own
CREATE POLICY "recipes_insert_owner"
  ON recipes FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- UPDATE:
--   private → only owner
--   group strict → owner/admin only
--   group collaborative → any member
CREATE POLICY "recipes_update"
  ON recipes FOR UPDATE
  USING (
    -- private: owner only
    (group_id IS NULL AND owner_user_id = auth.uid())
    OR
    -- group strict: owner or admin of the group
    (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM groups g
        JOIN   group_members gm ON gm.group_id = g.id
        WHERE  g.id = recipes.group_id
        AND    gm.user_id = auth.uid()
        AND    (
          g.editing_mode = 'collaborative'
          OR gm.role IN ('owner', 'admin')
        )
      )
    )
  )
  WITH CHECK (
    (group_id IS NULL AND owner_user_id = auth.uid())
    OR
    (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM groups g
        JOIN   group_members gm ON gm.group_id = g.id
        WHERE  g.id = recipes.group_id
        AND    gm.user_id = auth.uid()
        AND    (
          g.editing_mode = 'collaborative'
          OR gm.role IN ('owner', 'admin')
        )
      )
    )
  );

-- DELETE: same rules as UPDATE
CREATE POLICY "recipes_delete"
  ON recipes FOR DELETE
  USING (
    (group_id IS NULL AND owner_user_id = auth.uid())
    OR
    (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM groups g
        JOIN   group_members gm ON gm.group_id = g.id
        WHERE  g.id = recipes.group_id
        AND    gm.user_id = auth.uid()
        AND    (
          g.editing_mode = 'collaborative'
          OR gm.role IN ('owner', 'admin')
        )
      )
    )
  );


-- ─── 5. INGREDIENTS ───────────────────────────────────────────────────────────
-- Inherit access from the parent recipe.

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredients_select" ON ingredients;
DROP POLICY IF EXISTS "ingredients_insert" ON ingredients;
DROP POLICY IF EXISTS "ingredients_update" ON ingredients;
DROP POLICY IF EXISTS "ingredients_delete" ON ingredients;

CREATE POLICY "ingredients_select"
  ON ingredients FOR SELECT
  USING (
    recipe_id IN (SELECT id FROM recipes)  -- relies on recipes RLS already filtering
  );

CREATE POLICY "ingredients_insert"
  ON ingredients FOR INSERT
  WITH CHECK (
    recipe_id IN (SELECT id FROM recipes)
  );

CREATE POLICY "ingredients_update"
  ON ingredients FOR UPDATE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );

CREATE POLICY "ingredients_delete"
  ON ingredients FOR DELETE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );


-- ─── 6. STEPS ─────────────────────────────────────────────────────────────────
-- Identical access rules to ingredients.

ALTER TABLE steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "steps_select" ON steps;
DROP POLICY IF EXISTS "steps_insert" ON steps;
DROP POLICY IF EXISTS "steps_update" ON steps;
DROP POLICY IF EXISTS "steps_delete" ON steps;

CREATE POLICY "steps_select"
  ON steps FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes));

CREATE POLICY "steps_insert"
  ON steps FOR INSERT
  WITH CHECK (recipe_id IN (SELECT id FROM recipes));

CREATE POLICY "steps_update"
  ON steps FOR UPDATE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );

CREATE POLICY "steps_delete"
  ON steps FOR DELETE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );


-- ─── 7. RECIPE_IMAGES ─────────────────────────────────────────────────────────
-- Same access rules as ingredients / steps.

ALTER TABLE recipe_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_images_select" ON recipe_images;
DROP POLICY IF EXISTS "recipe_images_insert" ON recipe_images;
DROP POLICY IF EXISTS "recipe_images_update" ON recipe_images;
DROP POLICY IF EXISTS "recipe_images_delete" ON recipe_images;

CREATE POLICY "recipe_images_select"
  ON recipe_images FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes));

CREATE POLICY "recipe_images_insert"
  ON recipe_images FOR INSERT
  WITH CHECK (recipe_id IN (SELECT id FROM recipes));

CREATE POLICY "recipe_images_update"
  ON recipe_images FOR UPDATE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  )
  WITH CHECK (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );

CREATE POLICY "recipe_images_delete"
  ON recipe_images FOR DELETE
  USING (
    recipe_id IN (
      SELECT r.id FROM recipes r
      WHERE
        (r.group_id IS NULL AND r.owner_user_id = auth.uid())
        OR (
          r.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            JOIN   group_members gm ON gm.group_id = g.id
            WHERE  g.id = r.group_id
            AND    gm.user_id = auth.uid()
            AND    (g.editing_mode = 'collaborative' OR gm.role IN ('owner', 'admin'))
          )
        )
    )
  );


-- ─── 8. STORAGE BUCKET POLICIES ───────────────────────────────────────────────
-- The app stores recipe photos in a bucket called "recipe-images".
-- Authenticated users can upload their own files; anyone can read (public CDN).
-- Only the uploader (owner_user_id prefix) can delete.
--
-- NOTE: Storage policies live under Storage → Policies in the Supabase dashboard,
-- not in this SQL file.  Use the dashboard or `supabase storage` CLI commands.
-- The rules you want are:
--
--  SELECT (read):  (bucket_id = 'recipe-images')
--  INSERT (upload): (bucket_id = 'recipe-images' AND auth.role() = 'authenticated')
--  DELETE:          (bucket_id = 'recipe-images' AND owner = auth.uid()::text)
