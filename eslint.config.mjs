export default [
  {
    ignores: [
      '**/dist/*'
    ]
  },
  {
    files: ['**/*.js'], // Exclude `dist/` from the files pattern
    languageOptions: {
      ecmaVersion: 'latest', // Use the latest ECMAScript version
      sourceType: 'module', // Use ES Modules
      globals: {
        // Node.js globals
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',

        // Jest globals
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      // Add custom rules here if needed
    },
  },
];
