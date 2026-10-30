import { expect } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { makeTempDir } from './database.ts';
import { startServer } from './process.ts';

/**
 * Arranque real según el proveedor del bot (QA de REQ-F-012) en los archivos
 * server-startup-provider-qa*.test.ts. REQ-F-041: preparación compartida por los archivos en que
 * se partió server-startup-provider-qa.test.ts, sin cambios.
 */

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

/** Copia del entorno sin las variables indicadas. */
export const without = (env: Readonly<Record<string, string>>, ...names: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter(([name]) => !names.includes(name)));

export const SECRET_VALUES = [
  BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
  BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID,
  BOT_ENV.WHATSAPP_BOT_APP_SECRET,
  BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN,
  TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID,
  TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
  TWILIO_BOT_ENV.WHATSAPP_BOT_WEBHOOK_URL,
  'tunel.example.com',
];

export async function boot(env: Record<string, string>) {
  const temp = await makeTempDir();
  cleanups.push(() => temp.cleanup());
  const server = await startServer({ DATA_DIR: temp.dir, ...env }, 20_000);
  cleanups.push(() => server.stop());
  return server;
}

export async function expectFailure(env: Record<string, string>, expected: (string | RegExp)[]) {
  const server = await boot(env);
  expect(server.started).toBe(false);
  expect(await server.exited).toBe(1);
  const { stdout, stderr } = server.output();
  const output = stdout + stderr;
  for (const text of expected) {
    if (typeof text === 'string') expect(output).toContain(text);
    else expect(output).toMatch(text);
  }
  for (const value of SECRET_VALUES) expect(output).not.toContain(value);
  return output;
}

export async function expectStart(env: Record<string, string>) {
  const server = await boot(env);
  expect(server.started).toBe(true);
  return server;
}

export const providerLines = (stdout: string) =>
  stdout
    .split('\n')
    .filter((line) => line.includes('bot_provider_selected'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
