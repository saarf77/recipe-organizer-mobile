/**
 * Dietary tag display map — emoji, text color, and background color per tag.
 * These are intentional semantic colors (not brand tokens) chosen to visually
 * distinguish dietary categories at a glance.
 */
export const DietaryTagMap: Record<string, { emoji: string; color: string; bg: string }> = {
  vegan:        { emoji: '🌱', color: '#16a34a', bg: '#f0fdf4' },
  vegetarian:   { emoji: '🥦', color: '#15803d', bg: '#f0fdf4' },
  'gluten-free':{ emoji: '🌾', color: '#b45309', bg: '#fffbeb' },
  'dairy-free': { emoji: '🥛', color: '#0369a1', bg: '#f0f9ff' },
  keto:         { emoji: '🥩', color: '#b91c1c', bg: '#fdf0f0' },
  paleo:        { emoji: '🦴', color: '#92400e', bg: '#fefce8' },
} as const;
