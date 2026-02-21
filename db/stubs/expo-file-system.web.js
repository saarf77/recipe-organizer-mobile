/**
 * Web stub for expo-file-system.
 * expo-file-system is native-only; local file URIs don't exist on web.
 * serverOCR is never reachable on web (no camera/gallery file URIs).
 */
const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};

module.exports = {
  EncodingType,
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => {},
  deleteAsync: async () => {},
  getInfoAsync: async () => ({ exists: false, isDirectory: false, uri: '', size: 0, modificationTime: 0 }),
  makeDirectoryAsync: async () => {},
  copyAsync: async () => {},
  moveAsync: async () => {},
  documentDirectory: null,
  cacheDirectory: null,
};
