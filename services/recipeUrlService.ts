import { Platform } from 'react-native';
import { ParsedRecipe, Difficulty } from '@/types';
import { supabase } from '@/services/supabaseClient';

// ─── Schema.org types ─────────────────────────────────────────────────────────

interface SchemaRecipe {
  '@type': string | string[];
  name?: string;
  description?: string;
  recipeIngredient?: string[];
  recipeInstructions?:
    | string
    | Array<{ '@type'?: string; text?: string; name?: string } | string>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number | string[];
  recipeCuisine?: string | string[];
  recipeCategory?: string | string[];
  keywords?: string | string[];
  image?: string | { url?: string } | Array<string | { url?: string }>;
}

// ─── ISO 8601 duration → minutes ─────────────────────────────────────────────

function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const days = parseInt(m[1] ?? '0', 10);
  const hours = parseInt(m[2] ?? '0', 10);
  const mins = parseInt(m[3] ?? '0', 10);
  const total = days * 1440 + hours * 60 + mins;
  return total > 0 ? total : null;
}

// ─── Ingredient string parser ─────────────────────────────────────────────────

const UNITS = [
  'tablespoons?', 'tbsps?', 'teaspoons?', 'tsps?',
  'cups?', 'ounces?', 'oz', 'pounds?', 'lbs?', 'lb',
  'grams?', 'g', 'kilograms?', 'kg', 'milligrams?', 'mg',
  'liters?', 'l', 'milliliters?', 'ml',
  'cloves?', 'cans?', 'packages?', 'pints?', 'quarts?', 'gallons?',
  'sticks?', 'slices?', 'pieces?', 'bunches?', 'stalks?', 'sprigs?',
  'large', 'medium', 'small', 'pinch', 'pinches', 'dash', 'dashes',
].join('|');

const UNIT_RE = new RegExp(`^(${UNITS})$`, 'i');
const QTY_RE = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])/;

function parseIngredient(raw: string): { name: string; quantity: string | null; unit: string | null } {
  // Strip HTML tags and clean up
  const text = raw.replace(/<[^>]+>/g, '').trim();
  const parts = text.split(/\s+/);
  if (parts.length === 0) return { name: text, quantity: null, unit: null };

  let idx = 0;
  let quantity: string | null = null;
  let unit: string | null = null;

  // Try to grab quantity
  const qtyMatch = QTY_RE.exec(parts[0] ?? '');
  if (qtyMatch) {
    quantity = qtyMatch[1] ?? null;
    idx = 1;
    // Handle "1 1/2" style mixed numbers
    if (idx < parts.length && /^\d+\/\d+$/.test(parts[idx] ?? '')) {
      quantity = `${quantity} ${parts[idx]}`;
      idx++;
    }
  }

  // Try to grab unit
  if (idx < parts.length && UNIT_RE.test(parts[idx] ?? '')) {
    unit = parts[idx] ?? null;
    idx++;
  }

  const name = parts.slice(idx).join(' ').trim() || text;
  return { name, quantity, unit };
}

// ─── Instruction parser ───────────────────────────────────────────────────────

function parseInstructions(
  instructions: SchemaRecipe['recipeInstructions'],
): string[] {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    // Some sites return a single block of text
    return instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(instructions)) {
    const steps: string[] = [];
    for (const item of instructions) {
      if (typeof item === 'string') {
        steps.push(item.trim());
      } else if (item && typeof item === 'object') {
        const text = item.text ?? item.name;
        if (text) steps.push(text.trim());
      }
    }
    return steps.filter(Boolean);
  }
  return [];
}

// ─── Yield → servings ─────────────────────────────────────────────────────────

function parseYield(raw?: string | number | string[]): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const str = Array.isArray(raw) ? raw[0] ?? '' : raw;
  const m = str.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// ─── Keywords → tags ──────────────────────────────────────────────────────────

function parseKeywords(raw?: string | string[]): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(/[,;]/);
  return list.map((k) => k.trim()).filter(Boolean).slice(0, 8);
}

// ─── JSON-LD extractor ────────────────────────────────────────────────────────

function isRecipeType(t: unknown): boolean {
  if (typeof t === 'string') return t.toLowerCase().includes('recipe');
  if (Array.isArray(t)) return t.some(isRecipeType);
  return false;
}

function extractSchemasFromHtml(html: string): SchemaRecipe[] {
  const results: SchemaRecipe[] = [];
  // Match all JSON-LD script blocks
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]!);
      const nodes: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        // Handle @graph wrappers
        const graph = (node as Record<string, unknown>)['@graph'];
        if (Array.isArray(graph)) {
          for (const n of graph) {
            if (n && typeof n === 'object' && isRecipeType((n as Record<string, unknown>)['@type'])) {
              results.push(n as SchemaRecipe);
            }
          }
        } else if (isRecipeType((node as Record<string, unknown>)['@type'])) {
          results.push(node as SchemaRecipe);
        }
      }
    } catch {
      // Skip malformed JSON
    }
  }
  return results;
}

