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
});
