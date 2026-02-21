/**
 * Display-time unit conversion utility.
 * Converts ingredient quantities to the user's preferred unit system for display.
 * The stored data is never mutated.
 */

import { COOKING_UNITS, convertQuantity, findUnit } from '@/components/UnitPickerModal';
import type { UnitSystem } from '@/features/settings/settingsStore';

// ─── Unit system membership ───────────────────────────────────────────────────

const METRIC_UNITS = new Set(['ml', 'milliliter', 'l', 'liter', 'g', 'gram', 'kg', 'kilogram']);
const IMPERIAL_UNITS = new Set([
  'tsp', 'teaspoon', 'tbsp', 'tablespoon', 'fl oz', 'fluid oz',
  'cup', 'pt', 'pint', 'qt', 'quart',
  'oz', 'ounce', 'lb', 'pound',
]);

function isMetric(unitAbbr: string): boolean {
  return METRIC_UNITS.has(unitAbbr.toLowerCase());
}

function isImperial(unitAbbr: string): boolean {
  return IMPERIAL_UNITS.has(unitAbbr.toLowerCase());
}

// ─── Target unit selection ────────────────────────────────────────────────────

/**
 * Given a value in base units (ml or g) and a target system,
 * pick the most human-friendly target unit.
 */
function pickVolumeImperial(valueMl: number): string {
  if (valueMl < 5) return 'tsp';
  if (valueMl < 15) return 'tbsp';
  if (valueMl < 60) return 'fl oz';
  if (valueMl < 474) return 'cup';
  return 'pt';
}

function pickVolumeMetric(valueMl: number): string {
  return valueMl >= 1000 ? 'L' : 'ml';
}

function pickWeightImperial(valueG: number): string {
  return valueG < 500 ? 'oz' : 'lb';
}

function pickWeightMetric(valueG: number): string {
  return valueG >= 1000 ? 'kg' : 'g';
}

// ─── Main conversion ──────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n <= 0) return parseFloat(n.toFixed(2)).toString();
  // Round to a clean number of significant figures
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return parseFloat(n.toFixed(1)).toString();
  if (n >= 1) return parseFloat(n.toFixed(1)).toString();
  // Small values: round to 2 sig figs
  return parseFloat(n.toPrecision(2)).toString();
}

/**
 * Convert a quantity+unit pair for display in the given unit system.
 * Returns the (possibly converted) quantity and unit strings.
 * If the unit is already in the target system, or is count/other, returns inputs unchanged.
 */
export function convertForDisplay(
  quantity: string | null,
  unit: string | null,
  targetSystem: UnitSystem,
): { quantity: string | null; unit: string | null } {
  if (!unit || !quantity) return { quantity, unit };

  const cookingUnit = findUnit(unit);
  if (!cookingUnit) return { quantity, unit };

  // Count and other units don't convert
  if (cookingUnit.category === 'count' || cookingUnit.category === 'other') {
    return { quantity, unit };
  }

  const normalizedUnit = (cookingUnit.abbr || cookingUnit.label).toLowerCase();
  const alreadyMetric = isMetric(normalizedUnit);
  const alreadyImperial = isImperial(normalizedUnit);

  // No conversion needed
  if (targetSystem === 'metric' && alreadyMetric) return { quantity, unit };
  if (targetSystem === 'imperial' && alreadyImperial) return { quantity, unit };

  const numericQty = parseFloat(quantity);
  if (isNaN(numericQty) || numericQty <= 0) return { quantity, unit };

  // Convert to base unit first (ml or g)
  const baseValue = numericQty * cookingUnit.toBase;

  let targetAbbr: string;
  if (cookingUnit.category === 'volume') {
    targetAbbr = targetSystem === 'imperial'
      ? pickVolumeImperial(baseValue)
      : pickVolumeMetric(baseValue);
  } else {
    // weight
    targetAbbr = targetSystem === 'imperial'
      ? pickWeightImperial(baseValue)
      : pickWeightMetric(baseValue);
  }

  const targetUnit = COOKING_UNITS.find((u) => u.abbr === targetAbbr || u.label === targetAbbr);
  if (!targetUnit) return { quantity, unit };

  const converted = convertQuantity(numericQty, cookingUnit, targetUnit);
  if (converted === null) return { quantity, unit };

  return {
    quantity: fmt(converted),
    unit: targetUnit.abbr || targetUnit.label,
  };
}
