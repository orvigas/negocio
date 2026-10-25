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

// Un bloque posterior que configura la misma regla sustituye sus opciones: por eso las reglas de
// imports .js se definen una vez aquí y se repiten en cada bloque que añade restricciones.
const RELATIVE_JS_IMPORT_PATTERNS = [
  { regex: String.raw`^\.{1,2}/(?!(?:\.\./)*public/js/).*\.js$`, message: RELATIVE_JS_IMPORT_MESSAGE },
];
// no-restricted-imports no revisa import() dinámico.
const RELATIVE_JS_DYNAMIC_IMPORT = {
  selector: String.raw`ImportExpression > Literal.source[value=/^\.{1,2}\/.*\.js$/]:not([value=/public\/js\//])`,
  message: RELATIVE_JS_IMPORT_MESSAGE,
};

// Servidores de prueba (REQ-F-011): las pruebas hablan con la app solo mediante listenLocal de
// tests/support/http.ts, que escucha en 127.0.0.1. Con request(app.callback()) supertest abre su
// propio servidor en :: (todas las interfaces) y conecta a 127.0.0.1; en macOS otro proceso local
// puede tener ese puerto en 127.0.0.1 y recibir la petición.
const TEST_HTTP_HINT = 'Usa listenLocal(app) de tests/support/http.ts (o setupAdmin), que escucha solo en 127.0.0.1 (REQ-F-011).';
const TEST_HTTP_RESTRICTED_IMPORTS = [
  {
    name: 'supertest',
    allowTypeImports: true,
    message: `Solo tests/support/http.ts crea clientes de supertest. ${TEST_HTTP_HINT}`,
  },
];
const TEST_HTTP_RESTRICTED_SYNTAX = [
  {
    selector: "CallExpression[callee.property.name='callback']",
    message: `No pases app.callback() a supertest: abriría un servidor en :: y el cliente podría hablar con otro proceso local. ${TEST_HTTP_HINT}`,
  },
  {
    selector: "CallExpression[callee.property.name='listen']:not([arguments.1.value='127.0.0.1'])",
    message: `Un servidor de prueba escucha solo en '127.0.0.1' (listen(0, '127.0.0.1')), nunca en todas las interfaces. ${TEST_HTTP_HINT}`,
  },
];

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
      'no-restricted-imports': ['error', { patterns: RELATIVE_JS_IMPORT_PATTERNS }],
      'no-restricted-syntax': ['error', RELATIVE_JS_DYNAMIC_IMPORT],
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

  // Servidores de prueba en 127.0.0.1 (REQ-F-011, RF-7). La prueba de este control está en
  // tests/unit/http-test-convention.test.ts.
  {
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: TEST_HTTP_RESTRICTED_IMPORTS, patterns: RELATIVE_JS_IMPORT_PATTERNS }],
      'no-restricted-syntax': ['error', RELATIVE_JS_DYNAMIC_IMPORT, ...TEST_HTTP_RESTRICTED_SYNTAX],
    },
  },
  // Única excepción: el módulo que crea los clientes de supertest.
  {
    files: ['tests/support/http.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: RELATIVE_JS_IMPORT_PATTERNS }],
    },
  },

  // Frontend en JavaScript Vanilla (módulos ES del navegador), sin información de tipos.
  {
    files: ['public/js/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'module', globals: globals.browser },
  },
]);
