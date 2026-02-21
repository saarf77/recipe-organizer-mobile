/**
 * App color palette — Earthy Green
 * Source: https://coolors.co/386641-6a994e-a7c957-f2e8cf-bc4749
 */

export const Colors = {
  // ── Brand / Primary ────────────────────────────────────────────────
  primary:        '#386641',   // Hunter Green  — buttons, active icons, links
  primaryMid:     '#6a994e',   // Sage Green    — secondary buttons, hover
  primaryLight:   '#a7c957',   // Yellow Green  — highlights, tags, badges
  primaryBg:      '#f2e8cf',   // Vanilla Cream — card backgrounds, tinted surfaces
  primaryBgLight: '#faf6ee',   // Very light cream — page/section backgrounds

  // Tint borders / outlines derived from palette
  primaryBorder:  '#c8dea0',   // muted yellow-green
  primaryBgBorder:'#e0d4b0',   // warm cream border

  // ── Danger / Destructive ───────────────────────────────────────────
  danger:         '#bc4749',   // Blushed Brick — delete, error states
  dangerBg:       '#fdf0f0',   // very light brick tint
  dangerBorder:   '#e8a8a9',   // light brick border
  dangerMuted:    '#d4888a',   // muted danger for icons
  errorDark:      '#dc2626',   // stronger error for form validation states

  // ── Neutrals (slate/gray scale) ───────────────────────────────────
  textPrimary:    '#0f172a',
  textSecondary:  '#475569',
  textMuted:      '#6b7280',
  textSlate:      '#64748b',   // slate-500 — subtitles, meta text
  textFaint:      '#94a3b8',   // slate-400 — placeholder, disabled text

  bgWhite:        '#ffffff',
  bgSurface:      '#f8fafc',
  bgMuted:        '#f1f5f9',

  border:         '#e2e8f0',
  borderStrong:   '#cbd5e1',

  // ── Semantic ───────────────────────────────────────────────────────
  success:        '#386641',   // reuse hunter green for success
  warning:        '#a7c957',   // yellow-green as warning
  error:          '#bc4749',   // blushed brick for errors
  info:           '#6a994e',   // sage green for info

  // ── Accent / Feature-specific ─────────────────────────────────────
  privateGreen:   '#22c55e',   // "Private" badge, step-complete indicator
  ai:             '#6a994e',   // AI generate feature — sage green
  swipeEdit:      '#3b82f6',   // swipe-to-edit action button
  categoryBlue:   '#0284c7',   // category badge
  cuisinePurple:  '#9333ea',   // cuisine badge

  // ── Dark mode / Cooking mode surfaces ─────────────────────────────
  bgDark:         '#0f172a',   // deep dark background (matches textPrimary)
  bgDarkSurface:  '#1e293b',   // elevated surface in dark mode
  bgDarkBorder:   '#334155',   // border in dark mode
} as const;

export type ColorKey = keyof typeof Colors;

/**
 * Difficulty level colors — standardized on brand palette.
 * Use instead of defining local DIFFICULTY_COLORS in individual components.
 */
export const DifficultyColors: Record<'easy' | 'medium' | 'hard', string> = {
  easy:   Colors.primary,     // '#386641' Hunter Green
  medium: Colors.primaryMid,  // '#6a994e' Sage Green
  hard:   Colors.danger,      // '#bc4749' Blushed Brick
} as const;
