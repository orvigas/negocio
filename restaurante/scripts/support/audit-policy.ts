/**
 * Política de auditoría de dependencias del CI (REQ-F-020). Sin E/S: recibe la salida de
 * `npm audit --json` de cada corte, el documento de excepciones y la fecha de hoy, y decide.
 *
 * - Cortes `production` (imagen production: --omit=dev --omit=optional) y `migrate` (imagen
 *   migrate: --omit=dev): un aviso `high` o `critical` sin excepción vigente rompe el CI (RF-1, RF-2).
 * - Corte `desarrollo` (todo el árbol) y avisos `moderate`, `low` o `info`: solo informan (RF-3).
 * - Excepciones (RF-4): GHSA, paquete, justificación, aprobador y fechas. Una excepción inválida,
 *   vencida o con más de 30 días de plazo rompe el CI; una sin uso se informa para retirarla.
 * - Fail closed (RF-9): si un corte no trae un informe válido de npm audit, el CI falla.
 */

export const CUTS = ['production', 'migrate', 'desarrollo'] as const;
export type Cut = (typeof CUTS)[number];

/** Cortes que bloquean: los que llegan a una imagen desplegada. */
export const BLOCKING_CUTS: readonly Cut[] = Object.freeze(['production', 'migrate']);

/** Argumentos de `npm audit` de cada corte (los mismos `--omit` que el Dockerfile). */
export const CUT_ARGS: Readonly<Record<Cut, readonly string[]>> = Object.freeze({
  production: ['--omit=dev', '--omit=optional'],
  migrate: ['--omit=dev'],
  desarrollo: ['--include=dev', '--include=optional'],
});

export const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
const BLOCKING_SEVERITIES: readonly Severity[] = ['high', 'critical'];

export const MAX_EXCEPTION_DAYS = 30;
export const GHSA_PATTERN = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export interface Advisory {
  /** GHSA del aviso, o `npm-<id>` si npm no da un GHSA (no admite excepción). */
  id: string;
  package: string;
  severity: Severity;
  title: string;
  range: string;
}

export interface AuditException {
  ghsa: string;
  package: string;
  justification: string;
  approvedBy: string;
  approvedOn: string;
  reviewBy: string;
}

export interface CutOutput {
  cut: Cut;
  /** stdout de `npm audit --json` (vacío si no hubo salida). */
  output: string;
  /** Motivo si el proceso no terminó (tiempo agotado, npm ausente...). */
  runError?: string;
}

export interface Finding extends Advisory {
  cut: Cut;
}

export interface Evaluation {
  ok: boolean;
  /** Motivos por los que el CI falla. */
  failures: string[];
  blocking: Finding[];
  excepted: Finding[];
  informative: Finding[];
  /** Excepciones válidas que no excusan ningún aviso: retirarlas. */
  unused: AuditException[];
}

export class AuditOutputError extends Error {
  override name = 'AuditOutputError';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSeverity = (value: unknown): value is Severity => typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);

/**
 * Avisos de una salida de `npm audit --json` (formato v2). Solo cuentan las entradas de `via` que
 * son objetos (el aviso en sí); las cadenas son la herencia de una dependencia y no se repiten.
 * @throws {AuditOutputError} si la salida no es un informe completo (fail closed).
 */
