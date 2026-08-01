const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The parent directory (`VSCode Projects/`) contains an unrelated express app with its own
// package.json and node_modules. Node's resolver walks upward, so anchor Metro's package
// root and file watching to this project and never let either reach the parent.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.watchFolders = [__dirname];

// NOTE: deliberately NOT setting resolver.disableHierarchicalLookup. It sounds like stronger
// protection, but it also blocks *nested* node_modules — npm places ~32 transitive deps there
// (expo-modules-core under expo, babel-preset-expo, etc.), and the bundle fails without them.
// The parent's @babel/@expo/@react-native entries were verified to be empty directories with
// no package.json, so Node skips past them regardless; there is nothing there to shadow.

module.exports = config;
