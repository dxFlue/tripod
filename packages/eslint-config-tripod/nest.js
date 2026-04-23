/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base'],
  rules: {
    'tripod/require-permission-decorator': 'error',
    'tripod/require-idempotent-decorator': 'error',
    '@typescript-eslint/parameter-properties': ['error', { prefer: 'parameter-property' }],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],
    // 装饰器工厂允许 PascalCase（@Idempotent() / @SchedulerJob() / @Cacheable() 等）
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'function', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      {
        selector: 'variable',
        modifiers: ['const', 'global'],
        format: ['camelCase', 'UPPER_CASE'],
      },
    ],
  },
};
