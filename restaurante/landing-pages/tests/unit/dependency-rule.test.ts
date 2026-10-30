import { describe, expect, it } from 'vitest';

import { AS, violations, use } from '../support/dependency-rule.ts';

/** *
 * REQ-F-041: parte de dependency-rule.test.ts (preparación en tests/support/dependency-rule.ts).
 */

/**
 * Regla de dependencias entre paquetes (REQ-F-037, RF-6 y CA-6; restaurante/docs/arquitectura.md §4):
 * `npm run lint` rechaza los imports que la rompen. Se usa la configuración real (eslint.config.ts de
 * la raíz).
 *
 * El código de ejemplo se revisa "como si" fuera un archivo existente de cada paquete: el servicio de
 * proyectos de typescript-eslint solo acepta rutas que existen y están en un tsconfig.json.
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
});
