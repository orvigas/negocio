import { isIP } from 'node:net';

import { parseDatabaseUrl, type DatabaseConfig } from '@restaurante/db/database-config';

/**
 * Configuración de la API (REQ-F-038): solo sus variables, validadas al arrancar (fallo rápido).
 * Los mensajes nunca repiten los valores (la URL de la base contiene la contraseña).
 */

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const API_DEFAULTS = Object.freeze({ HOST: '127.0.0.1', PORT: 3001 });

export interface ApiConfig {
  readonly nodeEnv: NodeEnv;
  readonly host: string;
  readonly port: number;
  readonly database: DatabaseConfig;
  /** DATABASE_ALLOW_NEWER_SCHEMA (REQ-F-016, D-1): solo la pone deploy.sh al volver atrás. */
  readonly allowNewerSchema: boolean;
}

export class ApiConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuración de la API inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'ApiConfigError';
    this.issues = issues;
  }
}

type Env = Readonly<Record<string, string | undefined>>;

function readVar(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

/** @throws {ApiConfigError} */
export function loadApiConfig(env: Env = process.env): ApiConfig {
  const issues: string[] = [];

  const nodeEnv = readVar(env, 'NODE_ENV');
  if (nodeEnv === undefined || !isNodeEnv(nodeEnv)) issues.push(`NODE_ENV es obligatorio: debe ser uno de ${NODE_ENVS.join(', ')}`);

  const host = readVar(env, 'HOST') ?? API_DEFAULTS.HOST;
  if (isIP(host) === 0) issues.push('HOST debe ser una IP literal IPv4 o IPv6 (p. ej. 127.0.0.1 o 0.0.0.0), no un nombre de máquina');

  const rawPort = readVar(env, 'PORT');
  const port = rawPort === undefined ? API_DEFAULTS.PORT : /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push('PORT debe ser un entero entre 1 y 65535');

  const database = parseDatabaseUrl(readVar(env, 'DATABASE_URL'), 'DATABASE_URL', issues);

  const rawAllow = readVar(env, 'DATABASE_ALLOW_NEWER_SCHEMA') ?? 'false';
  if (rawAllow !== 'true' && rawAllow !== 'false') issues.push('DATABASE_ALLOW_NEWER_SCHEMA debe ser true o false');

  if (issues.length > 0 || database === undefined || nodeEnv === undefined || !isNodeEnv(nodeEnv)) throw new ApiConfigError(issues);
  return Object.freeze({ nodeEnv, host, port, database, allowNewerSchema: rawAllow === 'true' });
}
