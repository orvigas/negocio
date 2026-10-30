import { describe, expect, it } from 'vitest';

import { AS, violations, use } from '../support/dependency-rule.ts';

/**
 * Regla de dependencias entre paquetes (REQ-F-037, RF-6 y CA-6; restaurante/docs/arquitectura.md §4):
 * `npm run lint` rechaza los imports que la rompen. Se usa la configuración real (eslint.config.ts de
 * la raíz).
 *
 * El código de ejemplo se revisa "como si" fuera un archivo existente de cada paquete: el servicio de
 * proyectos de typescript-eslint solo acepta rutas que existen y están en un tsconfig.json.
 *
 * REQ-F-041: parte de dependency-rule.test.ts (preparación en tests/support/dependency-rule.ts).
 */

describe('regla de dependencias entre paquetes (REQ-F-037, CA-6; REQ-F-038, CA-9)', () => {
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

    // DEF-004 de QA: los import() dinámicos también se revisan en api.
    it.each([
      ['import() de landing-pages', "export const later = import('../../landing-pages/src/app.ts');\n"],
      ['import() de inventory-manager', "export const later = import('../../inventory-manager/src/app.ts');\n"],
      ['import() de un archivo interno de core', "export const later = import('@restaurante/core/catalog/price.ts');\n"],
      ['import() de un archivo de packages/', "export const later = import('../../packages/core/catalog/published.ts');\n"],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.api)).length).toBeGreaterThan(0);
    });

    it('permite import() de un módulo de core por su nombre', async () => {
      expect(await violations("export const later = import('@restaurante/core/catalog');\n", AS.api)).toEqual([]);
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

  // inventory-manager (REQ-F-039, RF-17 y CA-17; decisión P-1): solo contracts y web.
  describe('inventory-manager: solo contracts y web', () => {
    it.each([
      ['core', "import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS')],
      ['core/catalog', "import { createProductRepository } from '@restaurante/core/catalog';" + use('createProductRepository')],
      ['db', "import { createPrismaClient } from '@restaurante/db/client';" + use('createPrismaClient')],
      ['Prisma', "import { PrismaClient } from '@prisma/client';" + use('PrismaClient')],
      ['mariadb', "import { createConnection } from 'mariadb';" + use('createConnection')],
      ['la api (relativo)', "import { createApiApp } from '../../api/src/app.ts';" + use('createApiApp')],
      ['landing-pages (relativo)', "import { createApp } from '../../landing-pages/src/app.ts';" + use('createApp')],
      ['un archivo de packages/ por ruta relativa', "import { adminPaths } from '../../packages/contracts/admin.ts';" + use('adminPaths')],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.inventory)).length).toBeGreaterThan(0);
    });

    // DEF-004 de QA: los import() dinámicos también se revisan.
    it.each([
      ['import() de core', "export const later = import('@restaurante/core/shared');\n"],
      ['import() de db', "export const later = import('@restaurante/db/client');\n"],
      ['import() de Prisma', "export const later = import('@prisma/client');\n"],
      ['import() de la api', "export const later = import('../../api/src/app.ts');\n"],
      ['import() de un archivo de packages/', "export const later = import('../../packages/contracts/admin.ts');\n"],
    ])('rechaza %s', async (_name, code) => {
      expect((await violations(code, AS.inventory)).length).toBeGreaterThan(0);
    });

    it('permite import() de contracts y de web', async () => {
      expect(await violations("export const later = import('@restaurante/contracts');\nexport const web = import('@restaurante/web');\n", AS.inventory)).toEqual([]);
    });

    it('también en sus pruebas', async () => {
      expect((await violations("import { BUSINESS } from '@restaurante/core/shared';" + use('BUSINESS'), AS.inventoryTest)).length).toBeGreaterThan(0);
    });

    it.each([
      ['contracts', "import { createAdminApiClient } from '@restaurante/contracts';" + use('createAdminApiClient')],
      ['web', "import { createRenderer } from '@restaurante/web';" + use('createRenderer')],
      ['koa', "import Koa from 'koa';" + use('Koa')],
      ['un archivo de la app', "import { loadInventoryConfig } from './config.ts';" + use('loadInventoryConfig')],
    ])('permite %s', async (_name, code) => {
      expect(await violations(code, AS.inventory)).toEqual([]);
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
