import { describe, expect, it } from 'vitest';

import {
  CUT_ARGS,
  evaluate,
  parseAuditReport,
  parseExceptions,
  renderSummary,
  type AuditException,
  type Cut,
  type CutOutput,
  type Severity,
} from '../../scripts/support/audit-policy.ts';

// Política de auditoría del CI (REQ-F-020). Las salidas de npm audit son fixtures reducidos: nunca
// se consulta el registro.

const TODAY = '2026-10-14';

interface Via {
  ghsa: string;
  pkg: string;
  severity: Severity;
}

/** Salida de `npm audit --json` (v2) con los avisos indicados y, opcionalmente, herencias. */
function report(vias: readonly Via[], inherited: Record<string, string[]> = {}): string {
  const vulnerabilities: Record<string, unknown> = {};
  for (const via of vias) {
    const current = (vulnerabilities[via.pkg] as { via: unknown[] } | undefined) ?? { name: via.pkg, severity: via.severity, via: [] as unknown[] };
    current.via.push({ source: 1, name: via.pkg, dependency: via.pkg, title: `Aviso de ${via.pkg}`, url: `https://github.com/advisories/${via.ghsa}`, severity: via.severity, range: '<9.9.9' });
    vulnerabilities[via.pkg] = current;
  }
  for (const [pkg, from] of Object.entries(inherited)) vulnerabilities[pkg] = { name: pkg, severity: 'high', via: from };
  return JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: { high: vias.length } } });
}

const clean = report([]);

function cuts(outputs: Partial<Record<Cut, string>>): CutOutput[] {
  return (['production', 'migrate', 'desarrollo'] as const).map((cut) => ({ cut, output: outputs[cut] ?? clean }));
}

const HIGH: Via = { ghsa: 'GHSA-cqhc-2h57-wpxf', pkg: 'mariadb', severity: 'high' };
const CRITICAL: Via = { ghsa: 'GHSA-ggr8-5vv4-36mx', pkg: 'deepmerge-ts', severity: 'critical' };
const MODERATE: Via = { ghsa: 'GHSA-cx2f-j9fh-8g68', pkg: 'mariadb', severity: 'moderate' };

function exception(overrides: Partial<Record<keyof AuditException | 'expires', unknown>> = {}): Record<string, unknown> {
  return {
    ghsa: HIGH.ghsa,
    package: HIGH.pkg,
    justification: 'Sin TLS en la red interna; se corrige al subir el adaptador.',
    approvedBy: 'Orlando Villegas',
    approvedOn: '2026-10-01',
    reviewBy: '2026-10-31',
    ...overrides,
  };
}

const none = { exceptions: [] };

describe('cortes de la auditoría', () => {
  it('usan los mismos --omit que las imágenes del Dockerfile', () => {
    expect(CUT_ARGS.production).toEqual(['--omit=dev', '--omit=optional']);
    expect(CUT_ARGS.migrate).toEqual(['--omit=dev']);
  });
});

