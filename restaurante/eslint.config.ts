// Lint del proyecto (REQ-F-005). `npm run lint` revisa sin modificar; `npm run lint:fix` corrige.
// Toda regla es error o está desactivada (sin avisos). Una desactivación en línea exige
// justificación después de `--` (require-description).
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RELATIVE_JS_IMPORT_MESSAGE =
  'Los imports relativos del backend llevan la extensión .ts: Node no resuelve ./x.js hacia x.ts (ERR_MODULE_NOT_FOUND). Solo public/js se importa con .js.';

export default defineConfig([
  // CSS generado por Tailwind, datos editables, cobertura y código generado (p. ej. un cliente de BD).
  // ESLint ya ignora node_modules/ y no lee .gitignore.
  globalIgnores(['public/css/', 'data/', 'coverage/', 'src/generated/']),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },

  // Backend, pruebas, scripts y configuraciones en TypeScript, con información de tipos.
  // Un .ts fuera de tsconfig.json da error de parseo: lint y typecheck revisan los mismos archivos.
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.node,
    },
    rules: {
      // `tsc` (allowImportingTsExtensions) y Vitest resuelven ./x.js hacia x.ts, pero Node no.
      // Se permiten solo los módulos del frontend (public/js), que sí son .js.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: String.raw`^\.{1,2}/(?!(?:\.\./)*public/js/).*\.js$`, message: RELATIVE_JS_IMPORT_MESSAGE },
          ],
        },
      ],
      // no-restricted-imports no revisa import() dinámico.
      'no-restricted-syntax': [
        'error',
        {
          selector: String.raw`ImportExpression > Literal.source[value=/^\.{1,2}\/.*\.js$/]:not([value=/public\/js\//])`,
          message: RELATIVE_JS_IMPORT_MESSAGE,
        },
      ],
      // Excepción E-1 (REQ-F-005): el `async` sin `await` es intencional en este proyecto. Cumple
      // contratos asíncronos (repositorio, `next` de Koa, dobles de prueba) y convierte un throw
      // síncrono en promesa rechazada; quitarlo cambiaría el comportamiento. Los riesgos reales con
      // promesas siguen cubiertos por no-floating-promises, no-misused-promises y await-thenable.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Excepción E-2 (REQ-F-005), solo en las pruebas: trabajan con valores `any` por diseño
  // (res.body de Supertest, JSON.parse de los archivos que escriben y CorruptibleData) y sus
  // aserciones comprueban la forma. no-explicit-any sigue activa: un `any` nuevo exige justificación.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },

  // Frontend en JavaScript Vanilla (módulos ES del navegador), sin información de tipos.
  {
    files: ['public/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
]);
