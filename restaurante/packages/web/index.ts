// Utilidades HTTP y SSR sin dominio (REQ-F-039, decisión P-1; restaurante/docs/arquitectura.md §4),
// y la comprobación de imágenes en disco (implementación del puerto ImageExists de core/catalog).
// No importa nada del proyecto; la usan las apps Koa (landing-pages, api e inventory-manager).
export * from './form-body.ts';
export * from './image-checker.ts';
export * from './json-body.ts';
export * from './logger.ts';
export * from './render.ts';
export * from './same-origin.ts';
