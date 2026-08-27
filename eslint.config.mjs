import globals from 'globals';
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    // country-mappings.js is loaded before content.js in the same (ISOLATED)
    // world, so COUNTRY_MAPPINGS is a shared global rather than an import.
    files: ['src/country-mappings.js'],
    rules: { 'no-unused-vars': 'off' },
  },
  {
    files: ['src/content.js'],
    languageOptions: { globals: { COUNTRY_MAPPINGS: 'readonly' } },
  },
];
