module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2018,
        project: "./amplify/authz/resolvers/tsconfig.json",
      },
      files: ["./amplify/authz/resolvers/*.ts"],
      extends: ["plugin:@aws-appsync/base", "plugin:@aws-appsync/recommended"],
    },
  ],
};
