// Barrera contra la fuga de datos reales del negocio al repositorio (REQ-F-050, A5 y H-11). Corre al
// inicio de `npm run lint`, así que también en el job de calidad del CI.
//
// Falla (código 1) si el índice de git contiene:
// - una hoja de cálculo (.xlsx, .xlsm, .xls, .ods): el libro de datos reales vive fuera del repositorio;
// - un JSON de importación (`"formato": "inventario-importacion"`) sin `"ficticio": true` o fuera de
//   la carpeta de fixtures ficticios de la api.
// El contenido se revisa tal como está en el índice (lo que se va a commitear) y, si existe, también
// en el árbol de trabajo (un `git commit -a` lo incluiría): DEF-002 del QA del PR 1 de REQ-F-050.
// Solo informa rutas: nunca imprime el contenido de un archivo.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SPREADSHEET = /\.(?:xlsx|xlsm|xls|ods)$/i;
const IMPORT_MARK = /"formato"\s*:\s*"inventario-importacion"/;
const FIXTURES_DIR = 'restaurante/api/tests/fixtures/inventory-import/';

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** ¿El texto es un JSON de importación que no se puede versionar ahí? Devuelve el motivo o null. */
function importProblem(text: string, path: string): string | null {
  if (!IMPORT_MARK.test(text)) return null;
  let fictitious: boolean;
  try {
    const parsed: unknown = JSON.parse(text);
    fictitious = typeof parsed === 'object' && parsed !== null && (parsed as Record<string, unknown>).ficticio === true;
  } catch {
    // Un JSON inválido con la marca de importación no se da por ficticio.
    fictitious = false;
  }
  if (!fictitious) return 'JSON de importación sin "ficticio": true (solo se versionan datos ficticios).';
  if (!path.startsWith(FIXTURES_DIR)) return `JSON de importación fuera de ${FIXTURES_DIR}.`;
  return null;
}

const root = git('rev-parse', '--show-toplevel').trim();
// Archivos del índice: los ya versionados y los preparados con `git add` para el próximo commit.
const tracked = git('-C', root, 'ls-files', '-z').split('\0').filter(Boolean);

const problems: string[] = [];
for (const path of tracked) {
  if (SPREADSHEET.test(path)) {
    problems.push(`${path}: hoja de cálculo versionada (los datos reales se quedan fuera del repositorio).`);
    continue;
  }
  if (!path.toLowerCase().endsWith('.json')) continue;
  // Contenido preparado (el blob del índice) y, si existe, el del árbol de trabajo.
  const staged = git('-C', root, 'cat-file', 'blob', `:${path}`);
  const file = join(root, path);
  const working = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const problem = importProblem(staged, path) ?? (working === null ? null : importProblem(working, path));
  if (problem) problems.push(`${path}: ${problem}`);
}

if (problems.length > 0) {
  console.error(`check-private-data: ${problems.length} archivo(s) con posibles datos privados:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('Sácalos del índice (git rm --cached <ruta>) y guárdalos fuera del repositorio (p. ej. /datos-privados/).');
  process.exit(1);
}
console.log(`check-private-data: ${tracked.length} archivos revisados, sin datos privados.`);
