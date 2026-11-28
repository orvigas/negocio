import {
  InventoryValidationError,
  ItemNotFoundError,
  RecipeCycleError,
  RecipeItemInactiveError,
  RecipeNotAllowedError,
  RecipeTooDeepError,
  RecipeVersionConflictError,
  RecipeVersionNotFoundError,
  type FieldErrors,
  type RecipeVersionInfo,
} from './errors.ts';
import { ITEM_PAGE_SIZE, QUERY_MAX, normalizeAuthor, type InventoryAuthor } from './inventory-repository.ts';
import { RECIPE_ACTIONS, type InventoryStore, type InventoryStoreReader, type InventoryStoreTx } from './inventory-store.ts';
import { isItemType, type InventoryItem, type ItemType } from './item-schema.ts';
import { createCostCalculator, type RecipeCost } from './recipe-cost.ts';
import { buildAdjacency, deepestChain, findCycle, recipeDepth } from './recipe-graph.ts';
import {
  INGREDIENT_TYPES,
  RECIPE_ITEM_TYPES,
  RECIPE_LIMITS,
  readRecipeInput,
  recipeAllowed,
  resolveRecipeLines,
  sameRecipeContent,
  type RecipeUsage,
  type RecipeVersion,
  type RecipeVersionInput,
} from './recipe-schema.ts';
import { readId, searchKey } from './text.ts';

/**
 * Casos de uso de las recetas (REQ-F-050, T2): lista, receta de un artículo con su costo teórico,
 * historial de versiones, «usado en», opciones de ingrediente, guardar una versión y cerrar la receta.
 *
 * - Cada escritura va en `store.recipeTransaction` y toma primero el candado `recetas`: dentro de él
 *   se leen la versión vigente y el grafo, así que dos guardados que formarían un ciclo no pasan los dos.
 * - Guardar con el mismo contenido que la vigente no crea versión (también cubre el doble envío). Si
 *   no, partir de una versión que ya no es la vigente da RecipeVersionConflictError (C-4).
 * - Una versión nueva cierra la anterior en el mismo instante (intervalos contiguos): at = max(ahora,
 *   desde de la vigente + 1 ms), nunca invertido aunque el reloj retroceda.
 * - Historial: inventory_change (entity 'recipe', entityId = artículo) con el número, el rendimiento y
 *   el número de líneas; la versión completa ya es inmutable en sus tablas.
 */

export interface RecipeListFilterInput {
  type?: unknown;
  q?: unknown;
  page?: unknown;
}

export interface RecipeListEntry {
  item: InventoryItem;
  version: RecipeVersion;
  /** Costo por unidad base (escala 4) o null («Sin costo»). */
  unitCost: bigint | null;
  missingCount: number;
  /** RF-7: la vigente usa algún ingrediente inactivo. */
  usesInactive: boolean;
}

export interface RecipeListPage {
  recipes: RecipeListEntry[];
  page: { number: number; size: number; total: number };
}

export interface RecipeDetail {
  item: InventoryItem;
  /** Vigente con su costo, o null si no tiene receta vigente. */
  current: { version: RecipeVersion; cost: RecipeCost } | null;
  /** Todas las versiones (sin costo; PT-4), de la más reciente a la más antigua. */
  versions: RecipeVersion[];
  /** Ingredientes de las versiones, para mostrar sus nombres, unidades y estado. */
  ingredients: InventoryItem[];
  /** Ids de los ingredientes inactivos de la vigente (RF-7). */
  inactiveIngredientIds: number[];
}

export interface SaveRecipeResult {
  version: RecipeVersion;
  /** false: el contenido era el de la vigente y no se creó versión. */
  created: boolean;
}

export interface RecipeRepository {
  listRecipes(filter?: RecipeListFilterInput): Promise<RecipeListPage>;
  getRecipe(itemId: number): Promise<RecipeDetail>;
  /** Una versión del historial, solo lectura y sin costo (PT-4). */
  getVersion(id: number): Promise<{ version: RecipeVersion; item: InventoryItem; ingredients: InventoryItem[] }>;
  usedIn(itemId: number): Promise<RecipeUsage[]>;
  /** Ingredientes que se pueden elegir en una versión nueva (RN-T2-3). */
  ingredientOptions(): Promise<InventoryItem[]>;
  saveVersion(itemId: number, input: RecipeVersionInput, author: InventoryAuthor): Promise<SaveRecipeResult>;
  /** Deja el artículo sin receta vigente (RF-4). Sin vigente, devuelve null (idempotente). */
  closeRecipe(itemId: number, input: { baseVersionId?: unknown }, author: InventoryAuthor): Promise<RecipeVersion | null>;
}

const versionInfo = (version: RecipeVersion): RecipeVersionInfo => ({ id: version.id, number: version.number, validFrom: version.validFrom, createdByName: version.createdByName });

/** Instante de una versión nueva o de un cierre: nunca antes del inicio de la vigente. */
const changeInstant = (now: Date, current: RecipeVersion | null): Date =>
  current && now.getTime() <= current.validFrom.getTime() ? new Date(current.validFrom.getTime() + 1) : now;

