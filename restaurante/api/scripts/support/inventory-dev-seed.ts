import type { InventoryAuthor, InventoryRepository } from '@restaurante/core/inventory';

/**
 * Semilla de desarrollo y pruebas del inventario (REQ-F-049, RF-10, CA-12 y PV-5). Datos ficticios:
 * nunca se cargan en producción ni al arrancar la `api` (solo con `npm run inventory:seed-dev`). Pasa
 * por el repositorio de core, así que cumple las mismas reglas y deja su historial con el autor
 * "Semilla de desarrollo".
 */

export const DEV_SEED_AUTHOR: InventoryAuthor = Object.freeze({ id: null, name: 'Semilla de desarrollo' });

/** Hosts aceptados: los mismos que la salvaguarda de las bases de pruebas (landing-pages/tests/support/test-database-config.ts). */
export const DEV_SEED_HOSTS: readonly string[] = Object.freeze(['127.0.0.1', 'localhost', '::1', 'mysql-dev']);

/** Motivo por el que la semilla no puede correr con esa configuración; null si es local y de desarrollo. */
export function devSeedRefusal({ nodeEnv, host }: { nodeEnv: string | undefined; host: string }): string | null {
  if (nodeEnv === 'production') return 'La semilla de desarrollo no se ejecuta con NODE_ENV=production.';
  if (!DEV_SEED_HOSTS.includes(host)) return `La semilla de desarrollo solo se ejecuta contra una base local (${DEV_SEED_HOSTS.join(', ')}).`;
  return null;
}

const CATEGORIES = ['Abarrotes', 'Carnes', 'Verduras', 'Lácteos', 'Producción', 'Platillos', 'Bebidas'] as const;
type Category = (typeof CATEGORIES)[number];

interface SeedItem {
  name: string;
  type: 'insumo' | 'intermedio' | 'compuesto' | 'reventa';
  category: Category;
  baseUnit?: string;
  units?: { name: string; factor: string }[];
  variants?: { name: string; baseUnit: string; units?: { name: string; factor: string }[] }[];
}

const ITEMS: readonly SeedItem[] = [
  { name: 'Masa de maíz', type: 'insumo', category: 'Abarrotes', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }] },
  { name: 'Carne de res cruda', type: 'insumo', category: 'Carnes', baseUnit: 'kg' },
  { name: 'Sal', type: 'insumo', category: 'Abarrotes', baseUnit: 'kg' },
  { name: 'Jitomate', type: 'insumo', category: 'Verduras', baseUnit: 'kg' },
  { name: 'Cebolla', type: 'insumo', category: 'Verduras', baseUnit: 'kg' },
  { name: 'Queso', type: 'insumo', category: 'Lácteos', baseUnit: 'kg' },
  { name: 'Tortilla', type: 'intermedio', category: 'Producción', baseUnit: 'pza' },
  { name: 'Consomé', type: 'intermedio', category: 'Producción', baseUnit: 'L' },
  { name: 'Salsa', type: 'intermedio', category: 'Producción', baseUnit: 'L' },
  { name: 'Quesabirria', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  { name: 'Taco de birria', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  { name: 'Molote', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  {
    name: 'Refresco 600 ml',
    type: 'reventa',
    category: 'Bebidas',
    variants: [
      { name: 'Refresco Coca-Cola 600 ml', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }] },
      { name: 'Refresco Mundet 600 ml', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }] },
    ],
  },
  {
    name: 'Agua fresca',
    type: 'reventa',
    category: 'Bebidas',
    variants: [
      { name: 'Agua fresca de horchata', baseUnit: 'L' },
      { name: 'Agua fresca de jamaica', baseUnit: 'L' },
    ],
  },
];

/**
 * Carga la semilla si el inventario está vacío (idempotente: con cualquier artículo o categoría ya
 * guardados no hace nada). Devuelve cuántos artículos creó (0 si no hizo nada).
 */
export async function seedInventoryDev(inventory: InventoryRepository, author: InventoryAuthor = DEV_SEED_AUTHOR): Promise<{ created: number }> {
  const [existing, categories] = await Promise.all([inventory.listItems({ status: 'all' }), inventory.listCategories()]);
  if (existing.page.total > 0 || categories.length > 0) return { created: 0 };

  const categoryIds = new Map<Category, number>();
  for (const name of CATEGORIES) categoryIds.set(name, (await inventory.createCategory({ name }, author)).id);

  let created = 0;
  for (const { name, type, category, baseUnit, units, variants } of ITEMS) {
    const categoryId = categoryIds.get(category);
    if (variants) {
      const parent = await inventory.createItem({ kind: 'parent', type, categoryId, name }, author);
      created += 1;
      for (const variant of variants) {
        await inventory.createItem({ kind: 'variant', parentId: parent.id, ...variant }, author);
        created += 1;
      }
    } else {
      await inventory.createItem({ type, categoryId, name, baseUnit, ...(units ? { units } : {}) }, author);
      created += 1;
    }
  }
  return { created };
}
