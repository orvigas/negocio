/**
 * Logger estructurado mínimo (JSON por línea) sin dependencias.
 * Nunca registrar secretos, tokens ni datos personales: pasar solo campos necesarios.
 */

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: Infinity });

/** Serializa un Error sin propiedades arbitrarias (que podrían contener datos sensibles). */
export function serializeError(err) {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

/**
 * @param {{ level?: keyof LEVELS, write?: (line: string) => void }} [options]
 */
export function createLogger({ level = 'info', write = (line) => process.stdout.write(line) } = {}) {
  if (!Object.hasOwn(LEVELS, level)) throw new TypeError(`Nivel de log inválido: ${level}`);
  const threshold = LEVELS[level];

  const log = (lvl) => (msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    write(`${JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields })}\n`);
  };

  return Object.freeze({
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  });
}

export const silentLogger = createLogger({ level: 'silent' });
