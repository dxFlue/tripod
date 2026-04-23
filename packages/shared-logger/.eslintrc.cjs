module.exports = {
  root: true,
  extends: ['@tripod-stack/eslint-config/react'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['src/server/**/*.ts'],
      extends: ['@tripod-stack/eslint-config/base'],
    },
  ],
};
