import {
  COST_INTEGER_DIGITS,
  COST_SCALE,
  CategoryNameTakenError,
  InventoryBusyError,
  InventoryError,
  ItemNameTakenError,
  RecipeVersionConflictError,
  SkuTakenError,
  WASTE_SCALE,
  formatDecimal,
  parseDecimal,
  unitKey,
  type CategoryWithUsage,
  type FieldChange,
  type InventoryCategory,
  type InventoryItem,
  type InventoryStore,
  type InventoryStoreReader,
  type InventoryStoreTx,
  type ItemQuery,
  type NewItem,
  type PackagingUnit,
  type RecipeUsage,
  type RecipeVersion,
  type StoredInventoryChange,
} from '@restaurante/core/inventory';

import type { Database } from './client.ts';
import { databaseErrorDetails, isTransactionConflict, isUniqueViolation, toUnavailable } from './errors.ts';
import type { Prisma } from './generated/prisma/client.ts';

/**
 * Store del catálogo de inventario sobre Prisma/MySQL (REQ-F-049, T1).
 *
 * - Escrituras en transacción serializable con reintento acotado ante interbloqueo (1213/P2034), como
 *   user-repository.ts: así contar los artículos activos de una categoría y dar de alta uno en ella no
 *   se cruzan, y dos altas con el mismo nombre no producen un duplicado.
 * - Las claves únicas (`active_name_key` de artículos y categorías, `inventory_sku.sku_key`) son la
 *   garantía ante carreras: su violación (P2002) se traduce al error de dominio de esa escritura.
 * - Factores DECIMAL(13,3): core nunca ve Prisma.Decimal. Se leen con toFixed(3) y se escriben como
 *   texto (formatDecimal), sin pasar por coma flotante.
 * - Cualquier otro error de la base de datos se convierte en DatabaseUnavailableError (503).
 *
 * Recetas (REQ-F-050, T2):
 * - `recipeTransaction` es READ COMMITTED y su primera sentencia es el candado `recetas` (un upsert
 *   de la fila de inventory_lock, que la bloquea en exclusiva exista o no). Las escrituras de recetas
 *   y las de artículos que consultan su uso se serializan; cada lectura posterior ve lo último
 *   confirmado. Orden de bloqueo: siempre el candado primero y después las filas.
 * - Una espera del candado agotada (MySQL 1205) es InventoryBusyError (503), sin reintento. Un choque
 *   con las claves únicas de las versiones (imposible dentro del candado) es un conflicto (409).
 * - Las versiones no se modifican ni se borran: solo se cierran (`valid_to`, `current_item_id`).
 */

const WRITE_TX = Object.freeze({ isolationLevel: 'Serializable', maxWait: 5000, timeout: 10_000 } as const);
const RECIPE_TX = Object.freeze({ isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10_000 } as const);
const READ_TX = Object.freeze({ maxWait: 5000, timeout: 10_000 } as const);
/** Intentos ante un interbloqueo, con una espera aleatoria corta entre ellos. */
export const MAX_ATTEMPTS = 3;
const retryDelay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 60)));

const ITEM_INCLUDE = { units: { orderBy: { position: 'asc' } } } as const satisfies Prisma.InventoryItemInclude;
type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
const VERSION_INCLUDE = { lines: { orderBy: { position: 'asc' } } } as const satisfies Prisma.InventoryRecipeVersionInclude;
type VersionRow = Prisma.InventoryRecipeVersionGetPayload<{ include: typeof VERSION_INCLUDE }>;
type CategoryRow = Prisma.InventoryCategoryGetPayload<object>;
type Tx = Prisma.TransactionClient;

/** DECIMAL(13,3) -> bigint escalado, sin coma flotante. */
function factorOf(value: Prisma.Decimal): bigint {
  const parsed = parseDecimal(value.toFixed(3));
  if (!parsed.ok) throw new Error('Factor de empaque inválido en la base de datos');
  return parsed.value;
}

/** DECIMAL(15,4) -> bigint con escala 4. */
function costOf(value: Prisma.Decimal | null): bigint | null {
  if (value === null) return null;
  const parsed = parseDecimal(value.toFixed(COST_SCALE), { scale: COST_SCALE, integerDigits: COST_INTEGER_DIGITS });
  if (!parsed.ok) throw new Error('Costo inválido en la base de datos');
  return parsed.value;
}

/** DECIMAL(5,2) -> bigint con escala 2. */
function wasteOf(value: Prisma.Decimal): bigint {
  const parsed = parseDecimal(value.toFixed(WASTE_SCALE), { scale: WASTE_SCALE, integerDigits: 3 });
  if (!parsed.ok) throw new Error('Merma inválida en la base de datos');
  return parsed.value;
}

