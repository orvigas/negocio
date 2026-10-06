import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { prepareDatabase } from '../../src/db/migrate.ts';
import { databaseFile } from '../../src/db/paths.ts';
import { makeTempDir } from '../support/database.ts';

/**
 * Compatibilidad del aplicador propio con Prisma (REQ-F-007, Q-2 = B y RT-1): después de migrar
 * con src/db/migrate.ts, el CLI oficial reconoce la base como propia y el esquema resultante
 * coincide exactamente con prisma/schema.prisma. Si una versión futura de Prisma cambia el
 * formato de `_prisma_migrations`, esta prueba falla antes de llegar a producción.
 */

const run = promisify(execFile);
const PRISMA = join(PROJECT_DIR, 'node_modules', '.bin', 'prisma');

let dataDir: string;
let cleanup: () => Promise<void>;

function prisma(args: string[]) {
  return run(PRISMA, args, {
    cwd: PROJECT_DIR,
    // Sin telemetría ni avisos de actualización (también funciona sin red, p. ej. en Docker).
    env: { ...process.env, DATA_DIR: dataDir, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    timeout: 60_000,
  });
}

beforeAll(async () => {
  ({ dir: dataDir, cleanup } = await makeTempDir());
  await prepareDatabase({ file: databaseFile(dataDir) });
});
afterAll(() => cleanup());

describe('base migrada por el aplicador propio, vista por el CLI de Prisma', () => {
  it('prisma migrate status: al día', async () => {
    const { stdout } = await prisma(['migrate', 'status']);
    expect(stdout).toContain(databaseFile(dataDir));
    expect(stdout).toContain('Database schema is up to date!');
  }, 60_000);

  it('prisma migrate diff contra schema.prisma: sin diferencias (exit 0)', async () => {
    const { stdout } = await prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code']);
    expect(stdout).toContain('No difference detected');
  }, 60_000);
});
