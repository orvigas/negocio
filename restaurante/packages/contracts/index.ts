// Contratos de la API (restaurante/docs/arquitectura.md §5). Paso 3 (REQ-F-038): el endpoint público
// de productos, con Zod (decisión C), y su cliente HTTP. Paso 4 (REQ-F-039): la API de administración,
// su cliente y el formulario de producto del admin. REQ-F-046: el cotizador de taquizas. REQ-F-049: el
// catálogo de inventario. REQ-F-050: las recetas del inventario y su costo teórico.
// REQ-F-051: el Kardex, las existencias y los proveedores del inventario.
export * from './admin.ts';
export * from './admin-client.ts';
export * from './inventory.ts';
export * from './inventory-kardex.ts';
export * from './inventory-recipes.ts';
export * from './page.ts';
export * from './product-form.ts';
export * from './products.ts';
export * from './public-client.ts';
export * from './quote.ts';
