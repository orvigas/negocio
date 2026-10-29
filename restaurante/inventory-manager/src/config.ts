import { isIP } from 'node:net';

/**
 * Configuración del admin nuevo (REQ-F-039): solo sus variables, validadas al arrancar (fallo
 * rápido). No tiene credenciales de la base ni la del aviso interno: todo lo pide a la API.
 */

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const INVENTORY_DEFAULTS = Object.freeze({ HOST: '127.0.0.1', PORT: 3003 });

export interface InventoryConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  /** API_INTERNAL_URL: base de la API (sin barra final). */
  readonly apiInternalUrl: string;
  /** TRUST_PROXY: detrás de Traefik, HTTPS e IP del visitante salen de X-Forwarded-*. */
  readonly trustProxy: boolean;
}

export class InventoryConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuración del admin inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'InventoryConfigError';
    this.issues = issues;
  }
}

type Env = Readonly<Record<string, string | undefined>>;

function readVar(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

function parseApiUrl(raw: string | undefined, issues: string[]): string | undefined {
  const format = 'URL http(s) sin credenciales, query ni fragmento (p. ej. http://api:3001)';
  if (raw === undefined) {
    issues.push(`API_INTERNAL_URL es obligatoria (${format})`);
    return undefined;
  }
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' || raw.includes('?') || raw.includes('#')) {
    issues.push(`API_INTERNAL_URL no es válida (${format})`);
    return undefined;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** @throws {InventoryConfigError} */
export function loadInventoryConfig(env: Env = process.env): InventoryConfig {
  const issues: string[] = [];

  const nodeEnv = readVar(env, 'NODE_ENV');
  if (nodeEnv === undefined || !isNodeEnv(nodeEnv)) issues.push(`NODE_ENV es obligatorio: debe ser uno de ${NODE_ENVS.join(', ')}`);

  const host = readVar(env, 'HOST') ?? INVENTORY_DEFAULTS.HOST;
  if (isIP(host) === 0) issues.push('HOST debe ser una IP literal IPv4 o IPv6 (p. ej. 127.0.0.1 o 0.0.0.0), no un nombre de máquina');

  const rawPort = readVar(env, 'PORT');
  const port = rawPort === undefined ? INVENTORY_DEFAULTS.PORT : /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push('PORT debe ser un entero entre 1 y 65535');

  const apiInternalUrl = parseApiUrl(readVar(env, 'API_INTERNAL_URL'), issues);

  const rawProxy = readVar(env, 'TRUST_PROXY') ?? 'false';
  if (rawProxy !== 'true' && rawProxy !== 'false') issues.push('TRUST_PROXY debe ser true o false');

  if (issues.length > 0 || nodeEnv === undefined || !isNodeEnv(nodeEnv) || apiInternalUrl === undefined) throw new InventoryConfigError(issues);
  return Object.freeze({ nodeEnv, isProduction: nodeEnv === 'production', host, port, apiInternalUrl, trustProxy: rawProxy === 'true' });
}
