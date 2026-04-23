/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    './base',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-key': ['error', { checkFragmentShorthand: true }],
    'react/no-array-index-key': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    'react/jsx-no-leaked-render': 'error',
    'react/function-component-definition': [
      'error',
      {
        namedComponents: 'arrow-function',
        unnamedComponents: 'arrow-function',
      },
    ],
    // 禁 class component（用 hooks）；react-error-boundary 等库内部 class 不走业务代码 lint
    'react/prefer-stateless-function': ['error', { ignorePureComponents: false }],
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "ClassDeclaration[superClass.name=/^(Component|PureComponent)$/], ClassDeclaration[superClass.object.name='React'][superClass.property.name=/^(Component|PureComponent)$/]",
        message:
          '禁 class component。Tripod React 层只用函数式组件 + hooks。Error boundary 用 react-error-boundary 库。',
      },
    ],
    // React 组件：模块顶级箭头函数 const 允许 PascalCase
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'variableLike', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] },
      {
        selector: 'variable',
        modifiers: ['const', 'global'],
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      },
    ],
  },
};