function readListFilter(filter: RecipeListFilterInput): { type: ItemType | null; q: string | null; page: number } {
  const errors: FieldErrors = {};
  const type = filter.type ?? null;
  if (type !== null && !(isItemType(type) && RECIPE_ITEM_TYPES.includes(type))) errors.type = 'Elige Intermedio o Compuesto.';
  let q: string | null = null;
  if (filter.q !== undefined && filter.q !== null) {
    if (typeof filter.q !== 'string') errors.q = 'Debe ser texto.';
    else {
      q = searchKey(filter.q) || null;
      if (q !== null && [...q].length > QUERY_MAX) errors.q = `Máximo ${QUERY_MAX} caracteres.`;
    }
  }
  const page = filter.page === undefined || filter.page === null ? 1 : readId(filter.page);
  if (page === null) errors.page = 'La página debe ser un entero positivo.';
  if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
  // Validados arriba.
  return { type: type as ItemType | null, q, page: page ?? 1 };
}

/** Artículos de las vigentes y de sus ingredientes, y el mapa de vigentes por artículo. */
async function loadCatalog(reader: InventoryStoreReader) {
  const current = await reader.currentRecipes();
  const ids = new Set<number>();
  for (const version of current) {
    ids.add(version.itemId);
    for (const line of version.lines) ids.add(line.ingredientId);
  }
  const [found, stock] = await Promise.all([reader.itemsByIds([...ids]), reader.stockRows([...ids])]);
  const items = new Map(found.map((item) => [item.id, item]));
  // RF-10 (REQ-F-051): el CPP de cada artículo con existencias entra al costo (RN-T2-4: CPP → referencia).
  const cpp = new Map<number, bigint>();
  for (const row of stock.values()) if (row.avgCost !== null) cpp.set(row.itemId, row.avgCost);
  return { current, items, recipes: new Map(current.map((version) => [version.itemId, version])), cpp };
}

async function requireRecipeItem(reader: InventoryStoreReader, itemId: number): Promise<InventoryItem> {
  const item = await reader.getItem(itemId);
  if (!item) throw new ItemNotFoundError();
  if (!recipeAllowed(item)) throw new RecipeNotAllowedError();
  return item;
}

const ingredientIdsOf = (versions: readonly RecipeVersion[]): number[] => [...new Set(versions.flatMap((version) => version.lines.map((line) => line.ingredientId)))];

