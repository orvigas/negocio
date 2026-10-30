import { afterEach, describe, expect, it } from 'vitest';

import { NODE_ENV_VALUES, sentinel, boot, expectConfigFailure, expectStarted, scriptArgs, runCleanups } from '../support/server-startup-config.ts';

/**
 * REQ-F-015: arranque real de `node src/server.ts` (y de los scripts `start` y `dev` de
 * package.json) con NODE_ENV obligatorio y HOST. Los procesos no heredan el entorno del
 * desarrollador (ni su .env): los scripts usan un .env temporal.
 *
 * REQ-F-041: parte de server-startup-config.test.ts (preparación en
 * tests/support/server-startup-config.ts).
 */

afterEach(runCleanups);

describe('REQ-F-015: NODE_ENV obligatorio al arrancar', () => {
  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['solo espacios', '  '],
  ])('CA-1: NODE_ENV %s -> código 1, mensaje con los valores, sin puerto ni MySQL', async (_case, value) => {
    await expectConfigFailure({ NODE_ENV: value }, ['NODE_ENV', NODE_ENV_VALUES]);
  });

  it('REQ-F-025 (CA-14): un umbral del bot inválido impide arrancar con un mensaje claro, sin el valor', async () => {
    const output = await expectConfigFailure({ BOT_LIMIT_MESSAGES_PER_NUMBER_DAY: 'sesenta', BOT_BUDGET_MONTH_USD: '-20' }, [
      'BOT_LIMIT_MESSAGES_PER_NUMBER_DAY no es válida: entero de 5 a 10000',
      'BOT_BUDGET_MONTH_USD no es válida',
    ]);
    expect(output).not.toContain('sesenta');
  });

  it('CA-2: sin NODE_ENV y con PORT=abc el mensaje lista los dos problemas', async () => {
    const database = await sentinel();
    const server = await boot({ NODE_ENV: undefined, PORT: 'abc', DATABASE_URL: database.url });
    expect(await server.exited).toBe(1);
    const { stderr } = server.output();
    expect(stderr).toContain('NODE_ENV es obligatorio');
    expect(stderr).toContain('PORT debe ser');
    expect(stderr).not.toContain('abc');
    expect(database.connections()).toBe(0);
  });

  it('CA-14: npm start con un .env sin NODE_ENV no arranca; con NODE_ENV=production sí', async () => {
    const withoutNodeEnv = await scriptArgs('start', 'PORT=3000\n');
    await expectConfigFailure({ NODE_ENV: undefined }, ['NODE_ENV', NODE_ENV_VALUES], { args: withoutNodeEnv });

    const production = await scriptArgs('start', 'NODE_ENV=production\n');
    const { started } = await expectStarted({ NODE_ENV: undefined }, { args: production });
    expect(started).toMatchObject({ nodeEnv: 'production', host: '127.0.0.1' });
  }, 60_000);

  it('CA-4: npm run dev arranca con development aunque el .env no lo defina o diga production', async () => {
    for (const envFile of ['PORT=3000\n', 'NODE_ENV=production\n']) {
      const args = await scriptArgs('dev', envFile);
      expect(args).toContain('--watch');
      const { server, started } = await expectStarted({ NODE_ENV: undefined }, { args });
      expect(started).toMatchObject({ nodeEnv: 'development' });
      await server.stop();
    }
  }, 60_000);
});

describe('REQ-F-038 (CA-15): API_INTERNAL_URL obligatoria al arrancar', () => {
  it('ausente -> código 1 con un mensaje claro, sin puerto ni MySQL', async () => {
    await expectConfigFailure({ API_INTERNAL_URL: undefined }, ['API_INTERNAL_URL es obligatoria']);
  });

  it('inválida -> código 1 sin repetir el valor', async () => {
    const output = await expectConfigFailure({ API_INTERNAL_URL: 'ftp://usuario:clave-secreta@interno:21' }, ['API_INTERNAL_URL no es válida']);
    expect(output).not.toContain('clave-secreta');
    expect(output).not.toContain('interno:21');
  });
});
