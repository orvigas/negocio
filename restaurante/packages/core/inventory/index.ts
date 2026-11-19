// Inventario (REQ-F-049): catálogo de artículos, variantes, unidades, conversiones y categorías.
// Lo único que se importa desde fuera del módulo (REQ-F-037, restaurante/docs/arquitectura.md §4).
export * from './category-schema.ts';
export * from './decimal.ts';
export * from './errors.ts';
export * from './inventory-repository.ts';
export * from './inventory-store.ts';
export * from './item-schema.ts';
export * from './memory-inventory-store.ts';
export * from './units.ts';
