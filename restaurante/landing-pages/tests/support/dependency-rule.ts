import { join } from 'node:path';

import { ESLint } from 'eslint';
import { expect } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';

/**
 * Regla de dependencias entre paquetes (REQ-F-037 y REQ-F-038) en los archivos
 * dependency-rule*.test.ts. REQ-F-041: preparación compartida por los archivos en que se partió
 * dependency-rule.test.ts, sin cambios.
 */

export const ROOT = join(PROJECT_DIR, '..');
export const eslint = new ESLint({ cwd: ROOT });

export const AS = {
  core: join(ROOT, 'packages', 'core', 'catalog', 'price.ts'),
  contracts: join(ROOT, 'packages', 'contracts', 'index.ts'),
  db: join(ROOT, 'packages', 'db', 'src', 'paths.ts'),
  web: join(ROOT, 'packages', 'web', 'logger.ts'),
  landing: join(ROOT, 'landing-pages', 'src', 'app.ts'),
  landingCode: join(ROOT, 'landing-pages', 'src', 'controllers', 'landing.ts'),
  landingView: join(ROOT, 'landing-pages', 'src', 'views', 'landings', 'index.ts'),
  landingTest: join(ROOT, 'landing-pages', 'tests', 'unit', 'price.test.ts'),
  admin: join(ROOT, 'landing-pages', 'src', 'controllers', 'admin.ts'),
  bot: join(ROOT, 'landing-pages', 'src', 'services', 'whatsapp-bot', 'catalog.ts'),
  api: join(ROOT, 'api', 'src', 'app.ts'),
  inventory: join(ROOT, 'inventory-manager', 'src', 'app.ts'),
  inventoryTest: join(ROOT, 'inventory-manager', 'tests', 'unit', 'product-form.test.ts'),
} as const;

export async function violations(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  // Un error de parseo invalidaría la prueba: el ejemplo debe ser código válido.
  expect(messages.filter((message) => message.fatal)).toEqual([]);
  return messages
    .filter((message) => message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

export const use = (name: string) => `\nexport const used = ${name};\n`;
