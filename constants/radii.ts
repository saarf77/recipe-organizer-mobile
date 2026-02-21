/**
 * Border radius scale — matches tailwind.config.js `theme.extend.borderRadius`
 */
export const Radii = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
} as const;

export type RadiiKey = keyof typeof Radii;
