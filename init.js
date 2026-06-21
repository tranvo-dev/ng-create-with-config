#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function printMessage(message) {
  console.log(`${colors.blue}==>${colors.reset} ${colors.green}${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}Warning:${colors.reset} ${message}`);
}

function executeCommand(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    process.exit(1);
  }
}

function captureCommand(command) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function printError(message) {
  console.error(`${colors.red}Error:${colors.reset} ${message}`);
}

// Minimum versions this scaffold supports
const MIN_NODE_MAJOR = 14;
const MIN_NG_MAJOR = 17; // eslint.config.js + tailwind v4 setup assume Angular 17+

// Verify Node and Angular CLI versions before doing anything.
// Detects unsupported runtimes early so the user gets a clear message
// instead of a confusing failure mid-scaffold.
function checkVersions() {
  // 1. Node version vs package.json engines
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor < MIN_NODE_MAJOR) {
    printError(
      `Node ${process.version} is not supported. Requires Node >=${MIN_NODE_MAJOR}.0.0.`
    );
    process.exit(1);
  }

  // 2. Angular CLI installed + major version
  let ngVersionOutput;
  try {
    ngVersionOutput = captureCommand('ng version');
  } catch (error) {
    printError(
      'Angular CLI not found. Install it first: npm install -g @angular/cli'
    );
    process.exit(1);
  }

  const match = ngVersionOutput.match(/Angular CLI:\s*(\d+)\.\d+\.\d+/);
  const ngMajor = match ? parseInt(match[1], 10) : null;
  if (!ngMajor) {
    printWarning('Could not detect Angular CLI version. Continuing anyway.');
    return null;
  }

  if (ngMajor < MIN_NG_MAJOR) {
    printError(
      `Angular CLI ${ngMajor}.x is not supported. ` +
        `This scaffold needs Angular >=${MIN_NG_MAJOR} ` +
        `(uses flat eslint.config.js and Tailwind v4). ` +
        `Upgrade: npm install -g @angular/cli@latest`
    );
    process.exit(1);
  }

  printMessage(`Detected Node ${process.version}, Angular CLI ${ngMajor}.x`);
  return ngMajor;
}

// Check if project name is provided
const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: npx ng-create-with-config <project-name>');
  console.error('   or: node init.js <project-name>');
  process.exit(1);
}

// Gate: verify Node + Angular CLI before scaffolding
const ngMajor = checkVersions();

printMessage(`Creating Angular project: ${projectName}`);

// Create new Angular project
executeCommand(`ng new ${projectName} --routing --style=scss --skip-git`);

// Change to project directory
process.chdir(projectName);

printMessage('Installing dependencies...');

// Install Tailwind CSS
executeCommand('npm install tailwindcss@^4 @tailwindcss/postcss@^4 postcss');

// Install ESLint — ng add resolves the version matching the Angular major.
// Pin explicitly when we detected the major to avoid mismatch.
const eslintSchematics = ngMajor
  ? `@angular-eslint/schematics@${ngMajor}`
  : '@angular-eslint/schematics';
executeCommand(`ng add ${eslintSchematics} --skip-confirmation`);

// Install Prettier
executeCommand('npm install prettier prettier-eslint eslint-config-prettier eslint-plugin-prettier --save-dev');

// Install Unused Imports Eslint Plugin
executeCommand('npm install eslint-plugin-unused-imports --save-dev');

// Install Simple Sort Imports Eslint Plugin
executeCommand('npm install eslint-plugin-simple-import-sort --save-dev');

// Install lint-staged and husky
executeCommand('npm install -D lint-staged husky');
executeCommand('npx husky init');

printMessage('Configuring Tailwind CSS...');

const tailwindConfig = `
    {
        "plugins": {
            "@tailwindcss/postcss": {}
        }
    }
`;
fs.writeFileSync('.postcssrc.json', tailwindConfig);

// Update styles.scss
const stylesScss = `
    /* Tailwind CSS */
    @use "tailwindcss";
`;
fs.writeFileSync(path.join('src', 'styles.scss'), stylesScss);

printMessage('Configuring Prettier...');

// Create .prettierrc
const prettierConfig = {
  tabWidth: 2,
  endOfLine: "auto",
  proseWrap: "preserve",
  useTabs: false,
  singleQuote: true,
  semi: true,
  bracketSpacing: true,
  arrowParens: "avoid",
  trailingComma: "es5",
  bracketSameLine: true,
  printWidth: 80,
  overrides: [
    {
      files: "*.html",
      options: {
        parser: "angular"
      }
    }
  ]
}

