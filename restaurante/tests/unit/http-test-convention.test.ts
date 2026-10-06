import { join } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';

/**
 * Control automático de REQ-F-011 (RF-7, CA-11): `npm run lint` rechaza en tests/ la forma antigua
 * de crear el cliente de pruebas. Se usa la configuración real (eslint.config.ts).
 *
 * El código de ejemplo se revisa "como si" fuera este archivo: el servicio de proyectos de
 * typescript-eslint solo acepta rutas que existen y están en tsconfig.json.
 */

const eslint = new ESLint({ cwd: PROJECT_DIR });
const THIS_FILE = import.meta.filename;
const HTTP_SUPPORT = join(PROJECT_DIR, 'tests', 'support', 'http.ts');

const HEADER = "import { createApp } from '../../src/app.ts';\nconst app = createApp({} as never);\n";

async function restrictions(code: string, filePath = THIS_FILE): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  // Un error de parseo invalidaría la prueba: el ejemplo debe ser código válido.
  expect(messages.filter((message) => message.fatal)).toEqual([]);
  return messages
    .filter((message) => message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

describe('convención de servidores de prueba en 127.0.0.1 (REQ-F-011, RF-7)', () => {
  it.each([
    ['request(app.callback())', "import request from 'supertest';\nexport const client = request(app.callback());\n", 2],
    ['request.agent(app.callback())', "import request from 'supertest';\nexport const browser = request.agent(app.callback());\n", 2],
    ['app.callback() aunque no se importe supertest', 'export const handler = app.callback();\n', 1],
    ['import de supertest fuera de tests/support/http.ts', "import request from 'supertest';\nexport const client = request('http://127.0.0.1:1');\n", 1],
    ['listen() sin dirección', 'export const server = app.listen(0);\n', 1],
    ["listen() en '0.0.0.0'", "export const server = app.listen(0, '0.0.0.0');\n", 1],
  ])('falla con %s', async (_name, code, expected) => {
    const found = await restrictions(HEADER + code);
    expect(found).toHaveLength(expected);
    for (const message of found) expect(message).toContain('tests/support/http.ts');
  }, 30_000);

  it('acepta la forma correcta y los imports de solo tipos', async () => {
    const code = [
      "import type { Test } from 'supertest';",
      "import { listenLocal } from '../support/http.ts';",
      HEADER,
      'export const server = await listenLocal(app);',
      'export const pending: Test = server.request().get(\'/\');',
      "export const raw = app.listen(0, '127.0.0.1');",
      '',
    ].join('\n');
    expect(await restrictions(code)).toEqual([]);
  }, 30_000);

  it('tests/support/http.ts es el único que puede importar supertest', async () => {
    const code = "import request from 'supertest';\nexport const client = request('http://127.0.0.1:1');\n";
    expect(await restrictions(code, HTTP_SUPPORT)).toEqual([]);
  }, 30_000);
});
