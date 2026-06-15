module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    "no-console": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    "no-undef": "error",
    "no-process-exit": "off",
    "no-constant-condition": ["error", { checkLoops: false }],
  },
  globals: {
    process: "readonly",
    __dirname: "readonly",
    module: "readonly",
    require: "readonly",
  },
};
