// Piezas compartidas de core: identificadores de negocio, logger, errores.
// Lo único que se importa desde fuera del módulo (REQ-F-037, restaurante/docs/arquitectura.md §4).
export * from './businesses.ts';
export * from './datetime.ts';
export * from './database-errors.ts';
export * from './errors.ts';
export * from './logger.ts';
