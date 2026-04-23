/**
 * 禁 default export，统一用 named export。
 * Next 特殊文件（app/page.tsx 等）由 preset override 关闭本规则。
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁用 default export，统一使用 named export',
      recommended: true,
    },
    schema: [],
    messages: {
      forbidden:
        '禁 default export。请用 named export。Next 特殊文件（app/**/page.tsx 等）在 preset override 里已放开。',
    },
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: 'forbidden' });
      },
      // export { X as default } 也拦
      ExportSpecifier(node) {
        if (node.exported && node.exported.name === 'default') {
          context.report({ node, messageId: 'forbidden' });
        }
      },
    };
  },
};
