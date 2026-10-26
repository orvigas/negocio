import { join } from 'node:path';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';

/**
 * Regla de dependencias entre paquetes (REQ-F-037, RF-6 y CA-6; restaurante/docs/arquitectura.md §4):
 * `npm run lint` rechaza los imports que la rompen. Se usa la configuración real (eslint.config.ts de
 * la raíz).
 *
 * El código de ejemplo se revisa "como si" fuera un archivo existente de cada paquete: el servicio de
 * proyectos de typescript-eslint solo acepta rutas que existen y están en un tsconfig.json.
 */

const ROOT = join(PROJECT_DIR, '..');
const eslint = new ESLint({ cwd: ROOT });

const AS = {
  core: join(ROOT, 'packages', 'core', 'catalog', 'price.ts'),
  contracts: join(ROOT, 'packages', 'contracts', 'index.ts'),
  db: join(ROOT, 'packages', 'db', 'src', 'paths.ts'),
  landing: join(ROOT, 'landing-pages', 'src', 'app.ts'),
} as const;

async function violations(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  // Un error de parseo invalidaría la prueba: el ejemplo debe ser código válido.
  expect(messages.filter((message) => message.fatal)).toEqual([]);
  return messages
    .filter((message) => message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message);
}

const use = (name: string) => `\nexport const used = ${name};\n`;

describe('regla de dependencias entre paquetes (REQ-F-037, CA-6)', () => {
  describe('core: solo la biblioteca estándar de Node y sus propios archivos', () => {
    it.each([
      ['koa', "import Koa from 'koa';" + use('Koa')],
      ['koa (solo tipos)', "import type { Context } from 'koa';\nexport type Used = Context;\n"],
      ['@koa/router', "import Router from '@koa/router';" + use('Router')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['mariadb', "import { createConnection } from 'mariadb';" + use('createConnection')],
      ['contracts', "import * as contracts from '@restaurante/contracts';" + use('contracts')],
      ['db', "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['landing-pages (paquete)', "import { createApp } from 'landing-pages/src/app.ts';" + use('createApp')],
      ['landing-pages (relativo)', "import { createApp } from '../../../landing-pages/src/app.ts';" + use('createApp')],
      ['un archivo interno de otro módulo', "import { BUSINESS } from '../shared/businesses.ts';" + use('BUSINESS')],
      ['import() de un paquete', "export const later = import('koa');\n"],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.core)).length).toBeGreaterThan(0);
    });

    it.each([
      ['el index.ts de otro módulo', "import { BUSINESS } from '../shared/index.ts';" + use('BUSINESS')],
      ['un archivo del mismo módulo', "import { isValidPriceCents } from './price.ts';" + use('isValidPriceCents')],
      ['la biblioteca estándar (node:*)', "import { join } from 'node:path';" + use('join')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.core)).toEqual([]);
    });
  });

  describe('contracts: nada del proyecto', () => {
    it.each([
      ['core', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['db', "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['koa', "import Koa from 'koa';" + use('Koa')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['landing-pages (relativo)', "import { createApp } from '../../landing-pages/src/app.ts';" + use('createApp')],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.contracts)).length).toBeGreaterThan(0);
    });

    it('permite la biblioteca estándar', async () => {
      expect(await violations("import { join } from 'node:path';" + use('join'), AS.contracts)).toEqual([]);
    });
  });

  describe('db: solo core (por el index.ts de cada módulo) y la base de datos', () => {
    it.each([
      ['koa', "import Koa from 'koa';" + use('Koa')],
      ['contracts', "import * as contracts from '@restaurante/contracts';" + use('contracts')],
      ['landing-pages (paquete)', "import { createApp } from 'landing-pages/src/app.ts';" + use('createApp')],
      ['landing-pages (relativo)', "import { createApp } from '../../../landing-pages/src/app.ts';" + use('createApp')],
      ['un archivo interno de core', "import { isValidPriceCents } from '@restaurante/core/catalog/price.ts';" + use('isValidPriceCents')],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.db)).length).toBeGreaterThan(0);
    });

    it.each([
      ['un módulo de core', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['un archivo del paquete', "import { DB_PACKAGE_DIR } from './paths.ts';" + use('DB_PACKAGE_DIR')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.db)).toEqual([]);
    });
  });

  // Regla de transición (temporal, REQ-F-037): se retira en el paso 3 (landings) y en el paso 4 (/admin).
  describe('landing-pages: regla de transición', () => {
    it.each([
      ['core', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['db', "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['contracts', "import * as contracts from '@restaurante/contracts';" + use('contracts')],
    ])('permite importar %s', async (_name, code) => {
      expect(await violations(code, AS.landing)).toEqual([]);
    });
  });
});
