import { createPrismaClient } from '@restaurante/db/client';
import type { DatabaseConfig } from '@restaurante/db/database-config';

/**
 * Esperas de bloqueo largas con MySQL real (REQ-F-014, casos límite y desviación aprobada: sin
 * `innodb_lock_wait_timeout` en la sesión). Lo comparten los archivos `db-lock-wait-*.test.ts`
 * (REQ-F-041: antes, un solo archivo).
 *
 * Otra conexión mantiene un bloqueo de fila (SELECT … FOR UPDATE) mientras la app escribe y lo
 * libera a los HOLD_MS. El MySQL de pruebas (compose.yaml) corta la espera a los 5 s
 * (`innodb_lock_wait_timeout`, como en producción, donde vale 10 s: deploy/compose.prod.yaml), antes
 * de liberar el bloqueo: la espera vence con el bloqueo todavía puesto.
 */

/** Retención del bloqueo: más larga que `innodb_lock_wait_timeout` del MySQL de pruebas. */
export const HOLD_MS = 6000;

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Falla si el MySQL de pruebas no corta la espera antes de liberar el bloqueo (p. ej. un
 * contenedor creado antes de REQ-F-041, con los 50 s por defecto): sin esto, la prueba pasaría sin
 * que ninguna espera llegara a vencer.
 */
export async function expectLockWaitBelowHold(config: DatabaseConfig): Promise<void> {
  const client = createPrismaClient(config);
  try {
    const [row] = await client.$queryRawUnsafe<{ timeout: unknown }[]>('SELECT @@GLOBAL.innodb_lock_wait_timeout AS timeout');
    const seconds = Number(row?.timeout);
    if (!(seconds * 1000 < HOLD_MS)) {
      throw new Error(
        `innodb_lock_wait_timeout del MySQL de pruebas es ${String(seconds)} s; debe ser menor que ${String(HOLD_MS / 1000)} s. Recrea el contenedor con \`npm run db:up\` (compose.yaml).`,
      );
    }
  } finally {
    await client.$disconnect();
  }
}

/**
 * Bloquea filas desde otra conexión (otro pool, como otro proceso) hasta llamar a la función
 * devuelta. La registra también en `cleanups` (se libera al terminar la prueba aunque falle).
 */
export async function holdLock(cleanups: (() => Promise<void>)[], config: DatabaseConfig, sql: string, ...values: unknown[]) {
  const client = createPrismaClient(config);
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let acquired!: () => void;
  const locked = new Promise<void>((resolve) => (acquired = resolve));
  const transaction = client.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(sql, ...values);
      acquired();
      await released;
    },
    { maxWait: 5000, timeout: 120_000 },
  );
  await locked;
  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    release();
    await transaction;
    await client.$disconnect();
  };
  cleanups.push(finish);
  return finish;
}
