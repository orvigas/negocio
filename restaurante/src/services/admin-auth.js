import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Credencial común de administración (REQ-F-001, RF-5 y DT-2).
 * La contraseña se configura como hash scrypt (ADMIN_PASSWORD_HASH), nunca en claro:
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 * Se genera con `npm run admin:hash-password`.
 */

const scrypt = promisify(scryptCallback);

export const SCRYPT_DEFAULTS = Object.freeze({ N: 2 ** 15, r: 8, p: 1, saltLength: 16, keyLength: 32 });

const LIMITS = Object.freeze({ minLogN: 14, maxLogN: 20, maxR: 32, maxP: 16, minSalt: 16, minKey: 32, maxKey: 64 });
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const POSITIVE_INT = /^[1-9]\d*$/;

const scryptOptions = ({ N, r, p }) => ({ N, r, p, maxmem: 256 * N * r });

/**
 * @param {string} text
 * @returns {{ N: number, r: number, p: number, salt: Buffer, hash: Buffer } | null}
 */
export function parsePasswordHash(text) {
  if (typeof text !== 'string') return null;
  const parts = text.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
  if (![rawN, rawR, rawP].every((value) => POSITIVE_INT.test(value))) return null;
  if (!BASE64URL.test(rawSalt) || !BASE64URL.test(rawHash)) return null;

  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  const logN = Math.log2(N);
  if (!Number.isInteger(logN) || logN < LIMITS.minLogN || logN > LIMITS.maxLogN) return null;
  if (r > LIMITS.maxR || p > LIMITS.maxP) return null;

  const salt = Buffer.from(rawSalt, 'base64url');
  const hash = Buffer.from(rawHash, 'base64url');
  if (salt.length < LIMITS.minSalt || hash.length < LIMITS.minKey || hash.length > LIMITS.maxKey) return null;
  return { N, r, p, salt, hash };
}

/** Genera el valor de ADMIN_PASSWORD_HASH. */
export async function hashPassword(password, { N, r, p, saltLength, keyLength } = SCRYPT_DEFAULTS) {
  if (typeof password !== 'string' || password.length === 0) throw new TypeError('La contraseña no puede estar vacía');
  const salt = randomBytes(saltLength);
  const hash = await scrypt(password.normalize('NFC'), salt, keyLength, scryptOptions({ N, r, p }));
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Compara dos textos en tiempo constante (sobre sus resúmenes, que tienen la misma longitud). */
export function safeEqualStrings(a, b) {
  const digest = (value) => createHash('sha256').update(String(value), 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * @param {{ user: string, passwordHash: string }} credentials
 */
export function createAdminAuthenticator({ user, passwordHash }) {
  const parsed = parsePasswordHash(passwordHash);
  if (!parsed || typeof user !== 'string' || user === '') throw new TypeError('Credenciales de administración inválidas');

  return Object.freeze({
    /** Siempre ejecuta scrypt, aunque el usuario no coincida, para no revelar cuál falló. */
    async verify(username, password) {
      const candidate = typeof password === 'string' ? password.normalize('NFC') : '';
      const derived = await scrypt(candidate, parsed.salt, parsed.hash.length, scryptOptions(parsed));
      const passwordOk = timingSafeEqual(derived, parsed.hash);
      const userOk = safeEqualStrings(typeof username === 'string' ? username : '', user);
      return passwordOk && userOk;
    },
  });
}