const toVersion = (row: VersionRow): RecipeVersion => ({
  id: row.id,
  itemId: row.itemId,
  number: row.number,
  yieldQuantity: factorOf(row.yieldQuantity),
  validFrom: row.validFrom,
  validTo: row.validTo,
  note: row.note,
  createdAt: row.createdAt,
  createdById: row.createdById,
  createdByName: row.createdByName,
  lines: row.lines.map((line) => ({
    position: line.position,
    ingredientId: line.ingredientItemId,
    quantity: factorOf(line.quantity),
    unit: line.unit,
    netBaseQuantity: factorOf(line.netBaseQuantity),
    wastePercent: wasteOf(line.wastePercent),
    grossBaseQuantity: factorOf(line.grossBaseQuantity),
    note: line.note,
  })),
});

function toItem(row: ItemRow): InventoryItem {
  return {
    id: row.id,
    kind: row.kind,
    type: row.type,
    parentId: row.parentId,
    categoryId: row.categoryId,
    name: row.name,
    nameKey: row.nameKey,
    description: row.description,
    sku: row.sku,
    baseUnit: row.baseUnit,
    units: row.units.map((unit): PackagingUnit => ({ name: unit.name, factor: factorOf(unit.factor) })),
    active: row.active,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
    updatedByName: row.updatedByName,
    referenceCost: costOf(row.referenceCost),
    inventoriable: row.inventoriable,
  };
}

const toCategory = (row: CategoryRow): InventoryCategory => ({
  id: row.id,
  name: row.name,
  nameKey: row.nameKey,
  active: row.active,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Columnas escalares de un artículo (sin id ni empaques). */
const itemColumns = (item: NewItem) => ({
  kind: item.kind,
  type: item.type,
  parentId: item.parentId,
  categoryId: item.categoryId,
  name: item.name,
  nameKey: item.nameKey,
  activeNameKey: item.active ? item.nameKey : null,
  description: item.description,
  sku: item.sku,
  baseUnit: item.baseUnit,
  active: item.active,
  version: item.version,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  updatedById: item.updatedById,
  updatedByName: item.updatedByName,
  referenceCost: item.referenceCost === null ? null : formatDecimal(item.referenceCost, COST_SCALE),
  inventoriable: item.inventoriable,
});

const unitRows = (itemId: number, units: readonly PackagingUnit[]) =>
  units.map((unit, index) => ({ itemId, position: index + 1, name: unit.name, nameKey: unitKey(unit.name), factor: formatDecimal(unit.factor) }));

/** Ejecuta una escritura y convierte su violación de unicidad en el error de dominio indicado. */
async function unique<T>(operation: () => Promise<T>, DomainError: new () => InventoryError): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError();
    throw err;
  }
}

/** Choque con las claves únicas de una versión: otra escritura ganó (409, sin datos de la vigente). */
class RecipeConflict extends RecipeVersionConflictError {
  constructor() {
    super(null);
  }
}

/** Escapa los comodines de LIKE (el carácter de escape de MySQL es la barra invertida). */
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

function itemWhere(query: ItemQuery): Prisma.InventoryItemWhereInput {
  const where: Prisma.InventoryItemWhereInput = {};
  if (query.status !== 'all') where.active = query.status === 'active';
  if (query.type !== null) where.type = query.type;
  if (query.categoryId !== null) where.categoryId = query.categoryId;
  if (query.q !== null) {
    // La colación distingue mayúsculas: se busca sobre las claves normalizadas (nombre en minúsculas,
    // SKU en mayúsculas en su registro). Prisma no escapa los comodines de LIKE: «%» y «_» se buscan
    // como texto.
    const text = escapeLike(query.q);
    where.OR = [{ nameKey: { contains: text.toLowerCase() } }, { skus: { some: { skuKey: { contains: text.toUpperCase() } } } }];
  }
  return where;
}

