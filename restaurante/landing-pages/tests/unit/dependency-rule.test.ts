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
  web: join(ROOT, 'packages', 'web', 'logger.ts'),
  landing: join(ROOT, 'landing-pages', 'src', 'app.ts'),
  landingCode: join(ROOT, 'landing-pages', 'src', 'controllers', 'landing.ts'),
  landingView: join(ROOT, 'landing-pages', 'src', 'views', 'landings', 'index.ts'),
  landingTest: join(ROOT, 'landing-pages', 'tests', 'unit', 'price.test.ts'),
  admin: join(ROOT, 'landing-pages', 'src', 'controllers', 'admin.ts'),
  bot: join(ROOT, 'landing-pages', 'src', 'services', 'whatsapp-bot', 'catalog.ts'),
  api: join(ROOT, 'api', 'src', 'app.ts'),
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

describe('regla de dependencias entre paquetes (REQ-F-037, CA-6; REQ-F-038, CA-9)', () => {
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

  // web (REQ-F-039, P-1): utilidades HTTP/SSR sin dominio; la usan las apps, nunca los paquetes.
  describe('web: Koa sí, nada del proyecto', () => {
    it.each([
      ['core', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['contracts', "import * as contracts from '@restaurante/contracts';" + use('contracts')],
      ['db', "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['landing-pages (relativo)', "import { createApp } from '../../landing-pages/src/app.ts';" + use('createApp')],
      ['import() de un paquete', "export const later = import('koa');\n"],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.web)).length).toBeGreaterThan(0);
    });

    it.each([
      ['koa (solo tipos)', "import type { Context } from 'koa';\nexport type Used = Context;\n"],
      ['la biblioteca estándar', "import { join } from 'node:path';" + use('join')],
      ['un archivo del paquete', "import { createLogger } from './logger.ts';" + use('createLogger')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.web)).toEqual([]);
    });

    it.each([
      ['core', AS.core],
      ['contracts', AS.contracts],
      ['db', AS.db],
    ])('%s no puede importar web', async (_name, filePath) => {
      expect((await violations("import { createLogger } from '@restaurante/web';" + use('createLogger'), filePath)).length).toBeGreaterThan(0);
    });

    it.each([
      ['landing-pages', AS.landing],
      ['el código de las landings', AS.landingCode],
      ['api', AS.api],
    ])('%s puede importar web', async (_name, filePath) => {
      expect(await violations("import { createLogger } from '@restaurante/web';" + use('createLogger'), filePath)).toEqual([]);
    });
  });

  describe('contracts: Zod sí (REQ-F-038)', () => {
    it('permite zod', async () => {
      expect(await violations("import { z } from 'zod';" + use('z'), AS.contracts)).toEqual([]);
    });
  });

  // Código de las landings (REQ-F-038, RF-8 y CA-9; decisión P-1 A): los productos solo del cliente
  // de la API; sí los módulos puros de core.
  describe('código de las landings: sin base de datos ni repositorio de productos', () => {
    it.each([
      ['db', "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['db (store de Prisma)', "import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';" + use('createPrismaProductStore')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['mariadb', "import { createConnection } from 'mariadb';" + use('createConnection')],
      ['core/identity', "import { isAdmin } from '@restaurante/core/identity';" + use('isAdmin')],
      ['core/bot-control', "import { maskedFromLast4 } from '@restaurante/core/bot-control';" + use('maskedFromLast4')],
      ['el store en memoria de core/catalog', "import { createMemoryProductStore } from '@restaurante/core/catalog';" + use('createMemoryProductStore')],
      ['toPublished (conversión del servidor)', "import { toPublished } from '@restaurante/core/catalog';" + use('toPublished')],
      ['el tipo ProductStore', "import type { ProductStore } from '@restaurante/core/catalog';\nexport type Used = ProductStore;\n"],
      ['el repositorio de productos', "import { createProductRepository } from '@restaurante/core/catalog';" + use('createProductRepository')],
      ['el tipo ProductRepository', "import type { ProductRepository } from '@restaurante/core/catalog';\nexport type Used = ProductRepository;\n"],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.landingCode)).length).toBeGreaterThan(0);
    });

    it('también en las vistas de las landings', async () => {
      const code = "import { createProductRepository } from '@restaurante/core/catalog';" + use('createProductRepository');
      expect((await violations(code, AS.landingView)).length).toBeGreaterThan(0);
    });

    it.each([
      ['contracts', "import { createPublicApiClient } from '@restaurante/contracts';" + use('createPublicApiClient')],
      ['core/schedule (aviso del día)', "import { getHomeNotice } from '@restaurante/core/schedule';" + use('getHomeNotice')],
      ['core/shared', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['funciones puras de core/catalog', "import { formatPesos } from '@restaurante/core/catalog';" + use('formatPesos')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.landingCode)).toEqual([]);
    });
  });

  // O-2 de REQ-F-037: en todo landing-pages, los paquetes solo por su nombre.
  describe('landing-pages: sin imports relativos a archivos de packages/ (O-2)', () => {
    it.each([
      ['src', AS.landing, "import { isValidPriceCents } from '../../packages/core/catalog/price.ts';" + use('isValidPriceCents')],
      ['tests', AS.landingTest, "import { isValidPriceCents } from '../../../packages/core/catalog/price.ts';" + use('isValidPriceCents')],
      ['un archivo interno de core por el nombre del paquete', AS.landing, "import { isValidPriceCents } from '@restaurante/core/catalog/price.ts';" + use('isValidPriceCents')],
    ])('rechaza %s', async (_name, filePath, code) => {
      expect((await violations(code, filePath)).length).toBeGreaterThan(0);
    });
  });

  describe('api: core, db, contracts y Koa; nunca una app', () => {
    it.each([
      ['landing-pages (paquete)', "import { createApp } from 'landing-pages/src/app.ts';" + use('createApp')],
      ['landing-pages (relativo)', "import { createApp } from '../../landing-pages/src/app.ts';" + use('createApp')],
      ['un archivo interno de core', "import { isValidPriceCents } from '@restaurante/core/catalog/price.ts';" + use('isValidPriceCents')],
      ['un archivo de packages/ por ruta relativa', "import { toPublished } from '../../packages/core/catalog/published.ts';" + use('toPublished')],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.api)).length).toBeGreaterThan(0);
    });

    it.each([
      ['core', "import { toPublished } from '@restaurante/core/catalog';" + use('toPublished')],
      ['db', "import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';" + use('createPrismaProductStore')],
      ['contracts', "import { productsResponseSchemas } from '@restaurante/contracts';" + use('productsResponseSchemas')],
      ['koa', "import Koa from 'koa';" + use('Koa')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.api)).toEqual([]);
    });
  });

  // Regla de transición (temporal, REQ-F-037; limitada en REQ-F-038): /admin y el bot, hasta el paso 4.
  describe('landing-pages: regla de transición para /admin y el bot', () => {
    it.each([
      ['/admin importa core', AS.admin, "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['/admin importa db', AS.admin, "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['/admin importa core/identity', AS.admin, "import { isAdmin } from '@restaurante/core/identity';" + use('isAdmin')],
      ['el bot importa core/catalog', AS.bot, "import { createMemoryProductStore } from '@restaurante/core/catalog';" + use('createMemoryProductStore')],
      ['el bot importa db', AS.bot, "import { poolConfig } from '@restaurante/db/client';" + use('poolConfig')],
      ['la composición (app.ts) importa contracts', AS.landing, "import * as contracts from '@restaurante/contracts';" + use('contracts')],
    ])('permite: %s', async (_name, filePath, code) => {
      expect(await violations(code, filePath)).toEqual([]);
    });
  });
});
