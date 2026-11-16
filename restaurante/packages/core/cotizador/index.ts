// Cotizador de taquizas (REQ-F-046): catálogo y su validación, campos editables, ajustes, tarifa,
// cálculo y matriz. TS puro, sin E/S; el catálogo llega por el puerto QuoteCatalogSource.
// Lo único que se importa desde fuera del módulo (REQ-F-037, restaurante/docs/arquitectura.md §4).
export * from './adjustments.ts';
export * from './calculator.ts';
export * from './catalog.ts';
export * from './catalog-schema.ts';
export * from './catalog-source.ts';
export * from './fields.ts';
export * from './rounding.ts';
export * from './tariff.ts';
