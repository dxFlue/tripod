/**
 * NestJS Controller 里**写操作**方法（@Post / @Put / @Patch / @Delete）必须带
 * @RequirePermission(...) 或 @Public()，不能默认"靠上游 Guard"。
 *
 * 只检查带 @Controller() 装饰器的类里、带 HTTP 方法装饰器的成员方法。
 * 读操作（@Get）不强制（只读接口很多）；但可以通过 options.methods 覆盖。
 */
const WRITE_METHODS_DEFAULT = ['Post', 'Put', 'Patch', 'Delete'];
const ALLOWED_DECORATORS_DEFAULT = ['RequirePermission', 'Public'];

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

function findDecoratorName(node) {
  if (!node.decorators) return null;
  for (const dec of node.decorators) {
    const expr = dec.expression;
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
      return expr.callee.name;
    }
    if (expr.type === 'Identifier') {
      return expr.name;
    }
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'NestJS Controller 的写操作必须显式声明 @RequirePermission 或 @Public',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          writeMethods: {
            type: 'array',
            items: { type: 'string' },
          },
          allowedDecorators: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        '{{method}} {{className}}#{{methodName}} 缺少权限装饰器。请加 @RequirePermission(...) 或显式 @Public()。',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const writeMethods = options.writeMethods || WRITE_METHODS_DEFAULT;
    const allowedDecorators = options.allowedDecorators || ALLOWED_DECORATORS_DEFAULT;

    return {
      ClassDeclaration(classNode) {
        if (!hasDecorator(classNode, ['Controller'])) return;

        for (const member of classNode.body.body) {
          if (member.type !== 'MethodDefinition') continue;
          if (!member.decorators) continue;

          const httpDecorator = findDecoratorName(member);
          if (!httpDecorator || !writeMethods.includes(httpDecorator)) continue;

          if (!hasDecorator(member, allowedDecorators)) {
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
