module.exports = {
  rules: {
    'no-direct-prisma-client': require('./rules/no-direct-prisma-client'),
    'no-default-export': require('./rules/no-default-export'),
    'no-barrel-import': require('./rules/no-barrel-import'),
    'error-code-required': require('./rules/error-code-required'),
    'require-permission-decorator': require('./rules/require-permission-decorator'),
    'require-idempotent-decorator': require('./rules/require-idempotent-decorator'),
  },
};
