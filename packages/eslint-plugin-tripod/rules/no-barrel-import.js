/**
 * 禁止 barrel import（从目录 index 隐式导入）。
 *
 * 禁：import { X } from '.'                （隐式 ./index）
 * 禁：import { X } from '..'                （隐式 ../index）
 * 禁：import { X } from './some-folder'     （folder 只有 index.ts）
 *
 * 允：import { X } from './file'            （具体文件）
 * 允：import { X } from './folder/file'     （具体文件）
 * 允：import { X } from '@tripod-stack/xxx' （跨包 entry 本身是约定的 barrel）
 *
 * 目的：强制内部引用具名文件，避免 barrel 引起的循环依赖 + tree-shaking 退化。
 * 判断：相对路径导入（'.' 开头），且路径末段不含扩展名、且结尾没有明显文件名特征时告警。
 *      因为 ESLint 无法访问文件系统判断是不是真的 folder，这里用启发式：
 *      - '.', '..', './', '../' 精确等于 → 命中
 *      - 任何以 '/' 结尾的路径 → 命中（显式 folder）
 *      不触发：'./errors/codes'（扩展名无法从 AST 判断，放过）
 *      额外：options.strictFolderPattern = true 时恢复严格模式（末段无 . 也命中）
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 barrel import（从目录隐式 index 导入）',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowPatterns: {
            type: 'array',
            items: { type: 'string' },
          },
          strictFolderPattern: {
            type: 'boolean',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        'barrel import 禁用。请从具体文件导入：`from "./some-folder/feature-impl"` 而不是 `from "./some-folder/"` 或裸 `from "."`。',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const allowPatterns = (options.allowPatterns || []).map((p) => new RegExp(p));
    const strictMode = options.strictFolderPattern === true;

    function isBarrel(source) {
      if (!source.startsWith('.')) return false;
      if (allowPatterns.some((re) => re.test(source))) return false;

      if (source === '.' || source === '..' || source === './' || source === '../') return true;
      if (source.endsWith('/')) return true;

      if (strictMode) {
        const last = source.split('/').pop() || '';
        if (!last.includes('.') && last !== '' && last !== '..') return true;
      }

      return false;
    }

    return {
      ImportDeclaration(node) {
        if (node.source && typeof node.source.value === 'string' && isBarrel(node.source.value)) {
          context.report({ node: node.source, messageId: 'forbidden' });
        }
      },
      ExportAllDeclaration(node) {
        if (node.source && typeof node.source.value === 'string' && isBarrel(node.source.value)) {
          context.report({ node: node.source, messageId: 'forbidden' });
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source && typeof node.source.value === 'string' && isBarrel(node.source.value)) {
          context.report({ node: node.source, messageId: 'forbidden' });
        }
      },
    };
  },
};
