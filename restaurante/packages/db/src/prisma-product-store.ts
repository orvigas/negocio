import type { BusinessId } from '@restaurante/core/shared';
import {
  ProductError,
  SlugTakenError,
  type ChangeSummary,
  type NewProduct,
  type Product,
  type ProductStore,
  type ProductStoreTx,
} from '@restaurante/core/catalog';

import type { Database } from './client.ts';
import { isUniqueViolation, toUnavailable } from './errors.ts';
import type { Prisma } from './generated/prisma/client.ts';

/**
 * Store de productos sobre Prisma/MySQL (REQ-F-008 y REQ-F-014).
 *
 * - Variantes y chips se reemplazan completos en cada escritura, dentro de la misma transacción.
 * - `replace` usa la versión en el WHERE: si otro proceso cambió el producto, no escribe nada.
 * - Los errores inesperados se convierten en DatabaseUnavailableError (503; el log solo lleva
 *   nombre y códigos, nunca el mensaje de Prisma). Un slug repetido es SlugTakenError.
 */

const PRODUCT_INCLUDE = {
  variants: { orderBy: { position: 'asc' } },
  chips: { orderBy: { position: 'asc' } },
} as const;
type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
type Tx = Prisma.TransactionClient;

function toProduct(row: ProductRow): Product {
  const image =
    row.imageSrc !== null && row.imageAlt !== null && row.imageWidth !== null && row.imageHeight !== null
      ? { src: row.imageSrc, alt: row.imageAlt, width: row.imageWidth, height: row.imageHeight }
      : null;
  return {
    id: row.id,
    business: row.business,
    category: row.category,
    detailsType: row.detailsType,
    slug: row.slug,
    name: row.name,
    description: row.description,
    label: row.label,
    priceCents: row.priceCents,
    priceUnit: row.priceUnit,
    image,
    tone: row.tone,
    orderPriceCents: row.orderPriceCents,
    orderQuantity: row.orderQuantity,
    icon: row.icon,
    detailsLabel: row.detailsLabel,
    portion: row.portion,
    portionExtra: row.portionExtra,
    chips: row.chips.map((chip) => ({ text: chip.text, highlight: chip.highlight })),
    variants: row.variants.map((variant) => ({
      label: variant.label,
      priceCents: variant.priceCents,
      description: variant.description,
      available: variant.available,
    })),
    available: row.available,
    position: row.position,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deleted: row.deleted,
    deletedAt: row.deletedAt,
  };
}

/** Columnas escalares de un producto (sin id, variantes ni chips). */
function columns(product: NewProduct) {
  return {
    business: product.business,
    category: product.category,
    detailsType: product.detailsType,
    slug: product.slug,
    name: product.name,
    description: product.description,
    label: product.label,
    priceCents: product.priceCents,
    priceUnit: product.priceUnit,
    imageSrc: product.image?.src ?? null,
    imageAlt: product.image?.alt ?? null,
    imageWidth: product.image?.width ?? null,
    imageHeight: product.image?.height ?? null,
    tone: product.tone,
    orderPriceCents: product.orderPriceCents,
    orderQuantity: product.orderQuantity,
    icon: product.icon,
    detailsLabel: product.detailsLabel,
    portion: product.portion,
    portionExtra: product.portionExtra,
    available: product.available,
    position: product.position,
    version: product.version,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deleted: product.deleted,
    deletedAt: product.deletedAt,
  };
}

async function writeChildren(tx: Tx, productId: number, product: NewProduct): Promise<void> {
  if (product.variants.length > 0) {
    await tx.productVariant.createMany({ data: product.variants.map((variant, index) => ({ productId, position: index + 1, ...variant })) });
  }
  if (product.chips.length > 0) {
    await tx.productChip.createMany({ data: product.chips.map((chip, index) => ({ productId, position: index + 1, ...chip })) });
  }
}

async function listBusiness(client: Tx | Database, business: BusinessId): Promise<Product[]> {
  const rows = await client.product.findMany({ where: { business }, include: PRODUCT_INCLUDE, orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  return rows.map(toProduct);
}

function txOn(tx: Tx): ProductStoreTx {
  return {
    listBusiness: (business) => listBusiness(tx, business),

    async insert(product) {
      const row = await tx.product.create({ data: columns(product) });
      await writeChildren(tx, row.id, product);
      const saved = await tx.product.findUniqueOrThrow({ where: { id: row.id }, include: PRODUCT_INCLUDE });
      return toProduct(saved);
    },

    async replace(product, expectedVersion) {
      const { count } = await tx.product.updateMany({ where: { id: product.id, version: expectedVersion }, data: columns(product) });
      if (count === 0) return false;
      await tx.productVariant.deleteMany({ where: { productId: product.id } });
      await tx.productChip.deleteMany({ where: { productId: product.id } });
      await writeChildren(tx, product.id, product);
      return true;
    },

    async addChange(entry) {
      await tx.productChange.create({
        data: {
          at: entry.at,
          business: entry.business,
          productId: entry.productId,
          slug: entry.slug,
          action: entry.action,
          actorId: entry.actorId,
          actorName: entry.actorName,
          changes: JSON.stringify(entry.changes),
        },
      });
    },

    async isImported(business) {
      return (await tx.productImport.count({ where: { business } })) > 0;
    },

    async markImported(business, { at, source, count }) {
      await tx.productImport.create({ data: { business, importedAt: at, source, count } });
    },
  };
}

const summary = (row: { at: Date; actorId: number | null; actorName: string }): ChangeSummary => ({
  at: row.at,
  actorId: row.actorId,
  actorName: row.actorName,
});

export function createPrismaProductStore({ prisma }: { prisma: Database }): ProductStore {
  if (!prisma) throw new TypeError('createPrismaProductStore requiere el cliente de la base de datos');

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof ProductError) throw err;
      if (isUniqueViolation(err)) throw new SlugTakenError();
      throw toUnavailable(err);
    }
  }

  return Object.freeze<ProductStore>({
    listBusiness: (business) => run(() => listBusiness(prisma, business)),

    lastChanges: (business) =>
      run(async () => {
        const rows = await prisma.productChange.findMany({
          where: { business },
          // El más reciente de cada producto.
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
          distinct: ['productId'],
          select: { productId: true, at: true, actorId: true, actorName: true },
        });
        const result = new Map<number, ChangeSummary>();
        for (const row of rows) result.set(row.productId, summary(row));
        return result;
      }),

    lastBusinessChange: (business) =>
      run(async () => {
        const row = await prisma.productChange.findFirst({
          where: { business },
          orderBy: [{ at: 'desc' }, { id: 'desc' }],
          select: { at: true, actorId: true, actorName: true },
        });
        return row ? summary(row) : null;
      }),

    transaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)))),
  });
}
