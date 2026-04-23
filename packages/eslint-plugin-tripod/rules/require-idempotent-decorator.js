/**
 * 特定业务域（payment / shipping / notification）的写操作必须带 @Idempotent()。
 *
 * 默认在文件路径匹配 /payment/|/shipping/|/notification/ 时才触发。
 * 通过 options.filePatterns（正则字符串数组）可以定制。
 * M2 默认 nest.js preset 开启但绝大多数文件命不中路径。
 */
const WRITE_METHODS = ['Post', 'Put', 'Patch', 'Delete'];
const DEFAULT_PATTERNS = [
  'packages/shared-payment/',
  'packages/shared-shipping/',
  'packages/shared-notification/',
  'apps/server/src/payment/',
  'apps/server/src/shipping/',
  'apps/server/src/notification/',
];

function hasDecorator(node, names) {
  if (!node.decorators) return false;
  return node.decorators.some((dec) => {
    const expr = dec.expression;
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
      return names.includes(expr.callee.name);
    }
    if (expr.type === 'Identifier') {
      return names.includes(expr.name);
    }
    return false;
  });
}

function findHttpDecoratorName(node) {
  if (!node.decorators) return null;
  for (const dec of node.decorators) {
    const expr = dec.expression;
    const name =
      expr.type === 'CallExpression' && expr.callee.type === 'Identifier'
        ? expr.callee.name
        : expr.type === 'Identifier'
          ? expr.name
          : null;
    if (name && WRITE_METHODS.includes(name)) return name;
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'payment / shipping / notification 域的写操作必须加 @Idempotent() 装饰器',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          filePatterns: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        '{{method}} {{className}}#{{methodName}} 位于 idempotency 强制域，必须加 @Idempotent() 装饰器（见 shared-contract §Idempotency 实现细节）。',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const patterns = (options.filePatterns || DEFAULT_PATTERNS).map((p) =>
      typeof p === 'string' ? p : String(p),
    );
    const filename = context.getFilename();
    const match = patterns.some((p) => filename.includes(p));
    if (!match) return {};

    return {
      ClassDeclaration(classNode) {
        if (!hasDecorator(classNode, ['Controller'])) return;

        for (const member of classNode.body.body) {
          if (member.type !== 'MethodDefinition') continue;
          if (!member.decorators) continue;

          const httpDecorator = findHttpDecoratorName(member);
          if (!httpDecorator) continue;

          if (!hasDecorator(member, ['Idempotent'])) {
            const methodName =
              member.key && member.key.type === 'Identifier' ? member.key.name : '<anon>';
            const className = classNode.id && classNode.id.name ? classNode.id.name : '<anon>';
            context.report({
              node: member,
              messageId: 'missing',
              data: {
                method: httpDecorator,
                className,
                methodName,
              },
            });
          }
        }
      },
    };
  },
};
