/**
 * 禁止直接使用 PrismaClient。
 * 禁 `new PrismaClient()` 和 `import { PrismaClient } from '@prisma/client'`。
 * 例外：`packages/shared-prisma/` 内部（封装层需要直接用）。
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止直接使用 PrismaClient，必须通过 PrismaService 获取实例',
      recommended: true,
    },
    schema: [],
    messages: {
      forbiddenNew: '禁止直接 new PrismaClient()。请通过 @Inject() PrismaService 获取实例。',
      forbiddenImport:
        '禁止从 @prisma/client 导入 PrismaClient。请使用 @tripod-stack/shared-prisma 的 PrismaService。',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (filename.includes('packages/shared-prisma/')) return {};

    return {
      NewExpression(node) {
        if (
          node.callee &&
          node.callee.type === 'Identifier' &&
          node.callee.name === 'PrismaClient'
        ) {
          context.report({ node, messageId: 'forbiddenNew' });
        }
      },
      ImportDeclaration(node) {
        if (node.source && node.source.value === '@prisma/client') {
          for (const spec of node.specifiers) {
            if (
              spec.type === 'ImportSpecifier' &&
              spec.imported &&
              spec.imported.name === 'PrismaClient'
            ) {
              context.report({ node: spec, messageId: 'forbiddenImport' });
            }
          }
        }
      },
    };
  },
};