fs.writeFileSync('.prettierrc', JSON.stringify(prettierConfig, null, 2));

// Create .prettierignore
const prettierIgnore = `node_modules
dist
coverage
.angular
*.min.js
*.min.css
package-lock.json
`;
fs.writeFileSync('.prettierignore', prettierIgnore);

printMessage('Configuring ESLint, Prettier, Unused Imports and Simple Sort Imports...');

// Update eslint.config.js to include Prettier, Unused Imports and Simple Sort Imports eslint plugins
const eslintConfig = `
  // @ts-check
  const eslint = require('@eslint/js');
  const tseslint = require('typescript-eslint');
  const angular = require('angular-eslint');
  const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
  const eslintPluginUnusedImport = require('eslint-plugin-unused-imports');
  const eslintPluginSimpleImportSort = require('eslint-plugin-simple-import-sort');
  module.exports = tseslint.config(
    {
      files: ['**/*.ts'],
      extends: [
        eslint.configs.recommended,
        ...tseslint.configs.recommended,
        ...tseslint.configs.stylistic,
        ...angular.configs.tsRecommended,
        eslintPluginPrettierRecommended,
      ],
      plugins: {
        'unused-imports': eslintPluginUnusedImport,
        'simple-import-sort': eslintPluginSimpleImportSort,
      },
      processor: angular.processInlineTemplates,
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          {
            type: 'attribute',
            prefix: 'app',
            style: 'camelCase',
          },
        ],
        '@angular-eslint/component-selector': [
          'error',
          {
            type: 'element',
            prefix: 'app',
            style: 'kebab-case',
          },
        ],
        'prettier/prettier': [
          'error',
          {
            endOfLine: 'auto', // Automatically handles line endings
          },
        ],
        '@typescript-eslint/no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': [
          'warn',
          {
            vars: 'all',
            varsIgnorePattern: '^_',
            args: 'after-used',
            argsIgnorePattern: '^_',
          },
        ],
        'simple-import-sort/imports': 'warn',
        'simple-import-sort/exports': 'warn',
      },
    },
    {
      files: ['**/*.html'],
      extends: [
        ...angular.configs.templateRecommended,
        ...angular.configs.templateAccessibility,
      ],
      rules: {},
    }
  );
`
fs.writeFileSync('eslint.config.js', eslintConfig, 'utf-8');

printMessage('Configuring lint-staged...');

// Add lint-staged configuration to package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
packageJson['lint-staged'] = {
  '*.ts': ['eslint --fix', 'prettier --write'],
  '*.html': ['prettier --write'],
  '*.scss': ['prettier --write'],
};
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

printMessage('Setting up Husky pre-commit hook...');

// Create pre-commit hook
const preCommitHook = `npx lint-staged
`;
const huskyDir = path.join('.husky');
if (!fs.existsSync(huskyDir)) {
  fs.mkdirSync(huskyDir, { recursive: true });
}
fs.writeFileSync(path.join(huskyDir, 'pre-commit'), preCommitHook);

// Make pre-commit executable (works on Unix-like systems)
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(path.join(huskyDir, 'pre-commit'), '755');
  } catch (error) {
    printWarning('Could not make pre-commit hook executable');
  }
}

printMessage('Adding npm scripts...');

// Add useful scripts to package.json
const updatedPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
updatedPackageJson.scripts = {
  ...updatedPackageJson.scripts,
  lint: 'ng lint',
  'lint:fix': 'ng lint --fix',
  format: 'prettier --write "src/**/*.{ts,html,scss}"'
};
fs.writeFileSync('package.json', JSON.stringify(updatedPackageJson, null, 2));

printMessage('✨ Project setup complete! ✨');
console.log('');
console.log('Your Angular project is ready with:');
console.log('  ✓ Angular with routing and SCSS');
console.log('  ✓ Tailwind CSS');
console.log('  ✓ ESLint with Angular rules');
console.log('  ✓ Prettier');
console.log('  ✓ lint-staged with Husky pre-commit hooks');
console.log('');
console.log('Available commands:');
console.log('  npm start          - Start development server');
console.log('  npm run lint       - Run ESLint');
console.log('  npm run lint:fix   - Fix ESLint issues');
console.log('  npm run format     - Format code with Prettier');
console.log('  npm run format:check - Check code formatting');
console.log('');
console.log('Get started:');
console.log(`  cd ${projectName}`);
console.log('  npm start');