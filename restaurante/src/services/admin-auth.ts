import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Contraseñas de la administración (REQ-F-001 DT-2 y REQ-F-007): siempre como hash scrypt,
 * nunca en claro:
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 * Es el formato de ADMIN_PASSWORD_HASH (`npm run admin:hash-password`, primer administrador) y
 * el que se guarda en la base de datos para cada usuario.
 */

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

export interface ParsedPasswordHash extends ScryptParams {
  salt: Buffer;
  hash: Buffer;
}

// promisify no conserva la sobrecarga con opciones de crypto.scrypt; esta es su firma real.
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export const SCRYPT_DEFAULTS = Object.freeze({ N: 2 ** 15, r: 8, p: 1, saltLength: 16, keyLength: 32 });

// maxSalt (REQ-F-014, P-3): el hash completo cabe en la columna `password_hash` (VARCHAR(255)).
const LIMITS = Object.freeze({ minLogN: 14, maxLogN: 20, maxR: 32, maxP: 16, minSalt: 16, maxSalt: 64, minKey: 32, maxKey: 64 });
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const POSITIVE_INT = /^[1-9]\d*$/;

const scryptOptions = ({ N, r, p }: ScryptParams): ScryptOptions => ({ N, r, p, maxmem: 256 * N * r });

export function parsePasswordHash(text: unknown): ParsedPasswordHash | null {
  if (typeof text !== 'string') return null;
  const parts = text.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  if (![rawN, rawR, rawP].every((value) => value !== undefined && POSITIVE_INT.test(value))) return null;
  if (rawSalt === undefined || rawHash === undefined || !BASE64URL.test(rawSalt) || !BASE64URL.test(rawHash)) {
    return null;
  }

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  const logN = Math.log2(N);
  if (!Number.isInteger(logN) || logN < LIMITS.minLogN || logN > LIMITS.maxLogN) return null;
  if (r > LIMITS.maxR || p > LIMITS.maxP) return null;

  const salt = Buffer.from(rawSalt, 'base64url');
  const hash = Buffer.from(rawHash, 'base64url');
  if (salt.length < LIMITS.minSalt || salt.length > LIMITS.maxSalt || hash.length < LIMITS.minKey || hash.length > LIMITS.maxKey) return null;
  return { N, r, p, salt, hash };
}

/** Genera el hash de una contraseña (ADMIN_PASSWORD_HASH o el de un usuario). */
export async function hashPassword(
  password: unknown,
  { N, r, p, saltLength, keyLength }: ScryptParams & { saltLength: number; keyLength: number } = SCRYPT_DEFAULTS,
): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) throw new TypeError('La contraseña no puede estar vacía');
  const salt = randomBytes(saltLength);
  const hash = await scrypt(password.normalize('NFC'), salt, keyLength, scryptOptions({ N, r, p }));
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Compara dos textos en tiempo constante (sobre sus resúmenes, que tienen la misma longitud). */
export function safeEqualStrings(a: unknown, b: unknown): boolean {
  const digest = (value: unknown) => createHash('sha256').update(String(value), 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Comprueba una contraseña contra un hash guardado, en tiempo constante. Un hash inválido nunca coincide. */
export async function verifyPassword(password: unknown, storedHash: unknown): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);
  const candidate = typeof password === 'string' ? password.normalize('NFC') : '';
  if (!parsed) return false;
  const derived = await scrypt(candidate, parsed.salt, parsed.hash.length, scryptOptions(parsed));
  return timingSafeEqual(derived, parsed.hash);
}

export type PasswordHashParams = typeof SCRYPT_DEFAULTS;

/** Usuario autenticado (lo mínimo que necesita el acceso). */
export interface AuthenticatedUser {
  id: number;
  sessionVersion: number;
}

/** Fuente de credenciales (el repositorio de usuarios). */
export interface CredentialSource<U extends AuthenticatedUser & { active: boolean }> {
  findCredentials(username: string): Promise<{ user: U; passwordHash: string } | null>;
}

export interface UserAuthenticator<U> {
  /** Devuelve el usuario si las credenciales son correctas y la cuenta está activa; si no, null. */
  authenticate(username: unknown, password: unknown): Promise<U | null>;
}

/**
 * Acceso por usuario (REQ-F-007, R-6 y DT-10). Siempre ejecuta scrypt (contra un hash ficticio
 * si el usuario no existe) y responde igual para una cuenta inexistente, una contraseña
 * incorrecta o una cuenta desactivada: no revela cuál falló.
 */
export function createUserAuthenticator<U extends AuthenticatedUser & { active: boolean }>({
  users,
  hashParams = SCRYPT_DEFAULTS,
  hash = hashPassword,
}: {
  users: CredentialSource<U>;
  hashParams?: PasswordHashParams;
  /** Generador del hash ficticio (inyectable en las pruebas). */
  hash?: typeof hashPassword;
}): UserAuthenticator<U> {
  // El hash ficticio se calcula al crear el autenticador (al arrancar la app, DT-10), no en el
  // primer acceso fallido: así ese primer acceso no tarda más que los demás.
  const dummyHash = hash(randomBytes(32).toString('base64url'), hashParams);
  // Si fallara, el error aparece en el primer acceso; evita un rechazo sin manejar al arrancar.
  dummyHash.catch(() => {});
  const dummy = () => dummyHash;

  return Object.freeze({
    async authenticate(username: unknown, password: unknown): Promise<U | null> {
      const name = typeof username === 'string' ? username : '';
      const found = name.trim() === '' ? null : await users.findCredentials(name);
      const ok = await verifyPassword(password, found ? found.passwordHash : await dummy());
      return found && ok && found.user.active ? found.user : null;
    },
  });
}