function readerOn(client: Tx): InventoryStoreReader {
  const getItem = async (id: number): Promise<InventoryItem | null> => {
    const row = await client.inventoryItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return row ? toItem(row) : null;
  };
  return {
    getItem,

    async listVariants(parentId) {
      const rows = await client.inventoryItem.findMany({ where: { parentId }, include: ITEM_INCLUDE, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
      return rows.map(toItem);
    },

    async listItems(query) {
      const where = itemWhere(query);
      const [total, rows] = await Promise.all([
        client.inventoryItem.count({ where }),
        client.inventoryItem.findMany({ where, include: ITEM_INCLUDE, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      ]);
      const parents = rows.filter((row) => row.kind === 'parent').map((row) => row.id);
      // Una consulta agrupada para el número de variantes de la página (sin N+1).
      const counts =
        parents.length === 0 ? [] : await client.inventoryItem.groupBy({ by: ['parentId'], where: { parentId: { in: parents } }, _count: { _all: true } });
      const variants = new Map(counts.map((entry) => [entry.parentId, entry._count._all]));
      return { items: rows.map((row) => ({ ...toItem(row), variantCount: variants.get(row.id) ?? 0 })), total };
    },

    async getCategory(id) {
      const row = await client.inventoryCategory.findUnique({ where: { id } });
      return row ? toCategory(row) : null;
    },

    async listCategories(): Promise<CategoryWithUsage[]> {
      const [rows, counts] = await Promise.all([
        client.inventoryCategory.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
        client.inventoryItem.groupBy({ by: ['categoryId'], where: { active: true }, _count: { _all: true } }),
      ]);
      const used = new Map(counts.map((entry) => [entry.categoryId, entry._count._all]));
      return rows.map((row) => ({ ...toCategory(row), activeItemCount: used.get(row.id) ?? 0 }));
    },

    async history(entity, entityId, limit) {
      const rows = await client.inventoryChange.findMany({ where: { entity, entityId }, orderBy: { id: 'desc' }, take: limit });
      return rows.map(
        (row): StoredInventoryChange => ({
          id: row.id,
          at: row.at,
          // Solo las escribe addChange, con los valores de InventoryEntity e InventoryAction.
          entity: row.entity as StoredInventoryChange['entity'],
          entityId: row.entityId,
          action: row.action as StoredInventoryChange['action'],
          actorId: row.actorId,
          actorName: row.actorName,
          changes: JSON.parse(row.changes) as FieldChange[],
        }),
      );
    },

    // RN-4: versiones del artículo o líneas que lo usan, de cualquier versión (dos consultas por
    // índice). T3 añadirá los movimientos.
    async isInUse(itemId) {
      const [version, line] = await Promise.all([
        client.inventoryRecipeVersion.findFirst({ where: { itemId }, select: { id: true } }),
        client.inventoryRecipeLine.findFirst({ where: { ingredientItemId: itemId }, select: { id: true } }),
      ]);
      return version !== null || line !== null;
    },

    // Hasta T3 (REQ-F-051) no hay movimientos.
    hasMovements: async () => false,

    async itemsByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await client.inventoryItem.findMany({ where: { id: { in: [...ids] } }, include: ITEM_INCLUDE });
      return rows.map(toItem);
    },

    async ingredientCandidates(types) {
      const rows = await client.inventoryItem.findMany({
        where: { active: true, kind: { not: 'parent' }, type: { in: [...types] } },
        include: ITEM_INCLUDE,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return rows.map(toItem);
    },

    async currentRecipes() {
      const rows = await client.inventoryRecipeVersion.findMany({ where: { currentItemId: { not: null } }, include: VERSION_INCLUDE });
      return rows.map(toVersion);
    },

    async recipeVersions(itemId) {
      const rows = await client.inventoryRecipeVersion.findMany({ where: { itemId }, include: VERSION_INCLUDE, orderBy: { number: 'desc' } });
      return rows.map(toVersion);
    },

    async recipeVersion(id) {
      const row = await client.inventoryRecipeVersion.findUnique({ where: { id }, include: VERSION_INCLUDE });
      return row ? toVersion(row) : null;
    },

    async usedIn(itemId) {
      const rows = await client.inventoryRecipeLine.findMany({
        where: { ingredientItemId: itemId, version: { currentItemId: { not: null } } },
        select: { version: { select: { id: true, number: true, item: { select: { id: true, name: true, active: true } } } } },
      });
      return rows
        .map((row): RecipeUsage => ({ itemId: row.version.item.id, itemName: row.version.item.name, itemActive: row.version.item.active, versionId: row.version.id, versionNumber: row.version.number }))
        .sort((a, b) => a.itemName.localeCompare(b.itemName, 'es') || a.itemId - b.itemId);
    },
  };
}

function txOn(tx: Tx): InventoryStoreTx {
  return {
    ...readerOn(tx),

    async activeItemIdByNameKey(nameKey) {
      const row = await tx.inventoryItem.findUnique({ where: { activeNameKey: nameKey }, select: { id: true } });
      return row?.id ?? null;
    },

    async insertItem(item) {
      const row = await unique(() => tx.inventoryItem.create({ data: itemColumns(item) }), ItemNameTakenError);
      if (item.units.length > 0) await tx.inventoryItemUnit.createMany({ data: unitRows(row.id, item.units) });
      return toItem(await tx.inventoryItem.findUniqueOrThrow({ where: { id: row.id }, include: ITEM_INCLUDE }));
    },

    async replaceItem(item, expectedVersion) {
      const { count } = await unique(() => tx.inventoryItem.updateMany({ where: { id: item.id, version: expectedVersion }, data: itemColumns(item) }), ItemNameTakenError);
      if (count === 0) return false;
      await tx.inventoryItemUnit.deleteMany({ where: { itemId: item.id } });
      if (item.units.length > 0) await tx.inventoryItemUnit.createMany({ data: unitRows(item.id, item.units) });
      return true;
    },

    async skuOwner(skuKey) {
      const row = await tx.inventorySku.findUnique({ where: { skuKey }, select: { itemId: true } });
      return row?.itemId ?? null;
    },

    async registerSku(skuKey, itemId, at) {
      await unique(() => tx.inventorySku.create({ data: { skuKey, itemId, assignedAt: at } }), SkuTakenError);
    },

    async activeCategoryIdByNameKey(nameKey) {
      const row = await tx.inventoryCategory.findUnique({ where: { activeNameKey: nameKey }, select: { id: true } });
      return row?.id ?? null;
    },

    async insertCategory(category) {
      const row = await unique(
        () => tx.inventoryCategory.create({ data: { ...category, activeNameKey: category.active ? category.nameKey : null } }),
        CategoryNameTakenError,
      );
      return toCategory(row);
    },

    async updateCategory(category) {
      const { id, ...data } = category;
      await unique(() => tx.inventoryCategory.update({ where: { id }, data: { ...data, activeNameKey: category.active ? category.nameKey : null } }), CategoryNameTakenError);
    },

    countActiveItemsInCategory: (categoryId) => tx.inventoryItem.count({ where: { categoryId, active: true } }),

    async lockRecipes() {
      await tx.$executeRaw`INSERT INTO inventory_lock (name) VALUES ('recetas') ON DUPLICATE KEY UPDATE name = name`;
    },

    async insertRecipeVersion(version) {
      const row = await unique(
        () =>
          tx.inventoryRecipeVersion.create({
            data: {
              itemId: version.itemId,
              number: version.number,
              yieldQuantity: formatDecimal(version.yieldQuantity),
              validFrom: version.validFrom,
              currentItemId: version.itemId,
              note: version.note,
              createdAt: version.createdAt,
              createdById: version.createdById,
              createdByName: version.createdByName,
              lines: {
                create: version.lines.map((line) => ({
                  position: line.position,
                  ingredientItemId: line.ingredientId,
                  quantity: formatDecimal(line.quantity),
                  unit: line.unit,
                  netBaseQuantity: formatDecimal(line.netBaseQuantity),
                  wastePercent: formatDecimal(line.wastePercent, WASTE_SCALE),
                  grossBaseQuantity: formatDecimal(line.grossBaseQuantity),
                  note: line.note,
                })),
              },
            },
            include: VERSION_INCLUDE,
          }),
        RecipeConflict,
      );
      return toVersion(row);
    },

    async closeRecipeVersion(id, at) {
      const { count } = await tx.inventoryRecipeVersion.updateMany({ where: { id, validTo: null }, data: { validTo: at, currentItemId: null } });
      return count === 1;
    },

    async addChange(entry) {
      await tx.inventoryChange.create({
        data: {
          at: entry.at,
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          actorId: entry.actorId,
          actorName: entry.actorName,
          changes: JSON.stringify(entry.changes),
        },
      });
    },
  };
}

/**
 * `writeTimeoutMs`: tiempo máximo de una transacción de `transaction` (10 s por defecto). Solo la
 * importación única de datos maestros (REQ-F-050, A5), que escribe todo en una transacción, lo sube.
 */
export function createPrismaInventoryStore({ prisma, writeTimeoutMs = WRITE_TX.timeout }: { prisma: Database; writeTimeoutMs?: number }): InventoryStore {
  if (!prisma) throw new TypeError('createPrismaInventoryStore requiere el cliente de la base de datos');
  if (!(Number.isSafeInteger(writeTimeoutMs) && writeTimeoutMs > 0)) throw new TypeError('writeTimeoutMs debe ser un entero positivo');
  const writeTx = { ...WRITE_TX, timeout: writeTimeoutMs };

  /** Errores de dominio tal cual; interbloqueo -> se repite la transacción entera; resto -> 503. */
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        if (err instanceof InventoryError) throw err;
        // Espera de bloqueo agotada (el candado de recetas, retenido por otra escritura): sin reintento.
        if (databaseErrorDetails(err).originalCode === '1205') throw new InventoryBusyError();
        if (isTransactionConflict(err) && attempt < MAX_ATTEMPTS) {
          await retryDelay();
          continue;
        }
        throw toUnavailable(err);
      }
    }
  }

  return Object.freeze<InventoryStore>({
    read: (task) => run(() => prisma.$transaction((tx) => task(readerOn(tx)), READ_TX)),
    transaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)), writeTx)),
    recipeTransaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)), RECIPE_TX)),
  });
}
