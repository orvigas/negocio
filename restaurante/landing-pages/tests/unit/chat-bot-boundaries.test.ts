import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';

/**
 * Fronteras de la interfaz `ChatBot` (REQ-F-012, CA-17 y CA-21), comprobadas sobre los imports
 * reales de src/:
 * - solo providers/select.ts importa las implementaciones (`WhatsAppBot`, `TwilioBot`);
 * - app.ts, las rutas y los controladores no importan nada de un proveedor concreto;
 * - ningún módulo de la conversación compartida importa de providers/.
 */

const SRC = join(PROJECT_DIR, 'src');
const BOT_DIR = join(SRC, 'services', 'whatsapp-bot');
const PROVIDERS = join(BOT_DIR, 'providers');
const IMPLEMENTATIONS = [join(PROVIDERS, 'meta', 'whatsapp-bot.ts'), join(PROVIDERS, 'twilio', 'twilio-bot.ts')];
const SELECTOR = join(PROVIDERS, 'select.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** Rutas absolutas de los imports relativos de un archivo (estáticos, dinámicos y `export ... from`). */
function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  const specifiers = [...code.matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((match) => match[1] as string);
  return specifiers.map((specifier) => resolve(dirname(file), specifier));
}

const FILES = sourceFiles(SRC);
const rel = (path: string): string => relative(PROJECT_DIR, path);
const isInside = (path: string, dir: string): boolean => !relative(dir, path).startsWith('..');

describe('fronteras de ChatBot (REQ-F-012)', () => {
  it('encuentra los archivos que comprueba', () => {
    for (const file of [...IMPLEMENTATIONS, SELECTOR, join(SRC, 'app.ts'), join(BOT_DIR, 'orchestrator.ts')]) expect(FILES).toContain(file);
  });

  it('CA-17: solo providers/select.ts importa WhatsAppBot y TwilioBot', () => {
    const importers = FILES.filter((file) => importsOf(file).some((target) => IMPLEMENTATIONS.includes(target))).map(rel);
    expect(importers).toEqual([rel(SELECTOR)]);
  });

  it('CA-17: app.ts, las rutas y los controladores no importan nada de providers/meta ni providers/twilio', () => {
    const consumers = FILES.filter((file) => file === join(SRC, 'app.ts') || isInside(file, join(SRC, 'routes')) || isInside(file, join(SRC, 'controllers')));
    const offending = consumers.filter((file) => importsOf(file).some((target) => isInside(target, join(PROVIDERS, 'meta')) || isInside(target, join(PROVIDERS, 'twilio'))));
    expect(offending.map(rel)).toEqual([]);
  });

  it('CA-21: ningún módulo de la conversación compartida importa de providers/', () => {
    const shared = FILES.filter((file) => isInside(file, BOT_DIR) && !isInside(file, PROVIDERS));
    expect(shared.length).toBeGreaterThan(5);
    const offending = shared.filter((file) => importsOf(file).some((target) => isInside(target, PROVIDERS)));
    expect(offending.map(rel)).toEqual([]);
  });
});
