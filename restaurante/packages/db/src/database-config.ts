/**
 * Conexión a MySQL (REQ-F-014, RF-5), a partir de DATABASE_URL. Contiene la contraseña: nunca se
 * registra ni se incluye en errores o respuestas.
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

const DATABASE_NAME = /^[A-Za-z0-9_]{1,64}$/;
const DATABASE_URL_FORMAT = 'mysql://usuario:contraseña@host:puerto/base, sin parámetros; los caracteres especiales de la contraseña van codificados (%40 para @)';

/**
 * URL de MySQL (REQ-F-014, RF-5): `mysql://usuario:contraseña@host[:puerto]/base`, sin parámetros
 * (las opciones de conexión las fija client.ts). Los mensajes nunca incluyen el valor. La usan
 * landing-pages, api y el soporte de pruebas (movida desde landing-pages/src/config/env.ts en REQ-F-038).
 */
export function parseDatabaseUrl(raw: string | undefined, name: string, issues: string[]): DatabaseConfig | undefined {
  if (raw === undefined) {
    issues.push(`${name} es obligatoria (${DATABASE_URL_FORMAT})`);
    return undefined;
  }
  const invalid = (): undefined => {
    issues.push(`${name} no es válida (${DATABASE_URL_FORMAT})`);
    return undefined;
  };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalid();
  }
  if (url.protocol !== 'mysql:' || url.hostname === '' || url.username === '' || url.search !== '' || url.hash !== '') return invalid();
  const port = url.port === '' ? 3306 : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return invalid();
  const database = url.pathname.replace(/^\//, '');
  if (!DATABASE_NAME.test(database)) return invalid();
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    return invalid();
  }
  // IPv6 entre corchetes en la URL ([::1]); el driver espera la dirección sin ellos.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  return Object.freeze({ host, port, user, password, database });
}