export function createRecipeRepository({ store, now = () => new Date() }: { store: InventoryStore; now?: () => Date }): RecipeRepository {
  if (!store) throw new TypeError('createRecipeRepository requiere un store');

  async function currentOf(tx: InventoryStoreTx, itemId: number): Promise<RecipeVersion | null> {
    return (await tx.recipeVersions(itemId)).find((version) => version.validTo === null) ?? null;
  }

  return Object.freeze<RecipeRepository>({
    async listRecipes(filter = {}) {
      const query = readListFilter(filter);
      return store.read(async (reader) => {
        const { current, items, recipes, cpp } = await loadCatalog(reader);
        const calculator = createCostCalculator({ items, recipes, cpp });
        const entries: RecipeListEntry[] = [];
        for (const version of current) {
          const item = items.get(version.itemId);
          if (!item) continue;
          if (query.type !== null && item.type !== query.type) continue;
          if (query.q !== null && !searchKey(item.name).includes(query.q)) continue;
          const cost = calculator.recipeCost(version);
          entries.push({
            item,
            version,
            unitCost: cost.unitCost,
            missingCount: cost.missing.length,
            usesInactive: version.lines.some((line) => items.get(line.ingredientId)?.active === false),
          });
        }
        entries.sort((a, b) => a.item.name.localeCompare(b.item.name, 'es') || a.item.id - b.item.id);
        const start = (query.page - 1) * ITEM_PAGE_SIZE;
        return { recipes: entries.slice(start, start + ITEM_PAGE_SIZE), page: { number: query.page, size: ITEM_PAGE_SIZE, total: entries.length } };
      });
    },

    getRecipe(itemId) {
      return store.read(async (reader) => {
        const item = await requireRecipeItem(reader, itemId);
        const [{ items, recipes, cpp }, versions] = await Promise.all([loadCatalog(reader), reader.recipeVersions(itemId)]);
        const version = recipes.get(itemId) ?? null;
        const ingredients = await reader.itemsByIds(ingredientIdsOf(versions));
        const current = version ? { version, cost: createCostCalculator({ items, recipes, cpp }).recipeCost(version) } : null;
        const inactiveIngredientIds = version ? version.lines.filter((line) => items.get(line.ingredientId)?.active === false).map((line) => line.ingredientId) : [];
        return { item, current, versions, ingredients, inactiveIngredientIds };
      });
    },

    getVersion(id) {
      return store.read(async (reader) => {
        const version = await reader.recipeVersion(id);
        if (!version) throw new RecipeVersionNotFoundError();
        const [item, ingredients] = await Promise.all([reader.getItem(version.itemId), reader.itemsByIds(ingredientIdsOf([version]))]);
        // La clave foránea item_id garantiza que el artículo existe.
        return { version, item: item as InventoryItem, ingredients };
      });
    },

    usedIn(itemId) {
      return store.read(async (reader) => {
        if (!(await reader.getItem(itemId))) throw new ItemNotFoundError();
        return reader.usedIn(itemId);
      });
    },

    ingredientOptions() {
      return store.read((reader) => reader.ingredientCandidates(INGREDIENT_TYPES));
    },

    async saveVersion(itemId, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const parsed = readRecipeInput(input);
      if (!parsed.ok) throw new InventoryValidationError(parsed.errors);
      const { baseVersionId, yieldQuantity, note } = parsed.value;

      return store.recipeTransaction(async (tx) => {
        await tx.lockRecipes();
        const item = await requireRecipeItem(tx, itemId);
        if (!item.active) throw new RecipeItemInactiveError();

        const errors: FieldErrors = {};
        const ingredients = new Map((await tx.itemsByIds(parsed.value.lines.map((line) => line.ingredientId))).map((ingredient) => [ingredient.id, ingredient]));
        const lines = resolveRecipeLines(parsed.value.lines, ingredients, errors);
        if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);

        const current = await currentOf(tx, itemId);
        if (current && sameRecipeContent(current, yieldQuantity, note, lines)) return { version: current, created: false };
        if (baseVersionId !== (current?.id ?? null)) throw new RecipeVersionConflictError(current ? versionInfo(current) : null);

        const adjacency = buildAdjacency(await tx.currentRecipes(), { itemId, ingredientIds: lines.map((line) => line.ingredientId) });
        // Nombres de una ruta de rechazo: los ya leídos y, en una consulta, los que falten (`#id` si no está).
        const namesOf = async (ids: readonly number[]): Promise<string[]> => {
          const names = new Map([...ingredients.values(), item].map((entry) => [entry.id, entry.name]));
          const missing = [...new Set(ids.filter((id) => !names.has(id)))];
          if (missing.length > 0) for (const other of await tx.itemsByIds(missing)) names.set(other.id, other.name);
          return ids.map((id) => names.get(id) ?? `#${id}`);
        };
        const cycle = findCycle(adjacency, itemId);
        if (cycle) throw new RecipeCycleError(await namesOf(cycle));
        const depth = recipeDepth(adjacency, itemId);
        if (depth > RECIPE_LIMITS.MAX_DEPTH) {
          const chain = deepestChain(adjacency, itemId);
          const names = await namesOf([...chain.path, ...chain.usedBy]);
          throw new RecipeTooDeepError(depth, RECIPE_LIMITS.MAX_DEPTH, names.slice(0, chain.path.length), names.slice(chain.path.length));
        }

        const at = changeInstant(now(), current);
        if (current && !(await tx.closeRecipeVersion(current.id, at))) throw new RecipeVersionConflictError(null);
        const previous = await tx.recipeVersions(itemId);
        const number = Math.max(0, ...previous.map((version) => version.number)) + 1;
        const version = await tx.insertRecipeVersion({ itemId, number, yieldQuantity, validFrom: at, note, createdAt: at, createdById: author.id, createdByName: author.name, lines });
        await tx.addChange({
          at,
          entity: 'recipe',
          entityId: itemId,
          action: RECIPE_ACTIONS.NEW_VERSION,
          actorId: author.id,
          actorName: author.name,
          changes: [
            { field: 'number', before: current?.number ?? null, after: number },
            { field: 'yieldQuantity', before: current ? current.yieldQuantity.toString() : null, after: yieldQuantity.toString() },
            { field: 'lines', before: current?.lines.length ?? null, after: lines.length },
          ],
        });
        return { version, created: true };
      });
    },

    async closeRecipe(itemId, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const baseVersionId = input.baseVersionId === undefined || input.baseVersionId === null ? null : readId(input.baseVersionId);
      if (input.baseVersionId !== undefined && input.baseVersionId !== null && baseVersionId === null) throw new InventoryValidationError({ baseVersionId: 'Versión de partida inválida.' });
      return store.recipeTransaction(async (tx) => {
        await tx.lockRecipes();
        await requireRecipeItem(tx, itemId);
        const current = await currentOf(tx, itemId);
        if (!current) return null;
        if (baseVersionId !== current.id) throw new RecipeVersionConflictError(versionInfo(current));
        const at = changeInstant(now(), current);
        if (!(await tx.closeRecipeVersion(current.id, at))) throw new RecipeVersionConflictError(null);
        await tx.addChange({
          at,
          entity: 'recipe',
          entityId: itemId,
          action: RECIPE_ACTIONS.CLOSE,
          actorId: author.id,
          actorName: author.name,
          changes: [{ field: 'number', before: current.number, after: null }],
        });
        return { ...current, validTo: at };
      });
    },
  });
}
