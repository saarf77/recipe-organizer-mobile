/**
 * Typography scale — matches tailwind.config.js `theme.extend.fontFamily` and `fontSize`.
 * FontSize pairs expressed as { size, lineHeight } for use in StyleSheet.create().
 *
 * Usage:
 *   fontFamily: FontFamily.semibold
 *   fontSize: FontSize.sm.size, lineHeight: FontSize.sm.lineHeight
 */
export const FontFamily = {
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
} as const;

export const FontSize = {
  xs:    { size: 12, lineHeight: 16 },
  sm:    { size: 14, lineHeight: 20 },
  base:  { size: 16, lineHeight: 24 },
  lg:    { size: 18, lineHeight: 28 },
  xl:    { size: 20, lineHeight: 28 },
  '2xl': { size: 24, lineHeight: 32 },
  '3xl': { size: 30, lineHeight: 36 },
} as const;

export type FontFamilyKey = keyof typeof FontFamily;
export type FontSizeKey = keyof typeof FontSize;
