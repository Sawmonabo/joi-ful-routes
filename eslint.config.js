import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import jestPlugin from 'eslint-plugin-jest'
import promisePlugin from 'eslint-plugin-promise'
import securityPlugin from 'eslint-plugin-security'
import unicornPlugin from 'eslint-plugin-unicorn'
import globals from 'globals'

export default [
  js.configs.recommended,
  prettier, // Integrate Prettier formatting rules
  {
    ignores: ['node_modules/', 'tests/**/*.js'], // Ignore specific files and directories
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'], // Match all relevant files
    languageOptions: {
      ecmaVersion: 2021, // Use ECMAScript 2021
      sourceType: 'module', // Use ES Modules
      globals: {
        ...globals.node, // Enable Node.js global variables
        ...globals.jest, // Enable Jest global variables
        browser: true, // Enable browser global variables
        node: true, // Enable Node.js global variables
      },
    },
    settings: {
      'import/resolver': {
        node: {
          moduleDirectory: ['node_modules', './'], // Allow resolving from node_modules and project root
          extensions: ['.js', '.jsx', '.json'], // Include relevant extensions
        },
      },
    },
    plugins: {
      import: importPlugin,
      promise: promisePlugin,
      security: securityPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // Code quality and best practices
      eqeqeq: ['error', 'always'], // Require === and !==
      curly: ['error', 'all'], // Enforce consistent brace style
      'no-console': 'warn', // Warn about console logs
      'no-debugger': 'error', // Disallow debugger statements
      'no-unused-vars': ['error', { args: 'none' }], // Disallow unused variables except function arguments
      'no-implicit-globals': 'error', // Disallow implicit global variables
      'prefer-const': 'error', // Prefer const over let when variables are not reassigned
      'no-var': 'error', // Disallow var in favor of let/const

      // ES6+ Features
      'arrow-body-style': ['error', 'as-needed'], // Enforce concise arrow function bodies
      'prefer-arrow-callback': 'error', // Prefer arrow functions as callbacks
      'no-duplicate-imports': 'error', // Disallow duplicate imports
      'object-shorthand': ['error', 'always'], // Enforce object shorthand syntax

      // Import/export rules
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external', 'internal']],
          alphabetize: { order: 'asc' },
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'error', // Ensure imports point to a file/module
      'import/newline-after-import': ['error', { count: 1 }], // Require newline after imports

      // Promises
      'promise/always-return': 'error', // Ensure promises always return a value
      'promise/no-return-wrap': 'error', // Disallow wrapping values in promise.resolve or promise.reject
      'promise/catch-or-return': 'error', // Ensure proper handling of errors in promises

      // Security
      'security/detect-object-injection': 'off', // Disable object injection detection
      'security/detect-non-literal-fs-filename': 'warn', // Warn about non-literal filenames in fs

      // Unicorn (code clarity and performance)
      'unicorn/no-abusive-eslint-disable': 'error', // Disallow disabling ESLint without context
      'unicorn/consistent-function-scoping': 'error', // Enforce consistent function scoping
      'unicorn/prefer-optional-catch-binding': 'error', // Use optional catch binding
      'unicorn/prefer-type-error': 'error', // Prefer TypeError over other error types
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'], // Override rules for test files
    languageOptions: {
      globals: {
        ...globals.node, // Enable Node.js global variables
        ...globals.jest,
      },
    },
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
    },
  },
]
