const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  preset: 'jest-expo',
  // Lucide's per-icon native exports are ESM; use Expo's existing Babel options.
  transform: { '\\.mjs$': expoPreset.transform['\\.[jt]sx?$'] },
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native))',
  ],
};
