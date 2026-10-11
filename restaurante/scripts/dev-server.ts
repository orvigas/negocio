/**
 * Punto de entrada de `npm run dev` (REQ-F-015, RF-4). Node ya cargó el .env
 * (--env-file-if-exists), así que aquí NODE_ENV queda en development siempre, aunque el .env o el
 * entorno digan otra cosa. Solo desarrollo: no entra en la imagen de producción.
 */
process.env.NODE_ENV = 'development';

await import('../src/server.ts');