export function parseAuditReport(output: string): Advisory[] {
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch {
    throw new AuditOutputError('la salida de npm audit no es JSON');
  }
  if (!isRecord(data)) throw new AuditOutputError('la salida de npm audit no es un objeto');
  if ('error' in data) {
    const message = typeof data.message === 'string' && data.message ? `: ${data.message}` : '';
    throw new AuditOutputError(`npm audit no pudo consultar el registro${message}`);
  }
  if (data.auditReportVersion !== 2) throw new AuditOutputError('formato de informe de npm audit desconocido (se espera auditReportVersion 2)');
  if (!isRecord(data.vulnerabilities) || !isRecord(data.metadata) || !isRecord(data.metadata.vulnerabilities)) {
    throw new AuditOutputError('el informe de npm audit está incompleto (sin vulnerabilities o metadata)');
  }

  const advisories = new Map<string, Advisory>();
  for (const [name, entry] of Object.entries(data.vulnerabilities)) {
    if (!isRecord(entry) || !Array.isArray(entry.via)) throw new AuditOutputError(`entrada inválida en el informe de npm audit: ${name}`);
    for (const via of entry.via as unknown[]) {
      if (typeof via === 'string') continue;
      if (!isRecord(via) || !isSeverity(via.severity)) throw new AuditOutputError(`aviso inválido en el informe de npm audit: ${name}`);
      const url = typeof via.url === 'string' ? via.url : '';
      const ghsa = /GHSA(-[0-9a-z]{4}){3}$/.exec(url)?.[0];
      const id = ghsa ?? `npm-${String(via.source)}`;
      const pkg = typeof via.name === 'string' && via.name ? via.name : name;
      advisories.set(`${id} ${pkg}`, {
        id,
        package: pkg,
        severity: via.severity,
        title: typeof via.title === 'string' ? via.title : '',
        range: typeof via.range === 'string' ? via.range : '',
      });
    }
  }
  return [...advisories.values()];
}

function parseDate(value: string): number | undefined {
  if (!DATE_PATTERN.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) return undefined;
  return time;
}

const EXCEPTION_FIELDS = ['ghsa', 'package', 'justification', 'approvedBy', 'approvedOn', 'reviewBy'] as const;

/**
 * Valida el documento de excepciones contra la fecha de hoy (`AAAA-MM-DD`, UTC).
 * Devuelve las excepciones válidas y los problemas (cada problema rompe el CI).
 */
export function parseExceptions(document: unknown, today: string): { exceptions: AuditException[]; problems: string[] } {
  const problems: string[] = [];
  const exceptions: AuditException[] = [];
  const todayTime = parseDate(today);
  if (todayTime === undefined) throw new Error(`Fecha de hoy inválida: ${today}`);

  if (!isRecord(document) || !Array.isArray(document.exceptions) || Object.keys(document).some((key) => key !== 'exceptions')) {
    return { exceptions, problems: ['El archivo de excepciones debe ser un objeto con una sola clave, "exceptions", que sea una lista.'] };
  }

  const seen = new Set<string>();
  (document.exceptions as unknown[]).forEach((raw, index) => {
    const where = `Excepción ${index + 1}`;
    if (!isRecord(raw)) {
      problems.push(`${where}: no es un objeto.`);
      return;
    }
    const label = typeof raw.ghsa === 'string' && raw.ghsa.trim() ? `${where} (${raw.ghsa.trim()})` : where;
    const own: string[] = [];
    const unknown = Object.keys(raw).filter((key) => !(EXCEPTION_FIELDS as readonly string[]).includes(key));
    if (unknown.length > 0) own.push(`campos desconocidos: ${unknown.join(', ')}`);
    const value: Partial<Record<(typeof EXCEPTION_FIELDS)[number], string>> = {};
    for (const field of EXCEPTION_FIELDS) {
      const fieldValue = raw[field];
      if (typeof fieldValue !== 'string' || fieldValue.trim() === '') own.push(`falta "${field}" o está vacío`);
      else value[field] = fieldValue.trim();
    }
    if (value.ghsa !== undefined && !GHSA_PATTERN.test(value.ghsa)) own.push('"ghsa" no tiene el formato GHSA-xxxx-xxxx-xxxx');

    const approved = value.approvedOn === undefined ? undefined : parseDate(value.approvedOn);
    const review = value.reviewBy === undefined ? undefined : parseDate(value.reviewBy);
    if (value.approvedOn !== undefined && approved === undefined) own.push('"approvedOn" no es una fecha AAAA-MM-DD válida');
    if (value.reviewBy !== undefined && review === undefined) own.push('"reviewBy" no es una fecha AAAA-MM-DD válida');
    if (approved !== undefined && approved > todayTime) own.push(`"approvedOn" (${value.approvedOn}) es posterior a hoy (${today})`);
    if (approved !== undefined && review !== undefined) {
      if (review < approved) own.push('"reviewBy" es anterior a "approvedOn"');
      else if ((review - approved) / DAY_MS > MAX_EXCEPTION_DAYS) own.push(`el plazo supera los ${MAX_EXCEPTION_DAYS} días desde "approvedOn"`);
    }
    if (review !== undefined && review < todayTime) own.push(`venció el ${value.reviewBy}: renuévala con una aprobación nueva o retírala`);

    if (value.ghsa !== undefined && value.package !== undefined) {
      const key = `${value.ghsa} ${value.package}`;
      if (seen.has(key)) own.push(`repetida (${value.ghsa} en ${value.package})`);
      seen.add(key);
    }

    if (own.length > 0) {
      problems.push(`${label}: ${own.join('; ')}.`);
      return;
    }
    // Todos los campos están validados arriba (own vacío).
    exceptions.push(value as AuditException);
  });
  return { exceptions, problems };
}