// ─── Difficulty heuristic ─────────────────────────────────────────────────────

function guessDifficulty(
  prepMins: number | null,
  cookMins: number | null,
  steps: number,
): Difficulty {
  const total = (prepMins ?? 0) + (cookMins ?? 0);
  if (total > 90 || steps > 12) return 'hard';
  if (total > 30 || steps > 6) return 'medium';
  return 'easy';
}

// ─── Web fetch strategy: Edge Function → CORS proxy fallback ─────────────────

async function fetchViaEdgeFunction(url: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('fetch-recipe-url', {
    body: { url },
  });
  if (error) throw new Error(`edge_function_unavailable`);
  if (data?.error) throw new Error(data.error as string);
  if (!data?.html) throw new Error(`edge_function_unavailable`);
  return data.html as string;
}

async function fetchViaProxy(url: string): Promise<string> {
  // Proxy 1: corsproxy.io — returns raw HTML directly
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 500) return text;
    }
  } catch { /* fall through */ }

  // Proxy 2: allorigins.win — returns { contents: html }
  try {
    const res2 = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (res2.ok) {
      const body = (await res2.json()) as { contents?: string; status?: { http_code?: number } };
      if ((body.status?.http_code ?? 200) < 400 && (body.contents?.length ?? 0) > 500) {
        return body.contents!;
      }
    }
  } catch { /* fall through */ }

  throw new Error(
    'Could not fetch the recipe page.\n\nThis site may be blocking imports. Try deploying the Supabase Edge Function, or use the mobile app where this works without restrictions.',
  );
}

async function fetchHtmlForWeb(url: string): Promise<string> {
  // Try our own server-side Edge Function first (most reliable, bypasses bot protection)
  try {
    return await fetchViaEdgeFunction(url);
  } catch (e: unknown) {
    if (e instanceof Error && e.message !== 'edge_function_unavailable') throw e;
    // Edge function not deployed — fall back to public CORS proxies
  }
  return fetchViaProxy(url);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function parseImageUrl(image?: SchemaRecipe['image']): string | null {
  if (!image) return null;
  if (typeof image === 'string') return image.startsWith('http') ? image : null;
  if (Array.isArray(image)) {
    for (const item of image) {
      const u = typeof item === 'string' ? item : (item as { url?: string }).url;
      if (u && u.startsWith('http')) return u;
    }
    return null;
  }
  return (image as { url?: string }).url ?? null;
}

export interface UrlImportResult extends ParsedRecipe {
  source_url: string;
  cuisine: string | null;
  cover_image_url: string | null;
  category: string | null;
}

export async function extractRecipeFromUrl(url: string): Promise<UrlImportResult> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Please enter a valid URL (e.g. https://www.example.com/recipe)');
  }

  let html: string;
  try {
    if (Platform.OS === 'web') {
      html = await fetchHtmlForWeb(url);
    } else {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Page returned ${res.status}. Check the URL.`);
      html = await res.text();
    }
  } catch (e: unknown) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error('Request timed out. The site may be slow or blocking imports.');
    }
    // Re-throw all already-formatted Error messages
    if (e instanceof Error) throw e;
    throw new Error('Could not reach the page. Check your internet connection.');
  }

  const schemas = extractSchemasFromHtml(html);
  if (schemas.length === 0) {
    throw new Error(
      "No structured recipe data found on this page.\n\nThis site doesn't embed machine-readable recipe data. Try a different site.",
    );
  }

  const s = schemas[0]!;

  const ingredients = (s.recipeIngredient ?? []).map(parseIngredient);
  const steps = parseInstructions(s.recipeInstructions);
  const prepMins = parseDuration(s.prepTime);
  const cookMins = parseDuration(s.cookTime) ?? parseDuration(s.totalTime);

  const categoryRaw = s.recipeCategory;
  const category = Array.isArray(categoryRaw)
    ? (categoryRaw[0] ?? null)
    : (categoryRaw ?? null);

  const cuisineRaw = s.recipeCuisine;
  const cuisine = Array.isArray(cuisineRaw)
    ? (cuisineRaw[0] ?? null)
    : (cuisineRaw ?? null);

  return {
    source_url: url,
    title: s.name ?? null,
    description: s.description
      ? s.description.replace(/<[^>]+>/g, '').trim()
      : null,
    ingredients,
    steps,
    prep_time_minutes: prepMins,
    cook_time_minutes: cookMins,
    servings: parseYield(s.recipeYield),
    difficulty: guessDifficulty(prepMins, cookMins, steps.length),
    tags: parseKeywords(s.keywords),
    category: category,
    cuisine: cuisine,
    cover_image_url: parseImageUrl(s.image),
  };
}
