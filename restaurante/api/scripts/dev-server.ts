/**
 * Punto de entrada de `npm run dev:api` (REQ-F-038, RF-10): igual que el de landing-pages, fija
 * NODE_ENV=development aunque el .env diga otra cosa. Solo desarrollo: no entra en la imagen.
 */
process.env.NODE_ENV = 'development';

await import('../src/server.ts');
