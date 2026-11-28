// Inventario (REQ-F-049): catálogo de artículos, variantes, unidades, conversiones y categorías;
// recetas multinivel versionadas, costo teórico e importación única de datos maestros (REQ-F-050);
// proveedores, existencias y Kardex (REQ-F-051).
// Lo único que se importa desde fuera del módulo (REQ-F-037, restaurante/docs/arquitectura.md §4).
export * from './business-date.ts';
export * from './category-schema.ts';
export * from './decimal.ts';
export * from './errors.ts';
export * from './inventory-repository.ts';
export * from './inventory-store.ts';
export * from './item-schema.ts';
export * from './kardex-math.ts';
export * from './kardex-repository.ts';
export * from './kardex-schema.ts';
export * from './kardex-verify.ts';
export * from './master-import.ts';
export * from './memory-inventory-store.ts';
export * from './recipe-cost.ts';
export * from './recipe-graph.ts';
export * from './recipe-repository.ts';
export * from './recipe-schema.ts';
export * from './supplier-repository.ts';
export * from './supplier-schema.ts';
export { searchKey } from './text.ts';
export * from './units.ts';
