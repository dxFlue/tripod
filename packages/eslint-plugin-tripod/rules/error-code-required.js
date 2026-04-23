/**
 * 抛 BusinessException 时，必须第一参数是错误码（标识符引用，如 ORDER_INVALID_STATE），
 * 不允许裸字符串或纯模板。目的：所有业务错误都落进错误码枚举，保证 4 语言翻译 + 前端
 * 401 自动退登 / 429 重试等 code 驱动分支能命中。
 *
 * 限制：AST 静态分析，无法解析"通过 import 的常量是否来自错误码枚举"；本规则做"弱约束"：
 *   - throw new BusinessException('...')   → 错（字符串字面量）
 *   - throw new BusinessException(\`...\`)  → 错（模板字符串）
 *   - throw new BusinessException(X)       → 过（假定 X 是错误码枚举；真正的语义校验由
 *                                             类型系统在 shared-contract 里约束签名保证）
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'BusinessException 第一参数必须是错误码标识符，禁字符串字面量',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          exceptionNames: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      literalForbidden:
        '{{className}} 第一参数必须是错误码标识符（如 ORDER_INVALID_STATE），不能是字符串字面量或模板字符串。',
      missingArg: '{{className}} 必须至少传一个错误码参数。',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const exceptionNames = new Set(options.exceptionNames || ['BusinessException']);

    function check(node) {
      if (!node.callee || node.callee.type !== 'Identifier') return;
      if (!exceptionNames.has(node.callee.name)) return;

      const first = node.arguments[0];
      if (!first) {
        context.report({
          node,
          messageId: 'missingArg',
          data: { className: node.callee.name },
        });
        return;
      }
      if (
        first.type === 'Literal' ||
        first.type === 'TemplateLiteral' ||
        first.type === 'TaggedTemplateExpression'
      ) {
        context.report({
          node: first,
          messageId: 'literalForbidden',
          data: { className: node.callee.name },
        });
      }
    }

    return {
      NewExpression: check,
      CallExpression(node) {
        // 支持直接 throw BusinessException(...) 或 createBusinessException(...)，如果项目有 factory 形式
        check(node);
      },
    };
  },
};
