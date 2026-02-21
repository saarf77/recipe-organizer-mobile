/**
 * Reusable shadow styles — named to match tailwind.config.js `theme.extend.boxShadow`.
 * Translates CSS box-shadow to React Native shadow props + Android elevation.
 *
 * Usage:
 *   const styles = StyleSheet.create({
 *     card: { ...Shadows.card, backgroundColor: Colors.bgWhite }
 *   });
 */
import { Platform } from 'react-native';

export const Shadows = {
  /** Subtle lift for cards and list items. */
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }) as object,

  /** Stronger lift for modals and elevated surfaces. */
  elevated: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 6 },
    default: {},
  }) as object,

  /** Brand-tinted shadow for primary CTAs and FAB. */
  primary: Platform.select({
    ios: {
      shadowColor: '#386641',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    android: { elevation: 6 },
    default: {},
  }) as object,
} as const;
