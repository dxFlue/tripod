/** @type {import("prettier").Config} */
module.exports = {
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  arrowParens: 'always',
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  bracketSpacing: true,
  bracketSameLine: false,
  plugins: ['prettier-plugin-tailwindcss'],
};
