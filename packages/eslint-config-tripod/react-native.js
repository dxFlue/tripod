/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./react', 'plugin:react-native/all', 'plugin:tailwindcss/recommended'],
  plugins: ['react-native', 'tailwindcss'],
  rules: {
    'react-native/no-inline-styles': 'error',
    'react-native/no-color-literals': 'error',
    'react-native/no-raw-text': 'off',
    'react-native/sort-styles': 'off',
  },
};
