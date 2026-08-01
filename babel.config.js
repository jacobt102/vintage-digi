module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last. Reanimated 4 delegates worklet transformation to react-native-worklets,
    // so this single plugin covers both. (v4's react-native-worklets-core/plugin is obsolete.)
    plugins: ['react-native-worklets/plugin'],
  };
};
