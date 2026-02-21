/**
 * Rule-based recipe parsing service.
 * Zero AI tokens. Pure regex + heuristics.
 */

import { ParsedRecipe, Difficulty, Ingredient } from '@/types';

// ─── Regex Patterns ───────────────────────────────────────────────────────────

const TIME_PATTERNS = {
  prep: /prep(?:aration)?\s*(?:time)?[:\s]*(\d+)\s*(min(?:utes?)?|hr?s?|hours?)/gi,
  cook: /cook(?:ing)?\s*(?:time)?[:\s]*(\d+)\s*(min(?:utes?)?|hr?s?|hours?)/gi,
  total: /total\s*(?:time)?[:\s]*(\d+)\s*(min(?:utes?)?|hr?s?|hours?)/gi,
  stand: /stand(?:ing)?\s*(?:time)?[:\s]*(\d+)\s*(min(?:utes?)?|hr?s?|hours?)/gi,
};

const SERVINGS_PATTERN =
  /(?:serves?|servings?|yield|makes?|portions?)[:\s]*(\d+(?:\s*[-–]\s*\d+)?)/gi;

const INGREDIENT_SECTION_HEADERS = /^(?:ingredients?|what\s+you(?:'ll)?\s+need|shopping\s+list)[:.\s]*$/im;
const STEP_SECTION_HEADERS = /^(?:(?:preparation\s+)?(?:method|instructions?|directions?|steps?|how\s+to(?:\s+make)?|procedure))[:.\s]*$/im;

const NUMBERED_STEP = /^\s*(?:\d+[\.\):]|\*|-)\s+(.+)/;
const INGREDIENT_LINE =
  /^[\*\-•·]?\s*(?:(\d+(?:[\/\.,]\d+)?(?:\s+\d+\/\d+)?)\s+)?((?:cup|tbsp|tablespoon|tsp|teaspoon|oz|ounce|lb|pound|kg|g|gram|ml|liter|l|pinch|dash|handful|bunch|clove|slice|piece|can|package|pkg|head|stalk)s?\s*)?(.+)/i;

const FRACTION_MAP: Record<string, number> = {
  '½': 0.5, '⅓': 0.333, '¼': 0.25, '¾': 0.75,
  '⅔': 0.667, '⅛': 0.125, '⅜': 0.375,
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeFractions(s: string): string {
  let out = s;
  for (const [frac, val] of Object.entries(FRACTION_MAP)) {
    out = out.replace(new RegExp(frac, 'g'), String(val));
  }
  return out;
}

function toMinutes(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return value * 60;
  return value;
}

// ─── Individual Detectors ─────────────────────────────────────────────────────

export function detectTitle(text: string): string | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // First non-empty line that is not a section header
  for (const line of lines.slice(0, 5)) {
    if (
      !INGREDIENT_SECTION_HEADERS.test(line) &&
      !STEP_SECTION_HEADERS.test(line) &&
      line.length > 3 &&
      line.length < 120 &&
      !/^\d/.test(line)
    ) {
      return line.replace(/[*_#]+/g, '').trim();
    }
  }
  return null;
}

export function detectTimes(text: string): { prep: number | null; cook: number | null } {
  const result: { prep: number | null; cook: number | null } = { prep: null, cook: null };

  let match: RegExpExecArray | null;

  const prepRe = new RegExp(TIME_PATTERNS.prep.source, 'gi');
  while ((match = prepRe.exec(text)) !== null) {
    const val = parseFloat(match[1]!);
    const unit = match[2]!;
    result.prep = toMinutes(val, unit);
    break;
  }

  const cookRe = new RegExp(TIME_PATTERNS.cook.source, 'gi');
  while ((match = cookRe.exec(text)) !== null) {
    const val = parseFloat(match[1]!);
    const unit = match[2]!;
    result.cook = toMinutes(val, unit);
    break;
  }

  // Fallback: look for bare "X minutes" near top of text
  if (!result.prep && !result.cook) {
    const bareTime = /(\d+)\s*[-–]\s*(\d+)\s*min/i.exec(text);
    if (bareTime) {
      result.cook = parseInt(bareTime[2]!, 10);
    }
  }

  return result;
}

export function detectServings(text: string): number | null {
  const re = new RegExp(SERVINGS_PATTERN.source, 'gi');
  const match = re.exec(text);
  if (!match) return null;
  const raw = match[1]!;
  // Handle ranges like "4-6" — take average
  const parts = raw.split(/[-–]/).map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
    return Math.round(((parts[0] as number) + (parts[1] as number)) / 2);
  }
  const single = parseInt(raw, 10);
  return isNaN(single) ? null : single;
}

export function detectIngredientLines(text: string): Omit<Ingredient, 'id' | 'recipe_id' | 'checked'>[] {
  const lines = text.split('\n').map((l) => normalizeFractions(l.trim()));
  const results: Omit<Ingredient, 'id' | 'recipe_id' | 'checked'>[] = [];

  let inSection = false;
  let position = 0;

  for (const line of lines) {
    if (!line) continue;

    if (INGREDIENT_SECTION_HEADERS.test(line)) {
      inSection = true;
      continue;
    }
    if (STEP_SECTION_HEADERS.test(line) && inSection) {
      break; // left ingredient section
    }


    if (inSection) {
      const match = INGREDIENT_LINE.exec(line);
      if (match) {
        const qtyRaw = match[1]?.trim() ?? null;
        const unitRaw = match[2]?.trim() ?? null;
        const nameRaw = match[3]?.trim();

        if (!nameRaw || nameRaw.length < 2) continue;
        // Skip lines that look like section headers or steps
        if (STEP_SECTION_HEADERS.test(nameRaw) || INGREDIENT_SECTION_HEADERS.test(nameRaw)) continue;
        // Skip numbered step lines
        if (/^\d+[\.\)]/.test(nameRaw)) continue;

        results.push({
          name: nameRaw,
          quantity: qtyRaw,
          unit: unitRaw || null,
          position: position++,
        });
      }
    }
  }

  return results;
}

export function detectSteps(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const steps: string[] = [];

  let inSection = false;
  let currentStep = '';

  for (const line of lines) {
    if (!line) {
      if (currentStep) {
        steps.push(currentStep.trim());
        currentStep = '';
      }
      continue;
    }

    if (STEP_SECTION_HEADERS.test(line)) {
      inSection = true;
      continue;
    }

    if (!inSection) continue;

    const numbered = NUMBERED_STEP.exec(line);
    if (numbered) {
      if (currentStep) steps.push(currentStep.trim());
      currentStep = numbered[1]!;
    } else {
      currentStep += ' ' + line;
    }
  }

  if (currentStep) steps.push(currentStep.trim());

  return steps.filter((s) => s.length > 5);
}

export function estimateDifficulty(
  ingredientCount: number,
  stepCount: number,
  totalMinutes: number
): Difficulty {
  if (
    ingredientCount <= 5 &&
    stepCount <= 5 &&
    totalMinutes > 0 &&
    totalMinutes < 30
  ) {
    return 'easy';
  }
  if (ingredientCount > 12 || stepCount > 10 || totalMinutes > 90) {
    return 'hard';
  }
  return 'medium';
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseRecipeText(rawText: string): ParsedRecipe {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const title = detectTitle(text);
  const { prep, cook } = detectTimes(text);
  const servings = detectServings(text);
  const ingredients = detectIngredientLines(text);
  const steps = detectSteps(text);
  const totalMinutes = (prep ?? 0) + (cook ?? 0);
  const difficulty = estimateDifficulty(ingredients.length, steps.length, totalMinutes);

  // Simple tag extraction: cuisine keywords
  const cuisineKeywords = ['italian', 'mexican', 'chinese', 'indian', 'french', 'thai', 'japanese', 'mediterranean', 'american', 'greek'];
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  for (const kw of cuisineKeywords) {
    if (lowerText.includes(kw)) tags.push(kw);
  }

  // dietary
  if (lowerText.includes('vegan')) tags.push('vegan');
  if (lowerText.includes('vegetarian') && !tags.includes('vegan')) tags.push('vegetarian');
  if (lowerText.includes('gluten-free') || lowerText.includes('gluten free')) tags.push('gluten-free');

  return {
    title,
    description: null,
    ingredients,
    steps,
    prep_time_minutes: prep,
    cook_time_minutes: cook,
    servings,
    difficulty,
    tags,
  };
}
