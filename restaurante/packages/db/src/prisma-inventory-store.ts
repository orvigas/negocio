import {
  COST_INTEGER_DIGITS,
  COST_SCALE,
  CategoryNameTakenError,
  InventoryBusyError,
  InventoryError,
  ItemNameTakenError,
  RecipeVersionConflictError,
  SkuTakenError,
  SupplierNameTakenError,
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
  type Supplier,
} from '@restaurante/core/inventory';

import type { Database } from './client.ts';
import { databaseErrorDetails, isTransactionConflict, isUniqueViolation, toUnavailable } from './errors.ts';
import { kardexReaderOn, kardexTxOn } from './prisma-kardex.ts';
import { Prisma } from './generated/prisma/client.ts';

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
 *
 * Proveedores y existencias (REQ-F-051, T3):
 * - `insertItem` crea la existencia (0, sin costo) de todo artículo que no es padre (DT-T3-2).
 * - `lockStock` bloquea las existencias con `SELECT … FOR UPDATE` en orden ascendente de id (DT-13) y
 *   crea antes las que falten (un artículo creado por una imagen anterior; también tras el TRUNCATE de
 *   las pruebas).
 * - `hasMovements` es `last_seq > 0`; `isInUse` lo incluye (RN-T3-11).
 * - Kardex (documentos, movimientos y existencias): `prisma-kardex.ts`. `kardexTransaction` es READ
 *   COMMITTED (DT-13): el orden de bloqueo lo fija core (documento de origen y existencias por id).
 */

const WRITE_TX = Object.freeze({ isolationLevel: 'Serializable', maxWait: 5000, timeout: 10_000 } as const);
const RECIPE_TX = Object.freeze({ isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10_000 } as const);
/** Kardex (REQ-F-051, DT-13): READ COMMITTED con SELECT … FOR UPDATE ordenado, no Serializable. */
const KARDEX_TX = RECIPE_TX;
const READ_TX = Object.freeze({ maxWait: 5000, timeout: 10_000 } as const);
/** Intentos ante un interbloqueo, con una espera aleatoria corta entre ellos. */
export const MAX_ATTEMPTS = 3;
const retryDelay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 60)));

const ITEM_INCLUDE = { units: { orderBy: { position: 'asc' } } } as const satisfies Prisma.InventoryItemInclude;
type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
const VERSION_INCLUDE = { lines: { orderBy: { position: 'asc' } } } as const satisfies Prisma.InventoryRecipeVersionInclude;
type VersionRow = Prisma.InventoryRecipeVersionGetPayload<{ include: typeof VERSION_INCLUDE }>;
type CategoryRow = Prisma.InventoryCategoryGetPayload<object>;
type SupplierRow = Prisma.InventorySupplierGetPayload<object>;
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

const toSupplier = (row: SupplierRow): Supplier => ({
  id: row.id,
  name: row.name,
  nameKey: row.nameKey,
  contact: row.contact,
  active: row.active,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  updatedById: row.updatedById,
  updatedByName: row.updatedByName,
});

