/**
 * Auditoría de dependencias por imagen (REQ-F-020).
 *
 *   npm run audit:deps
 *
 * Ejecuta `npm audit --json` sobre el package-lock.json de la raíz del monorepo (restaurante/) en
 * tres cortes (production, migrate y desarrollo), aplica la política de
 * scripts/support/audit-policy.ts con las excepciones de security/audit-exceptions.json (también
 * en la raíz) y escribe el resumen en la consola y, en el CI, en
 * $GITHUB_STEP_SUMMARY. Termina con 1 si algo bloquea o si la auditoría no se completó (fail
 * closed). No necesita node_modules ni ejecuta código de dependencias; nunca usa `npm audit fix`.
 */
import { execFile } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { CUT_ARGS, CUTS, evaluate, renderSummary, type Cut, type CutOutput } from './support/audit-policy.ts';

const run = promisify(execFile);
// Raíz del monorepo (REQ-F-036): ahí están el package-lock.json único y security/.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXCEPTIONS_FILE = join(root, 'security', 'audit-exceptions.json');
/** Tiempo máximo de cada `npm audit` (incluye los reintentos de red de npm). */
const AUDIT_TIMEOUT_MS = 180_000;

async function audit(cut: Cut): Promise<CutOutput> {
  const args = ['audit', '--json', ...CUT_ARGS[cut], '--fetch-retries=2', '--fetch-timeout=60000'];
  try {
    const { stdout } = await run('npm', args, { cwd: root, timeout: AUDIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    return { cut, output: stdout };
  } catch (err) {
    // npm audit termina con 1 cuando encuentra avisos: la salida JSON sigue siendo válida y la
    // decide la política. Sin salida (tiempo agotado, npm ausente), el corte falla.
    const failure = err as { stdout?: unknown; killed?: boolean; code?: unknown };
    const output = typeof failure.stdout === 'string' ? failure.stdout : '';
    const runError = failure.killed ? 'tiempo agotado' : `npm terminó con ${String(failure.code)}`;
    return { cut, output, runError };
  }
}

let exceptionsDocument: unknown;
try {
  exceptionsDocument = JSON.parse(await readFile(EXCEPTIONS_FILE, 'utf8'));
} catch {
  exceptionsDocument = undefined;
}

const cuts = await Promise.all(CUTS.map(audit));
const result = evaluate({ cuts, exceptionsDocument, today: new Date().toISOString().slice(0, 10) });
const summary = renderSummary(result);

process.stdout.write(`${summary}\n`);
const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) await appendFile(stepSummary, `${summary}\n`);
if (!result.ok) process.exitCode = 1;
