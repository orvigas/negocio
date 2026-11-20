import type { InventoryAuthor, InventoryItem, InventoryRepository, RecipeRepository } from '@restaurante/core/inventory';

/**
 * Semilla de desarrollo y pruebas del inventario (REQ-F-049, RF-10, CA-12 y PV-5). Datos ficticios:
 * nunca se cargan en producción ni al arrancar la `api` (solo con `npm run inventory:seed-dev`). Pasa
 * por los repositorios de core, así que cumple las mismas reglas y deja su historial con el autor
 * "Semilla de desarrollo".
 *
 * Desde REQ-F-050 (RF-12): costos de referencia ficticios en la mayoría de los insumos y uno sin costo
 * (Cebolla), una mano de obra no inventariable en `hr` y tres recetas: "Salsa base" y "Carne cocida
 * ficticia" (Intermedios; la carne con la merma de cocción en su línea, RN-T2-1) y "Taco ficticio"
 * (Compuesto de 2 niveles que usa las dos, la mano de obra y la cebolla: queda «Sin costo»).
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
  /** Costo de referencia ficticio por unidad base (REQ-F-050). */
  referenceCost?: string;
  inventoriable?: boolean;
  variants?: { name: string; baseUnit: string; units?: { name: string; factor: string }[]; referenceCost?: string }[];
}

const ITEMS: readonly SeedItem[] = [
  { name: 'Masa de maíz', type: 'insumo', category: 'Abarrotes', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }], referenceCost: '18' },
  { name: 'Carne de res cruda', type: 'insumo', category: 'Carnes', baseUnit: 'kg', referenceCost: '160' },
  { name: 'Sal', type: 'insumo', category: 'Abarrotes', baseUnit: 'kg', referenceCost: '12' },
  { name: 'Jitomate', type: 'insumo', category: 'Verduras', baseUnit: 'kg', referenceCost: '28' },
  // Sin costo de referencia a propósito: deja «Sin costo» la receta que la usa (HU-4).
  { name: 'Cebolla', type: 'insumo', category: 'Verduras', baseUnit: 'kg' },
  { name: 'Queso', type: 'insumo', category: 'Lácteos', baseUnit: 'kg', referenceCost: '140' },
  { name: 'Mano de obra ficticia', type: 'insumo', category: 'Producción', baseUnit: 'hr', inventoriable: false, referenceCost: '80' },
  { name: 'Tortilla', type: 'intermedio', category: 'Producción', baseUnit: 'pza' },
  { name: 'Consomé', type: 'intermedio', category: 'Producción', baseUnit: 'L' },
  { name: 'Salsa', type: 'intermedio', category: 'Producción', baseUnit: 'L' },
  { name: 'Quesabirria', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  { name: 'Taco de birria', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  { name: 'Molote', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  { name: 'Salsa base', type: 'intermedio', category: 'Producción', baseUnit: 'L' },
  { name: 'Carne cocida ficticia', type: 'intermedio', category: 'Producción', baseUnit: 'kg' },
  { name: 'Taco ficticio', type: 'compuesto', category: 'Platillos', baseUnit: 'pza' },
  {
    name: 'Refresco 600 ml',
    type: 'reventa',
    category: 'Bebidas',
    variants: [
      { name: 'Refresco Coca-Cola 600 ml', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }], referenceCost: '15' },
      { name: 'Refresco Mundet 600 ml', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }], referenceCost: '13' },
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

/** Recetas ficticias (RF-12): [ingrediente, neta, unidad, merma %]. */
const RECIPES: readonly { item: string; yieldQuantity: string; note: string; lines: readonly (readonly [string, string, string, string])[] }[] = [
  { item: 'Salsa base', yieldQuantity: '1.000', note: 'Receta ficticia de desarrollo.', lines: [['Jitomate', '1.500', 'kg', '0'], ['Sal', '20', 'g', '0']] },
  // RN-T2-1: la neta es la carne ya cocida; la pérdida por cocción va como merma de su línea.
  { item: 'Carne cocida ficticia', yieldQuantity: '6.000', note: 'Receta ficticia: 6 kg cocidos de 10 kg crudos.', lines: [['Carne de res cruda', '6.000', 'kg', '40']] },
  {
    item: 'Taco ficticio',
    yieldQuantity: '1',
    note: 'Receta ficticia de 2 niveles.',
    lines: [
      ['Carne cocida ficticia', '80', 'g', '0'],
      ['Salsa base', '20', 'ml', '0'],
      ['Cebolla', '10', 'g', '0'],
      ['Mano de obra ficticia', '0.010', 'hr', '0'],
    ],
  },
];

/**
 * Carga la semilla si el inventario está vacío (idempotente: con cualquier artículo o categoría ya
 * guardados no hace nada). Devuelve cuántos artículos y recetas creó (0 si no hizo nada).
 */
export async function seedInventoryDev(
  { inventory, recipes }: { inventory: InventoryRepository; recipes: RecipeRepository },
  author: InventoryAuthor = DEV_SEED_AUTHOR,
): Promise<{ created: number; recipes: number }> {
  const [existing, categories] = await Promise.all([inventory.listItems({ status: 'all' }), inventory.listCategories()]);
  if (existing.page.total > 0 || categories.length > 0) return { created: 0, recipes: 0 };

  const categoryIds = new Map<Category, number>();
  for (const name of CATEGORIES) categoryIds.set(name, (await inventory.createCategory({ name }, author)).id);

  let created = 0;
  const byName = new Map<string, InventoryItem>();
  for (const { name, type, category, baseUnit, units, referenceCost, inventoriable, variants } of ITEMS) {
    const categoryId = categoryIds.get(category);
    if (variants) {
      const parent = await inventory.createItem({ kind: 'parent', type, categoryId, name }, author);
      created += 1;
      for (const variant of variants) {
        await inventory.createItem({ kind: 'variant', parentId: parent.id, ...variant }, author);
        created += 1;
      }
    } else {
      const item = await inventory.createItem({ type, categoryId, name, baseUnit, ...(units ? { units } : {}), ...(referenceCost ? { referenceCost } : {}), ...(inventoriable === false ? { inventoriable } : {}) }, author);
      byName.set(name, item);
      created += 1;
    }
  }

  for (const recipe of RECIPES) {
    const item = byName.get(recipe.item);
    if (!item) throw new Error(`Semilla incoherente: falta el artículo de una receta (${recipe.item})`);
    const lines = recipe.lines.map(([ingredient, quantity, unit, wastePercent]) => {
      const found = byName.get(ingredient);
      if (!found) throw new Error(`Semilla incoherente: falta un ingrediente (${ingredient})`);
      return { ingredientId: found.id, quantity, unit, wastePercent };
    });
    await recipes.saveVersion(item.id, { baseVersionId: null, yieldQuantity: recipe.yieldQuantity, note: recipe.note, lines }, author);
  }
  return { created, recipes: RECIPES.length };
}
