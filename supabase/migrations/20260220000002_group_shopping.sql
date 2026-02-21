-- Group shared shopping lists
-- Each group has a shared list visible and editable by all members.

CREATE TABLE IF NOT EXISTS public.group_shopping_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     TEXT,
  unit         TEXT,
  checked      BOOLEAN NOT NULL DEFAULT FALSE,
  added_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id    UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  recipe_name  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_shopping_group_id ON public.group_shopping_items(group_id);
CREATE INDEX IF NOT EXISTS idx_group_shopping_checked  ON public.group_shopping_items(checked);

-- RLS: group members can view and modify the shopping list
ALTER TABLE public.group_shopping_items ENABLE ROW LEVEL SECURITY;

-- Members can read the shopping list for their groups
CREATE POLICY "group_shopping_select" ON public.group_shopping_items
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
  );

-- Members can insert items (not viewers)
CREATE POLICY "group_shopping_insert" ON public.group_shopping_items
  FOR INSERT WITH CHECK (
    added_by = auth.uid() AND
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role != 'viewer'
    )
  );

-- Any member (not viewer) can update checked state; only adder/admin can update details
CREATE POLICY "group_shopping_update" ON public.group_shopping_items
  FOR UPDATE USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role != 'viewer'
    )
  );

-- Members (not viewers) can delete items
CREATE POLICY "group_shopping_delete" ON public.group_shopping_items
  FOR DELETE USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid() AND role != 'viewer'
    )
  );

-- Enable Realtime for live sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_shopping_items;
