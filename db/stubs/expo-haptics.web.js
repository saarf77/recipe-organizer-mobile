/**
 * Web stub for expo-haptics.
 * Haptic feedback is native-only; all calls are no-ops on web.
 */
const noop = () => Promise.resolve();

const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Rigid: 'rigid',
  Soft: 'soft',
};

const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

module.exports = {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync: noop,
  notificationAsync: noop,
  selectionAsync: noop,
};