/** Aplica la política a la salida de cada corte y al documento de excepciones. */
export function evaluate({ cuts, exceptionsDocument, today }: { cuts: readonly CutOutput[]; exceptionsDocument: unknown; today: string }): Evaluation {
  const failures: string[] = [];
  const blocking: Finding[] = [];
  const excepted: Finding[] = [];
  const informative: Finding[] = [];

  const { exceptions, problems } = parseExceptions(exceptionsDocument, today);
  failures.push(...problems);
  const used = new Set<AuditException>();

  for (const cut of CUTS) {
    const outputs = cuts.filter((item) => item.cut === cut);
    if (outputs.length !== 1) {
      failures.push(`Corte ${cut}: se esperaba un resultado de npm audit y hay ${outputs.length}.`);
      continue;
    }
    const [{ output, runError }] = outputs as [CutOutput];
    let advisories: Advisory[];
    try {
      if (runError !== undefined && output.trim() === '') throw new AuditOutputError(runError);
      advisories = parseAuditReport(output);
    } catch (err) {
      const reason = err instanceof AuditOutputError ? err.message : 'error inesperado al leer el informe';
      failures.push(`Corte ${cut}: la auditoría no se completó (${reason}). Relanza el job cuando el registro de npm responda.`);
      continue;
    }

    for (const advisory of advisories) {
      const finding: Finding = { ...advisory, cut };
      if (!BLOCKING_CUTS.includes(cut) || !BLOCKING_SEVERITIES.includes(advisory.severity)) {
        informative.push(finding);
        continue;
      }
      const exception = exceptions.find((item) => item.ghsa === advisory.id && item.package === advisory.package);
      if (exception) {
        used.add(exception);
        excepted.push(finding);
      } else {
        blocking.push(finding);
        failures.push(`Corte ${cut}: ${advisory.id} (${advisory.severity}) en ${advisory.package} ${advisory.range} sin excepción vigente.`);
      }
    }
  }

  return { ok: failures.length === 0, failures, blocking, excepted, informative, unused: exceptions.filter((item) => !used.has(item)) };
}

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ');

function table(findings: readonly Finding[]): string[] {
  if (findings.length === 0) return ['Ninguno.', ''];
  return [
    '| Corte | Aviso | Severidad | Paquete | Rango | Título |',
    '| --- | --- | --- | --- | --- | --- |',
    ...findings.map((f) => `| ${f.cut} | ${f.id} | ${f.severity} | ${cell(f.package)} | ${cell(f.range)} | ${cell(f.title)} |`),
    '',
  ];
}

/** Resumen en Markdown para `$GITHUB_STEP_SUMMARY` y la consola. */
export function renderSummary(result: Evaluation): string {
  const lines = [`## Auditoría de dependencias: ${result.ok ? 'sin bloqueos' : 'FALLA'}`, ''];
  if (result.failures.length > 0) lines.push('### Motivos del fallo', '', ...result.failures.map((f) => `- ${f}`), '');
  lines.push('### Bloquean (high o critical en production o migrate)', '', ...table(result.blocking));
  lines.push('### Aceptados por una excepción vigente', '', ...table(result.excepted));
  lines.push('### Informativos (desarrollo, o moderate y menores)', '', ...table(result.informative));
  if (result.unused.length > 0) {
    lines.push('### Excepciones sin uso (retirarlas)', '', ...result.unused.map((e) => `- ${e.ghsa} en ${e.package} (revisión: ${e.reviewBy})`), '');
  }
  return lines.join('\n');
}
