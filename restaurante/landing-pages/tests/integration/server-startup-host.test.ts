import { afterEach, describe, expect, it } from 'vitest';

import { externalIPv4, type LogLine, connects, expectStarted, runCleanups } from '../support/server-startup-config.ts';

/**
 * REQ-F-015: arranque real de `node src/server.ts` (y de los scripts `start` y `dev` de
 * package.json) con NODE_ENV obligatorio y HOST. Los procesos no heredan el entorno del
 * desarrollador (ni su .env): los scripts usan un .env temporal.
 *
 * REQ-F-041: parte de server-startup-config.test.ts (preparación en
 * tests/support/server-startup-config.ts).
 */

afterEach(runCleanups);

describe('REQ-F-015: HOST', () => {
  it.each([
    ['development', undefined],
    ['production', 'true'],
    ['test', 'false'],
  ])('CA-6: sin HOST, con NODE_ENV=%s y TRUST_PROXY=%s escucha solo en 127.0.0.1', async (nodeEnv, trustProxy) => {
    const { server, started } = await expectStarted({ NODE_ENV: nodeEnv, TRUST_PROXY: trustProxy });
    expect(started).toMatchObject({ host: '127.0.0.1', port: server.port, nodeEnv });
    const res = await fetch(`${server.url}/molotes`);
    expect(res.status).toBe(200);
  }, 60_000);

  it.runIf(externalIPv4 !== undefined)('CA-6: sin HOST no acepta conexiones por una interfaz que no es loopback', async () => {
    const { server } = await expectStarted({});
    expect(await connects('127.0.0.1', server.port)).toBe(true);
    expect(await connects(externalIPv4!, server.port)).toBe(false);
  });

  it('CA-7 y CA-13: HOST=0.0.0.0 con TRUST_PROXY=true escucha en todas las interfaces sin avisos adicionales', async () => {
    const baseline = await expectStarted({});
    const warnings = (lines: LogLine[]) => lines.filter((line) => line.level === 'warn').map((line) => line.msg);
    const expectedWarnings = warnings(baseline.lines());
    await baseline.server.stop();

    const { server, started, lines } = await expectStarted({ HOST: '0.0.0.0', TRUST_PROXY: 'true' });
    expect(started).toMatchObject({ host: '0.0.0.0', trustProxy: true });
    expect(await connects('127.0.0.1', server.port)).toBe(true);
    if (externalIPv4 !== undefined) expect(await connects(externalIPv4, server.port)).toBe(true);
    expect(warnings(lines())).toEqual(expectedWarnings);
  }, 60_000);
});
