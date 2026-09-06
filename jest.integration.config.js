// Integration tests run in plain Node with real networking (the React Native
// preset stubs fetch). React Native pieces the data layer touches are mocked.
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo/virtual/env$': '<rootDir>/tests/mocks/expo-env.js',
    '^react-native$': '<rootDir>/tests/mocks/react-native.js',
    '^react-native-url-polyfill/auto$': '<rootDir>/tests/mocks/noop.js',
    '^@react-native-community/netinfo$': '<rootDir>/tests/mocks/noop.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
  setupFiles: ['<rootDir>/tests/setup.integration.js'],
};