describe('umbral (CA-1 a CA-4)', () => {
  it.each(['production', 'migrate'] as const)('CA-1/CA-2: un high en %s sin excepción rompe el CI', (cut) => {
    const result = evaluate({ cuts: cuts({ [cut]: report([HIGH]) }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.blocking).toMatchObject([{ cut, id: HIGH.ghsa, package: 'mariadb' }]);
    expect(result.failures.join('\n')).toContain(`Corte ${cut}: ${HIGH.ghsa} (high) en mariadb`);
  });

  it('un critical también rompe el CI', () => {
    const result = evaluate({ cuts: cuts({ migrate: report([CRITICAL]) }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.blocking.map((f) => f.id)).toEqual([CRITICAL.ghsa]);
  });

  it('CA-3: un high solo de desarrollo informa y no rompe el CI', () => {
    const result = evaluate({ cuts: cuts({ desarrollo: report([HIGH, CRITICAL]) }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(true);
    expect(result.informative.map((f) => `${f.cut} ${f.id}`)).toEqual([`desarrollo ${HIGH.ghsa}`, `desarrollo ${CRITICAL.ghsa}`]);
    expect(renderSummary(result)).toContain(HIGH.ghsa);
  });

  it.each(['moderate', 'low', 'info'] as const)('CA-4: un %s en production informa y no rompe el CI', (severity) => {
    const result = evaluate({ cuts: cuts({ production: report([{ ...MODERATE, severity }]) }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(true);
    expect(result.informative).toMatchObject([{ cut: 'production', id: MODERATE.ghsa, severity }]);
  });

  it('las herencias (via de tipo cadena) no cuentan como avisos propios', () => {
    const output = report([HIGH], { '@prisma/adapter-mariadb': ['mariadb'], prisma: ['@prisma/config'] });
    expect(parseAuditReport(output)).toEqual([{ id: HIGH.ghsa, package: 'mariadb', severity: 'high', title: 'Aviso de mariadb', range: '<9.9.9' }]);
  });

  it('un aviso sin GHSA bloquea con su id de npm y no admite excepción', () => {
    const output = JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: { x: { via: [{ source: 1234, name: 'x', severity: 'high', url: 'https://npmjs.com/advisories/1234' }] } },
      metadata: { vulnerabilities: {} },
    });
    const result = evaluate({ cuts: cuts({ production: output }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.blocking.map((f) => f.id)).toEqual(['npm-1234']);
  });

  it('sin avisos, el CI queda en verde y el resumen lo dice', () => {
    const result = evaluate({ cuts: cuts({}), exceptionsDocument: none, today: TODAY });
    expect(result).toMatchObject({ ok: true, failures: [], blocking: [], unused: [] });
    expect(renderSummary(result)).toContain('sin bloqueos');
  });
});

describe('excepciones (CA-5 y CA-6)', () => {
  const withHigh = cuts({ production: report([HIGH]), migrate: report([HIGH]) });

  it('CA-5: con una excepción vigente, el CI queda en verde y el aviso aparece como aceptado', () => {
    const result = evaluate({ cuts: withHigh, exceptionsDocument: { exceptions: [exception()] }, today: TODAY });
    expect(result.ok).toBe(true);
    expect(result.excepted.map((f) => f.cut)).toEqual(['production', 'migrate']);
    expect(result.unused).toEqual([]);
  });

  it('la excepción solo cubre su GHSA y su paquete', () => {
    const otherPackage = evaluate({ cuts: cuts({ production: report([{ ...HIGH, pkg: 'mysql2' }]) }), exceptionsDocument: { exceptions: [exception()] }, today: TODAY });
    expect(otherPackage.ok).toBe(false);
    const otherGhsa = evaluate({ cuts: cuts({ production: report([CRITICAL]) }), exceptionsDocument: { exceptions: [exception()] }, today: TODAY });
    expect(otherGhsa.ok).toBe(false);
  });

  it('el día de revisión todavía vale y el plazo de 30 días exactos se admite', () => {
    const doc = { exceptions: [exception({ approvedOn: '2026-09-14', reviewBy: TODAY })] };
    expect(evaluate({ cuts: withHigh, exceptionsDocument: doc, today: TODAY }).ok).toBe(true);
  });

  it.each([
    ['vencida', { reviewBy: '2026-10-13' }, 'venció el 2026-10-13'],
    ['con más de 30 días de plazo', { approvedOn: '2026-10-01', reviewBy: '2026-11-01' }, 'supera los 30 días'],
    ['aprobada en el futuro', { approvedOn: '2026-10-15', reviewBy: '2026-10-20' }, 'posterior a hoy'],
    ['con la revisión antes de la aprobación', { approvedOn: '2026-10-10', reviewBy: '2026-10-09' }, 'anterior a "approvedOn"'],
  ])('CA-5: una excepción %s rompe el CI y el mensaje nombra el GHSA', (_, overrides, message) => {
    const result = evaluate({ cuts: withHigh, exceptionsDocument: { exceptions: [exception(overrides)] }, today: TODAY });
    expect(result.ok).toBe(false);
    const problem = result.failures.find((f) => f.startsWith('Excepción 1'));
    expect(problem).toContain(HIGH.ghsa);
    expect(problem).toContain(message);
  });

  it('una excepción vencida rompe el CI aunque su aviso ya no exista', () => {
    const result = evaluate({ cuts: cuts({}), exceptionsDocument: { exceptions: [exception({ reviewBy: '2026-10-01' })] }, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain(HIGH.ghsa);
  });

  it.each(['ghsa', 'package', 'justification', 'approvedBy', 'approvedOn', 'reviewBy'] as const)('CA-6: sin "%s" (o vacío) rompe el CI', (field) => {
    for (const value of [undefined, '', '   ', 7]) {
      const raw = exception({ [field]: value });
      if (value === undefined) delete raw[field];
      const result = evaluate({ cuts: withHigh, exceptionsDocument: { exceptions: [raw] }, today: TODAY });
      expect(result.ok).toBe(false);
      expect(result.failures.join('\n')).toContain(`falta "${field}" o está vacío`);
    }
  });

  it.each([
    ['un GHSA mal formado', { ghsa: 'CVE-2026-0001' }, 'formato GHSA'],
    ['una fecha inválida', { reviewBy: '2026-02-30' }, 'fecha AAAA-MM-DD válida'],
    ['un campo desconocido', { expires: '2026-10-31' }, 'campos desconocidos: expires'],
  ])('CA-6: %s rompe el CI', (_, overrides, message) => {
    const result = evaluate({ cuts: withHigh, exceptionsDocument: { exceptions: [exception(overrides)] }, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain(message);
  });

  it('una excepción repetida rompe el CI', () => {
    const { problems } = parseExceptions({ exceptions: [exception(), exception()] }, TODAY);
    expect(problems).toEqual([expect.stringContaining('repetida')]);
  });

  it.each([undefined, null, [], { exceptions: {} }, { exceptions: [], extra: 1 }, { exceptions: ['x'] }])('un documento de excepciones inválido (%j) rompe el CI', (document) => {
    expect(evaluate({ cuts: cuts({}), exceptionsDocument: document, today: TODAY }).ok).toBe(false);
  });

  it('una excepción vigente sin aviso presente se informa para retirarla, sin romper el CI', () => {
    const result = evaluate({ cuts: cuts({ desarrollo: report([HIGH]) }), exceptionsDocument: { exceptions: [exception()] }, today: TODAY });
    expect(result.ok).toBe(true);
    expect(result.unused.map((e) => e.ghsa)).toEqual([HIGH.ghsa]);
    expect(renderSummary(result)).toContain('Excepciones sin uso');
  });
});

describe('fail closed (CA-10)', () => {
  const registryError = JSON.stringify({ message: 'request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: getaddrinfo ENOTFOUND', error: { summary: '', detail: '' } });

  it.each([
    ['el registro no responde', registryError, 'no pudo consultar el registro'],
    ['la salida no es JSON', 'npm error audit endpoint returned an error', 'no es JSON'],
    ['la salida está vacía', '', 'no es JSON'],
    ['falta metadata', JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }), 'incompleto'],
    ['el formato es desconocido', JSON.stringify({ auditReportVersion: 1, advisories: {} }), 'formato de informe'],
    ['un aviso no tiene severidad válida', JSON.stringify({ auditReportVersion: 2, vulnerabilities: { x: { via: [{ name: 'x', severity: 'grave' }] } }, metadata: { vulnerabilities: {} } }), 'aviso inválido'],
  ])('si %s, el corte falla', (_, output, message) => {
    const result = evaluate({ cuts: cuts({ production: output }), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([expect.stringMatching(new RegExp(`^Corte production: la auditoría no se completó \\(.*${message}`))]);
  });

  it('si el proceso no terminó (tiempo agotado), el corte falla', () => {
    const result = evaluate({ cuts: [...cuts({}).filter((c) => c.cut !== 'migrate'), { cut: 'migrate', output: '', runError: 'tiempo agotado' }], exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([expect.stringContaining('Corte migrate: la auditoría no se completó (tiempo agotado)')]);
  });

  it('si falta el resultado de un corte, el CI falla', () => {
    const result = evaluate({ cuts: cuts({}).filter((c) => c.cut !== 'production'), exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([expect.stringContaining('Corte production: se esperaba un resultado')]);
  });

  it('el código de salida de npm no decide: un informe válido con avisos se evalúa', () => {
    const result = evaluate({ cuts: [...cuts({}).filter((c) => c.cut !== 'production'), { cut: 'production', output: report([MODERATE]), runError: 'npm terminó con 1' }], exceptionsDocument: none, today: TODAY });
    expect(result.ok).toBe(true);
  });
});
