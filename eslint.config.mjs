import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

// Explicit rules migrated from the previous effective Airbnb TypeScript config.
// Keep the original typed project, source/test scope and generated-code exclusions.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/generated/ace-context/**'] },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser, ecmaVersion: 2022, sourceType: 'module',
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },
    },
    plugins: { '@typescript-eslint': tsPlugin, '@stylistic': stylistic, 'import-x': importX },
    // ESLint 8 did not report unused disable directives by default.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: {
      ...{
        "import-x/parsers": {
          "@typescript-eslint/parser": [
            ".ts",
            ".tsx",
            ".d.ts"
          ]
        },
        "import-x/extensions": [
          ".js",
          ".mjs",
          ".jsx",
          ".ts",
          ".tsx",
          ".d.ts"
        ],
        "import-x/external-module-folders": [
          "node_modules",
          "node_modules/@types"
        ]
      },
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ project: './tsconfig.eslint.json' }),
        createNodeResolver({ extensions: ['.mjs', '.js', '.json', '.ts', '.d.ts'] }),
      ],
    },
    rules: {
      "@stylistic/brace-style": [
        "error",
        "1tbs",
        {
          "allowSingleLine": true
        }
      ],
      "@stylistic/comma-dangle": [
        "error",
        {
          "arrays": "always-multiline",
          "objects": "always-multiline",
          "imports": "always-multiline",
          "exports": "always-multiline",
          "functions": "always-multiline",
          "enums": "always-multiline",
          "generics": "always-multiline",
          "tuples": "always-multiline"
        }
      ],
      "@stylistic/comma-spacing": [
        "error",
        {
          "before": false,
          "after": true
        }
      ],
      "@stylistic/function-call-spacing": [
        "error",
        "never"
      ],
      "@stylistic/indent": [
        "error",
        2,
        {
          "SwitchCase": 1,
          "VariableDeclarator": 1,
          "outerIIFEBody": 1,
          "FunctionDeclaration": {
            "parameters": 1,
            "body": 1
          },
          "FunctionExpression": {
            "parameters": 1,
            "body": 1
          },
          "CallExpression": {
            "arguments": 1
          },
          "ArrayExpression": 1,
          "ObjectExpression": 1,
          "ImportDeclaration": 1,
          "flatTernaryExpressions": false,
          "ignoredNodes": [
            "JSXElement",
            "JSXElement > *",
            "JSXAttribute",
            "JSXIdentifier",
            "JSXNamespacedName",
            "JSXMemberExpression",
            "JSXSpreadAttribute",
            "JSXExpressionContainer",
            "JSXOpeningElement",
            "JSXClosingElement",
            "JSXFragment",
            "JSXOpeningFragment",
            "JSXClosingFragment",
            "JSXText",
            "JSXEmptyExpression",
            "JSXSpreadChild"
          ],
          "ignoreComments": false,
          "offsetTernaryExpressions": false
        }
      ],
      "@stylistic/keyword-spacing": [
        "error",
        {
          "before": true,
          "after": true,
          "overrides": {
            "return": {
              "after": true
            },
            "throw": {
              "after": true
            },
            "case": {
              "after": true
            }
          }
        }
      ],
      "@stylistic/lines-between-class-members": [
        "error",
        "always",
        {
          "exceptAfterSingleLine": false,
          "exceptAfterOverload": true
        }
      ],
      "@stylistic/no-extra-parens": [
        "off",
        "all",
        {
          "conditionalAssign": true,
          "nestedBinaryExpressions": false,
          "returnAssign": false,
          "ignoreJSX": "all",
          "enforceForArrowConditionals": false
        }
      ],
      "@stylistic/no-extra-semi": [
        "error"
      ],
      "@stylistic/object-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/quotes": [
        "error",
        "single",
        {
          "avoidEscape": true
        }
      ],
      "@stylistic/semi": [
        "error",
        "always"
      ],
      "@stylistic/space-before-blocks": [
        "error"
      ],
      "@stylistic/space-before-function-paren": [
        "error",
        {
          "anonymous": "always",
          "named": "never",
          "asyncArrow": "always"
        }
      ],
      "@stylistic/space-infix-ops": [
        "error"
      ],
      "@typescript-eslint/default-param-last": [
        "error"
      ],
      "@typescript-eslint/dot-notation": [
        "error",
        {
          "allowKeywords": true,
          "allowPattern": "",
          "allowPrivateClassPropertyAccess": false,
          "allowProtectedClassPropertyAccess": false,
          "allowIndexSignaturePropertyAccess": false
        }
      ],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "variable",
          "format": [
            "camelCase",
            "PascalCase",
            "UPPER_CASE"
          ]
        },
        {
          "selector": "function",
          "format": [
            "camelCase",
            "PascalCase"
          ]
        },
        {
          "selector": "typeLike",
          "format": [
            "PascalCase"
          ]
        }
      ],
      "@typescript-eslint/no-array-constructor": [
        "error"
      ],
      "@typescript-eslint/no-dupe-class-members": [
        "error"
      ],
      "@typescript-eslint/no-empty-function": [
        "error",
        {
          "allow": [
            "arrowFunctions",
            "functions",
            "methods"
          ]
        }
      ],
      "@typescript-eslint/no-implied-eval": [
        "error"
      ],
      "@typescript-eslint/no-loop-func": [
        "error"
      ],
      "@typescript-eslint/no-magic-numbers": [
        "off",
        {
          "ignore": [],
          "ignoreArrayIndexes": true,
          "enforceConst": true,
          "detectObjects": false
        }
      ],
      "@typescript-eslint/no-redeclare": [
        "error"
      ],
      "@typescript-eslint/no-shadow": [
        "error"
      ],
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          "allowShortCircuit": false,
          "allowTernary": false,
          "allowTaggedTemplates": false,
          "enforceForJSX": false
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "vars": "all",
          "args": "after-used",
          "ignoreRestSiblings": true
        }
      ],
      "@typescript-eslint/no-use-before-define": [
        "off",
        {
          "functions": true,
          "classes": true,
          "variables": true
        }
      ],
      "@typescript-eslint/no-useless-constructor": [
        "error"
      ],
      "@typescript-eslint/only-throw-error": [
        "error"
      ],
      "@typescript-eslint/require-await": [
        "off"
      ],
      "@typescript-eslint/return-await": [
        "error",
        "in-try-catch"
      ],
      "camelcase": [
        "off"
      ],
      "class-methods-use-this": [
        "off"
      ],
      "constructor-super": [
        "off"
      ],
      "default-param-last": [
        "off"
      ],
      "dot-notation": [
        "off"
      ],
      "getter-return": [
        "off"
      ],
      "import-x/extensions": [
        "error",
        "ignorePackages",
        {
          "ts": "never"
        }
      ],
      "import-x/named": [
        "off"
      ],
      "import-x/no-extraneous-dependencies": [
        "error",
        {
          "devDependencies": [
            "test/**",
            "tests/**",
            "spec/**",
            "**/__tests__/**",
            "**/__mocks__/**",
            "test.{js,jsx}",
            "test.{ts,tsx}",
            "test-*.{js,jsx}",
            "test-*.{ts,tsx}",
            "**/*{.,_}{test,spec}.{js,jsx}",
            "**/*{.,_}{test,spec}.{ts,tsx}",
            "**/jest.config.js",
            "**/jest.config.ts",
            "**/jest.setup.js",
            "**/jest.setup.ts",
            "**/vue.config.js",
            "**/vue.config.ts",
            "**/webpack.config.js",
            "**/webpack.config.ts",
            "**/webpack.config.*.js",
            "**/webpack.config.*.ts",
            "**/rollup.config.js",
            "**/rollup.config.ts",
            "**/rollup.config.*.js",
            "**/rollup.config.*.ts",
            "**/gulpfile.js",
            "**/gulpfile.ts",
            "**/gulpfile.*.js",
            "**/gulpfile.*.ts",
            "**/Gruntfile{,.js}",
            "**/Gruntfile{,.ts}",
            "**/protractor.conf.js",
            "**/protractor.conf.ts",
            "**/protractor.conf.*.js",
            "**/protractor.conf.*.ts",
            "**/karma.conf.js",
            "**/karma.conf.ts",
            "**/.eslintrc.js",
            "**/.eslintrc.ts"
          ],
          "optionalDependencies": false
        }
      ],
      "import-x/no-named-as-default-member": [
        "off"
      ],
      "import-x/no-unresolved": [
        "off"
      ],
      "import-x/prefer-default-export": [
        "off"
      ],
      "max-classes-per-file": [
        "off"
      ],
      "no-array-constructor": [
        "off"
      ],
      "no-await-in-loop": [
        "off"
      ],
      "no-const-assign": [
        "off"
      ],
      "no-dupe-args": [
        "off"
      ],
      "no-dupe-class-members": [
        "off"
      ],
      "no-dupe-keys": [
        "off"
      ],
      "no-empty-function": [
        "off"
      ],
      "no-func-assign": [
        "off"
      ],
      "no-implied-eval": [
        "off"
      ],
      "no-import-assign": [
        "off"
      ],
      "no-loop-func": [
        "off"
      ],
      "no-loss-of-precision": [
        "error"
      ],
      "no-magic-numbers": [
        "off"
      ],
      "no-new-func": [
        "off"
      ],
      "no-new-symbol": [
        "off"
      ],
      "no-obj-calls": [
        "off"
      ],
      "no-plusplus": [
        "off"
      ],
      "no-redeclare": [
        "off"
      ],
      "no-restricted-syntax": [
        "off"
      ],
      "no-return-await": [
        "off"
      ],
      "no-setter-return": [
        "off"
      ],
      "no-shadow": [
        "off"
      ],
      "no-this-before-super": [
        "off"
      ],
      "no-throw-literal": [
        "off"
      ],
      "no-undef": [
        "off"
      ],
      "no-underscore-dangle": [
        "off"
      ],
      "no-unreachable": [
        "off"
      ],
      "no-unsafe-negation": [
        "off"
      ],
      "no-unused-expressions": [
        "off"
      ],
      "no-unused-vars": [
        "off"
      ],
      "no-use-before-define": [
        "off"
      ],
      "no-useless-constructor": [
        "off"
      ],
      "require-await": [
        "off"
      ],
      "valid-typeof": [
        "off"
      ]
    },
  },
];
