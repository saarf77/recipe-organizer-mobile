const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Resolve native-only modules to web stubs when bundling for web
const webStubs = {
  'expo-sqlite': path.resolve(__dirname, 'db/stubs/expo-sqlite.web.js'),
  'expo-file-system': path.resolve(__dirname, 'db/stubs/expo-file-system.web.js'),
  'expo-haptics': path.resolve(__dirname, 'db/stubs/expo-haptics.web.js'),
};

const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return { type: 'sourceFile', filePath: webStubs[moduleName] };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
