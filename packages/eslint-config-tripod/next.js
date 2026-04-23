/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./react', 'next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'error',
  },
};
