// ─── Enums ───────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GroupRole = 'owner' | 'admin' | 'member' | 'viewer';
export type EditingMode = 'strict' | 'collaborative';
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'pending' | 'in_progress' | 'failed' | 'done';

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Ingredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  position: number;
  checked?: boolean; // local UI state
}

export interface Step {
  id: string;
  recipe_id: string;
  instruction: string;
  position: number;
  completed?: boolean; // local UI state
}

export interface RecipeImage {
  id: string;
  recipe_id: string;
  storage_path: string;
  local_uri?: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  group_id: string | null;
  owner_user_id: string;
  created_by: string;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  cuisine: string | null;
  category: string | null;
  is_favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  updated_by: string;
  // relations (populated on fetch)
  ingredients?: Ingredient[];
  steps?: Step[];
  images?: RecipeImage[];
}

export interface Group {
  id: string;
  name: string;
  editing_mode: EditingMode;
  created_by: string;
  created_at: string;
  // local
  member_count?: number;
  my_role?: GroupRole;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  profile?: Profile;
}

export interface Collection {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  recipe_ids: string[];
  created_at: string;
  updated_at: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  payload: string; // JSON string
  status: SyncStatus;
  retry_count: number;
  created_at: string;
  last_attempted_at: string | null;
  error: string | null;
}

export interface SyncConflict {
  id: string;
  table_name: string;
  record_id: string;
  local_data: string;
  remote_data: string;
  resolved_at: string | null;
  created_at: string;
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

export interface OCRResult {
  raw_text: string;
  confidence: number;
  source: 'camera' | 'gallery' | 'screenshot';
}

export interface ParsedRecipe {
  title: string | null;
  description: string | null;
  ingredients: Array<{ name: string; quantity: string | null; unit: string | null }>;
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  difficulty: Difficulty;
  tags: string[];
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  '(tabs)': undefined;
  'auth/login': undefined;
  'auth/callback': undefined;
  'recipe/[id]': { id: string };
  'recipe/new': { parsed?: string; fromOCR?: boolean };
  'recipe/edit/[id]': { id: string };
  'ocr/review': { imageUri: string };
  'group/[id]': { id: string };
  'group/new': undefined;
  'collection/[id]': { id: string };
};

// ─── Store Slices ─────────────────────────────────────────────────────────────

export interface AuthState {
  user: Profile | null;
  session: string | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export interface RecipeFilters {
  search: string;
  category: string | null;
  tags: string[];
  difficulty: Difficulty | null;
  is_favorite: boolean;
  group_id: string | null;
}