/** Columnas de un proveedor (sin id). */
const supplierColumns = (supplier: Omit<Supplier, 'id'>) => ({
  name: supplier.name,
  nameKey: supplier.nameKey,
  activeNameKey: supplier.active ? supplier.nameKey : null,
  contact: supplier.contact,
  active: supplier.active,
  version: supplier.version,
  createdAt: supplier.createdAt,
  updatedAt: supplier.updatedAt,
  updatedById: supplier.updatedById,
  updatedByName: supplier.updatedByName,
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

/**
 * Filtro de la lista. La búsqueda por nombre ignora mayúsculas y acentos y distingue la «ñ»
 * (REQ-F-051, OBS-12 b): la colación de la columna distingue las dos cosas, así que los ids se buscan
 * con `utf8mb4_es_0900_ai_ci` en una consulta aparte (Prisma no admite COLLATE). El SKU se busca en
 * mayúsculas en su registro. Prisma no escapa los comodines de LIKE: «%» y «_» se buscan como texto.
 */
async function itemWhere(client: Tx, query: ItemQuery): Promise<Prisma.InventoryItemWhereInput> {
  const where: Prisma.InventoryItemWhereInput = {};
  if (query.status !== 'all') where.active = query.status === 'active';
  if (query.type !== null) where.type = query.type;
  if (query.categoryId !== null) where.categoryId = query.categoryId;
  if (query.q !== null) {
    const text = escapeLike(query.q);
    const pattern = `%${text}%`;
    const rows = await client.$queryRaw<{ id: number }[]>`SELECT id FROM inventory_item WHERE name COLLATE utf8mb4_es_0900_ai_ci LIKE ${pattern}`;
    where.OR = [{ id: { in: rows.map((row) => Number(row.id)) } }, { skus: { some: { skuKey: { contains: text.toUpperCase() } } } }];
  }
  return where;
}

function readerOn(client: Tx): InventoryStoreReader {
  const getItem = async (id: number): Promise<InventoryItem | null> => {
    const row = await client.inventoryItem.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return row ? toItem(row) : null;
  };
  return {
    ...kardexReaderOn(client),
    getItem,

    async listVariants(parentId) {
      const rows = await client.inventoryItem.findMany({ where: { parentId }, include: ITEM_INCLUDE, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
      return rows.map(toItem);
    },

    async listItems(query) {
      const where = await itemWhere(client, query);
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

    // RN-4: versiones del artículo, líneas que lo usan (de cualquier versión) o movimientos (REQ-F-051),
    // tres consultas por clave o índice.
    async isInUse(itemId) {
      const [version, line, stock] = await Promise.all([
        client.inventoryRecipeVersion.findFirst({ where: { itemId }, select: { id: true } }),
        client.inventoryRecipeLine.findFirst({ where: { ingredientItemId: itemId }, select: { id: true } }),
        client.inventoryStock.findUnique({ where: { itemId }, select: { lastSeq: true } }),
      ]);
      return version !== null || line !== null || (stock?.lastSeq ?? 0) > 0;
    },

    // RN-T3-11: la existencia guarda el seq del último movimiento.
    async hasMovements(itemId) {
      const stock = await client.inventoryStock.findUnique({ where: { itemId }, select: { lastSeq: true } });
      return (stock?.lastSeq ?? 0) > 0;
    },

    async getSupplier(id) {
      const row = await client.inventorySupplier.findUnique({ where: { id } });
      return row ? toSupplier(row) : null;
    },

    async listSuppliers(status) {
      const rows = await client.inventorySupplier.findMany({
        where: status === 'all' ? {} : { active: status === 'active' },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      return rows.map(toSupplier);
    },

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
    ...kardexTxOn(tx),

    async activeItemIdByNameKey(nameKey) {
      const row = await tx.inventoryItem.findUnique({ where: { activeNameKey: nameKey }, select: { id: true } });
      return row?.id ?? null;
    },

    async insertItem(item) {
      const row = await unique(() => tx.inventoryItem.create({ data: itemColumns(item) }), ItemNameTakenError);
      if (item.units.length > 0) await tx.inventoryItemUnit.createMany({ data: unitRows(row.id, item.units) });
      if (item.kind !== 'parent') await tx.inventoryStock.create({ data: { itemId: row.id, updatedAt: item.createdAt } });
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

    async activeSupplierIdByNameKey(nameKey) {
      const row = await tx.inventorySupplier.findUnique({ where: { activeNameKey: nameKey }, select: { id: true } });
      return row?.id ?? null;
    },

    async insertSupplier(supplier) {
      const row = await unique(() => tx.inventorySupplier.create({ data: supplierColumns(supplier) }), SupplierNameTakenError);
      return toSupplier(row);
    },

    async replaceSupplier(supplier, expectedVersion) {
      const { id, ...rest } = supplier;
      const { count } = await unique(() => tx.inventorySupplier.updateMany({ where: { id, version: expectedVersion }, data: supplierColumns(rest) }), SupplierNameTakenError);
      return count === 1;
    },

    async lockStock(itemIds) {
      const ids = [...new Set(itemIds)].sort((a, b) => a - b);
      if (ids.length === 0) return;
      const lock = () => tx.$queryRaw<{ item_id: number }[]>`SELECT item_id FROM inventory_stock WHERE item_id IN (${Prisma.join(ids)}) ORDER BY item_id FOR UPDATE`;
      const locked = new Set((await lock()).map((row) => Number(row.item_id)));
      const missing = ids.filter((id) => !locked.has(id));
      if (missing.length === 0) return;
      // DT-T3-2: solo artículos que existen y no son padres (la clave foránea rechazaría el resto).
      const items = await tx.inventoryItem.findMany({ where: { id: { in: missing }, kind: { not: 'parent' } }, select: { id: true } });
      if (items.length === 0) return;
      const at = new Date();
      await tx.inventoryStock.createMany({ data: items.map((item) => ({ itemId: item.id, updatedAt: at })), skipDuplicates: true });
      await lock();
    },

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
 * `readTimeoutMs`: lo mismo para `read`; solo `inventory:verify` (REQ-F-051), que lee todo el Kardex en
 * una lectura consistente, lo sube.
 */
export function createPrismaInventoryStore({
  prisma,
  writeTimeoutMs = WRITE_TX.timeout,
  readTimeoutMs = READ_TX.timeout,
}: {
  prisma: Database;
  writeTimeoutMs?: number;
  readTimeoutMs?: number;
}): InventoryStore {
  if (!prisma) throw new TypeError('createPrismaInventoryStore requiere el cliente de la base de datos');
  if (!(Number.isSafeInteger(writeTimeoutMs) && writeTimeoutMs > 0)) throw new TypeError('writeTimeoutMs debe ser un entero positivo');
  if (!(Number.isSafeInteger(readTimeoutMs) && readTimeoutMs > 0)) throw new TypeError('readTimeoutMs debe ser un entero positivo');
  const writeTx = { ...WRITE_TX, timeout: writeTimeoutMs };
  const readTx = { ...READ_TX, timeout: readTimeoutMs };

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
    read: (task) => run(() => prisma.$transaction((tx) => task(readerOn(tx)), readTx)),
    transaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)), writeTx)),
    recipeTransaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)), RECIPE_TX)),
    kardexTransaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)), KARDEX_TX)),
  });
}
