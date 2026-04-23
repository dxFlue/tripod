/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: process.cwd(),
    sourceType: 'module',
    ecmaVersion: 2023,
  },
  plugins: ['@typescript-eslint', 'import', 'tripod'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true },
    },
  },
  rules: {
    // G-TS 对齐
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableObject: false }],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    eqeqeq: ['error', 'always'],

    // 导入顺序
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [{ pattern: '@tripod-stack/**', group: 'internal' }],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    'import/no-default-export': 'error',
    'import/no-cycle': 'error',

    // 命名
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      {
        selector: 'variable',
        modifiers: ['const', 'global'],
        format: ['camelCase', 'UPPER_CASE'],
      },
    ],

    // Tripod 自定义
    'tripod/no-direct-prisma-client': 'error',
    'tripod/no-default-export': 'error',
    'tripod/no-barrel-import': ['error', { strictFolderPattern: true }],
    'tripod/error-code-required': 'error',
    // payment/shipping 业务规则默认 off（M2 无业务），M3 业务出现后在 apps/server/.eslintrc 显式 'error' 打开
    'tripod/require-permission-decorator': 'off',
    'tripod/require-idempotent-decorator': 'off',

    // 控制台 —— 一律禁。紧急 debug 走 logger。
    'no-console': 'error',
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        'no-console': 'off',
      },
    },
    {
      files: [
        '**/app/**/page.tsx',
        '**/app/**/layout.tsx',
        '**/app/**/loading.tsx',
        '**/app/**/error.tsx',
        '**/app/**/not-found.tsx',
        '**/app/**/template.tsx',
        '**/app/**/default.tsx',
        '**/app/**/global-error.tsx',
        '**/app/**/route.ts',
        '**/middleware.ts',
        '**/instrumentation.ts',
      ],
      rules: {
        'tripod/no-default-export': 'off',
        'import/no-default-export': 'off',
      },
    },
    {
      files: ['*.config.{js,ts,mjs,cjs}', '*.config.*.{js,ts,mjs,cjs}'],
      rules: {
        'import/no-default-export': 'off',
        'tripod/no-default-export': 'off',
      },
    },
  ],
};
