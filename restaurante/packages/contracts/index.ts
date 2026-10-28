// Contratos de la API (restaurante/docs/arquitectura.md §5). Paso 3 (REQ-F-038): el endpoint público
// de productos, con Zod (decisión C), y su cliente HTTP. Paso 4 (REQ-F-039): la API de administración,
// su cliente y el formulario de producto del admin.
export * from './admin.ts';
export * from './admin-client.ts';
export * from './product-form.ts';
export * from './products.ts';
export * from './public-client.ts';
