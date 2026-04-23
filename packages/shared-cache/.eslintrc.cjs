module.exports = {
  root: true,
  extends: ['@tripod-stack/eslint-config/nest'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
