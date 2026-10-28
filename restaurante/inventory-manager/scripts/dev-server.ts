/**
 * Punto de entrada de `npm run dev:inventory` (REQ-F-039): como el de landing-pages y el de la API,
 * fija NODE_ENV=development aunque el .env diga otra cosa. Solo desarrollo: no entra en la imagen.
 */
process.env.NODE_ENV = 'development';

await import('../src/server.ts');
