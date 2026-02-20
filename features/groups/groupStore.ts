import { create } from 'zustand';
import { Group, EditingMode } from '@/types';
import { supabase } from '@/services/supabaseClient';
import { getDatabase } from '@/db/client';
import { v4 as uuidv4 } from 'uuid';

interface GroupStore {
  groups: Group[];
  isLoading: boolean;
  loadAll: () => Promise<void>;
  createGroup: (data: { name: string; editing_mode: EditingMode }) => Promise<Group>;
  updateGroup: (id: string, data: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, role, groups(*)')
        .eq('user_id', session.user.id);

      if (!memberships) return;

      const groups: Group[] = memberships.map((m) => {
        const g = m.groups as unknown as Group;
        return { ...g, my_role: m.role as Group['my_role'] };
      });

      // Also cache in SQLite
      const db = await getDatabase();
      for (const g of groups) {
        await db.runAsync(
          'INSERT OR REPLACE INTO groups (id, name, editing_mode, created_by, created_at) VALUES (?,?,?,?,?)',
          [g.id, g.name, g.editing_mode, g.created_by, g.created_at]
        );
      }

      set({ groups });
    } finally {
      set({ isLoading: false });
    }
  },

  createGroup: async (data) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const id = uuidv4();
    const now = new Date().toISOString();

    const { error } = await supabase.from('groups').insert({
      id,
      name: data.name,
      editing_mode: data.editing_mode,
      created_by: session.user.id,
      created_at: now,
    });
    if (error) throw error;

    await supabase.from('group_members').insert({
      group_id: id,
      user_id: session.user.id,
      role: 'owner',
      joined_at: now,
    });

    const newGroup: Group = {
      id,
      name: data.name,
      editing_mode: data.editing_mode,
      created_by: session.user.id,
      created_at: now,
      my_role: 'owner',
      member_count: 1,
    };

    set((state) => ({ groups: [newGroup, ...state.groups] }));
    return newGroup;
  },

  updateGroup: async (id, data) => {
    const { error } = await supabase.from('groups').update(data).eq('id', id);
    if (error) throw error;
    set((state) => ({
      groups: state.groups.map((g) => g.id === id ? { ...g, ...data } : g),
    }));
  },

  deleteGroup: async (id) => {
    await supabase.from('groups').delete().eq('id', id);
    set((state) => ({ groups: state.groups.filter((g) => g.id !== id) }));
  },
}));
