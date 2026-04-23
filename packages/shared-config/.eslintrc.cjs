module.exports = {
  root: true,
  extends: ['@tripod-stack/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
