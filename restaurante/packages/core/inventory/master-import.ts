import { validateCategoryFields, type InventoryCategory } from './category-schema.ts';
import { InventoryError, type FieldErrors } from './errors.ts';
import { categoryHistorySnapshot, historyChanges, itemHistorySnapshot, normalizeAuthor, type InventoryAuthor } from './inventory-repository.ts';
import {
  INVENTORY_ACTIONS,
  RECIPE_ACTIONS,
  type FieldChange,
  type InventoryAction,
  type InventoryEntity,
  type InventoryStore,
  type InventoryStoreReader,
  type InventoryStoreTx,
  type NewItem,
  type RecipeAction,
} from './inventory-store.ts';
import {
  PARENT_TYPES,
  costFieldErrors,
  isItemType,
  readInventoriable,
  readReferenceCost,
  skuKey,
  unitsSnapshot,
  validateItemFields,
  type InventoryItem,
  type ItemKind,
  type ItemType,
} from './item-schema.ts';
import { buildAdjacency, findCycle, recipeDepth } from './recipe-graph.ts';
import { RECIPE_LIMITS, readRecipeInput, recipeAllowed, resolveRecipeLines, sameRecipeContent, type RecipeLine, type RecipeLineInput } from './recipe-schema.ts';
import { nameKey } from './text.ts';

/**
 * Importación única de datos maestros del inventario (REQ-F-050, A5; PV-5 modificada por el usuario):
 * categorías, artículos (simples, padres con variantes), costos de referencia, el atributo
 * inventariable y recetas, desde un JSON generado fuera del repositorio. Sin existencias, compras,
 * proveedores, mínimos ni precios.
 *
 * - `parseImportFile`: forma del archivo (lista cerrada de claves; decimales como texto).
 * - El plan valida con las mismas funciones de core que la API (validateItemFields, costFieldErrors,
 *   readRecipeInput, resolveRecipeLines, findCycle y recipeDepth) y lo compara con lo guardado:
 *   clave natural = nombre normalizado. Igual en todo lo importado: se omite. Distinto: conflicto, que
 *   no se sobrescribe (PT-2: con un error o un conflicto no se escribe nada).
 * - `correcciones`: tabla de nombres que revisa el usuario (respuesta 6), con coincidencia exacta tras
 *   recortar; el código no tiene ninguna regla fija sobre nombres ni sobre la carne (la merma de
 *   cocción ya viene calculada en el archivo revisado, RN-T2-1).
 * - Unidades: `gr` -> g y `lt` -> L; kg, g, L, ml, pza y hr sin cambios; el resto, error.
 * - `runMasterImport`: el ensayo (por defecto) solo lee; la escritura es una transacción, todo o nada,
 *   que vuelve a calcular el plan dentro de ella con el candado de recetas tomado. Las recetas entran
 *   como versión vigente desde la importación y todo queda en el historial con el autor "Importación".
 * - Los errores y los conflictos se informan con la `fila` del origen, el campo y un mensaje, sin los
 *   valores del archivo (ni nombres, ni cantidades, ni costos): un ciclo se informa con las filas de
 *   sus recetas.
 */

export const IMPORT_FORMAT = 'inventario-importacion';
export const IMPORT_FORMAT_VERSION = 1;
/** Tamaño máximo del archivo (lo comprueba quien lo lee). */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_AUTHOR: InventoryAuthor = Object.freeze({ id: null, name: 'Importación' });
/** Máximo de entradas por lista (defensa ante un archivo desmesurado). */
const LIST_MAX = 5000;
const FILA_MAX = 60;
const PAGE_SIZE = 500;

/** Error, conflicto o aviso: dónde (fila del origen o ruta en el JSON), qué campo y por qué. Sin valores. */
export interface ImportIssue {
  fila: string;
  campo: string;
  mensaje: string;
}

export interface ImportCounts {
  categorias: number;
  articulos: number;
  variantes: number;
  recetas: number;
  lineas: number;
}

export interface ImportReport {
  mode: 'ensayo' | 'escritura';
  /** true solo si la escritura terminó (todo o nada). */
  written: boolean;
  /** Marca del archivo de pruebas (nunca va a producción). */
  ficticio: boolean;
  /** Lo que se crea (escritura) o se crearía (ensayo). */
  created: ImportCounts;
  /** Lo que ya existe igual y se omite. */
  omitted: Omit<ImportCounts, 'lineas'>;
  conflicts: ImportIssue[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

// --- Forma del archivo -------------------------------------------------------------------------

interface FilePackaging {
  nombre: unknown;
  factor: unknown;
}
interface FileItemFields {
  nombre: string;
  descripcion: unknown;
  sku: unknown;
  unidadBase: unknown;
  empaques: FilePackaging[];
  costoReferencia: unknown;
  inventariable: unknown;
  fila: string;
}
interface FileItem extends FileItemFields {
  tipo: unknown;
  categoria: string;
}
interface FileParent {
  nombre: string;
  tipo: unknown;
  categoria: string;
  descripcion: unknown;
  fila: string;
  variantes: FileItemFields[];
}
interface FileLine {
  ingrediente: string;
  cantidad: unknown;
  unidad: unknown;
  merma: unknown;
  nota: unknown;
  fila: string;
}
interface FileRecipe {
  articulo: string;
  rendimiento: unknown;
  nota: unknown;
  fila: string;
  lineas: FileLine[];
}
export interface ImportFile {
  ficticio: boolean;
  correcciones: { original: string; corregido: string; fila: string }[];
  categorias: { nombre: string; fila: string }[];
  articulos: FileItem[];
  padres: FileParent[];
  recetas: FileRecipe[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Lector estricto: claves conocidas, tipos y listas; acumula los errores con la ruta en el JSON. */
function createShapeReader(issues: ImportIssue[]) {
  const fail = (fila: string, campo: string, mensaje: string) => {
    issues.push({ fila, campo, mensaje });
  };

  function record(value: unknown, path: string, allowed: readonly string[], required: readonly string[]): Record<string, unknown> | null {
    if (!isRecord(value)) {
      fail(path, '', 'Debe ser un objeto.');
      return null;
    }
    // Los mensajes señalan la fila del origen si la entrada la trae; si no, la ruta en el JSON.
    const where = typeof value.fila === 'string' && value.fila.trim() !== '' && [...value.fila.trim()].length <= FILA_MAX ? value.fila.trim() : path;
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(where, key, 'Campo desconocido.');
    for (const key of required) if (!(key in value)) fail(where, key, 'Falta el campo.');
    return value;
  }

  function list(value: unknown, path: string, field: string, optional = false): unknown[] {
    if (value === undefined && optional) return [];
    if (!Array.isArray(value)) {
      fail(path, field, 'Debe ser una lista.');
      return [];
    }
    // Array.isArray lo tipa como any[]: sus elementos se validan uno a uno.
    const rows = value as unknown[];
    if (rows.length > LIST_MAX) {
      fail(path, field, `Máximo ${LIST_MAX} entradas.`);
      return [];
    }
    return rows;
  }

  /** Texto obligatorio (el contenido lo validan las funciones de core). */
  function text(value: unknown, path: string, field: string): string {
    if (typeof value !== 'string') {
      fail(path, field, 'Debe ser texto.');
      return '';
    }
    return value;
  }

  /** Texto o null opcional (decimales, notas, SKU): los demás tipos son error. */
  function optionalText(value: unknown, path: string, field: string): unknown {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') fail(path, field, 'Debe ser texto o null.');
    return value;
  }

  /** Referencia al origen («Hoja!fila») para los mensajes; si falta o no vale, la ruta en el JSON. */
  function fila(value: unknown, path: string): string {
    if (typeof value === 'string' && value.trim() !== '' && [...value.trim()].length <= FILA_MAX) return value.trim();
    fail(path, 'fila', `Escribe la referencia al origen (texto de hasta ${FILA_MAX} caracteres).`);
    return path;
  }

  return { fail, record, list, text, optionalText, fila };
}

const ITEM_FIELD_KEYS = ['nombre', 'descripcion', 'sku', 'unidadBase', 'empaques', 'costoReferencia', 'inventariable', 'fila'] as const;

/** Valida la forma del archivo (versión 1). No consulta datos ni valida contenidos: eso lo hace el plan. */
export function parseImportFile(raw: unknown): { ok: true; file: ImportFile } | { ok: false; errors: ImportIssue[] } {
  const errors: ImportIssue[] = [];
  const shape = createShapeReader(errors);
  const root = shape.record(raw, '$', ['formato', 'version', 'ficticio', 'correcciones', 'categorias', 'articulos', 'padres', 'recetas'], ['formato', 'version', 'categorias', 'articulos']);
  if (!root) return { ok: false, errors };
  if (root.formato !== IMPORT_FORMAT) shape.fail('$', 'formato', `Debe ser "${IMPORT_FORMAT}".`);
  if (root.version !== IMPORT_FORMAT_VERSION) shape.fail('$', 'version', `Versión de formato no admitida (se admite ${IMPORT_FORMAT_VERSION}).`);
  if (root.ficticio !== undefined && typeof root.ficticio !== 'boolean') shape.fail('$', 'ficticio', 'Debe ser verdadero o falso.');

  const itemFields = (value: unknown, path: string, extra: readonly string[], required: readonly string[]): (FileItemFields & Record<string, unknown>) | null => {
    const row = shape.record(value, path, [...ITEM_FIELD_KEYS, ...extra], ['nombre', 'fila', ...required]);
    if (!row) return null;
    const fila = shape.fila(row.fila, path);
    const empaques = shape.list(row.empaques, fila, 'empaques', true).flatMap((entry, index) => {
      const packaging = shape.record(entry, `${fila} empaques.${index}`, ['nombre', 'factor'], ['nombre', 'factor']);
      return packaging ? [{ nombre: packaging.nombre, factor: packaging.factor }] : [];
    });
    if (row.inventariable !== undefined && typeof row.inventariable !== 'boolean') shape.fail(fila, 'inventariable', 'Debe ser verdadero o falso.');
    return {
      ...row,
      nombre: shape.text(row.nombre, fila, 'nombre'),
      descripcion: shape.optionalText(row.descripcion, fila, 'descripcion'),
      sku: shape.optionalText(row.sku, fila, 'sku'),
      unidadBase: row.unidadBase,
      empaques,
      costoReferencia: shape.optionalText(row.costoReferencia, fila, 'costoReferencia'),
      inventariable: row.inventariable ?? true,
      fila,
    };
  };

  const correcciones = shape.list(root.correcciones, '$', 'correcciones', true).flatMap((entry, index) => {
    const path = `correcciones.${index}`;
    const row = shape.record(entry, path, ['original', 'corregido', 'motivo'], ['original', 'corregido']);
    if (!row) return [];
    if (row.motivo !== undefined && row.motivo !== null && typeof row.motivo !== 'string') shape.fail(path, 'motivo', 'Debe ser texto.');
    return [{ original: shape.text(row.original, path, 'original'), corregido: shape.text(row.corregido, path, 'corregido'), fila: path }];
  });

  const categorias = shape.list(root.categorias, '$', 'categorias').flatMap((entry, index) => {
    const row = shape.record(entry, `categorias.${index}`, ['nombre', 'fila'], ['nombre', 'fila']);
    if (!row) return [];
    const fila = shape.fila(row.fila, `categorias.${index}`);
    return [{ nombre: shape.text(row.nombre, fila, 'nombre'), fila }];
  });

  const articulos = shape.list(root.articulos, '$', 'articulos').flatMap((entry, index): FileItem[] => {
    const row = itemFields(entry, `articulos.${index}`, ['tipo', 'categoria'], ['tipo', 'categoria', 'unidadBase']);
    return row ? [{ ...row, tipo: row.tipo, categoria: shape.text(row.categoria, row.fila, 'categoria') }] : [];
  });

  const padres = shape.list(root.padres, '$', 'padres', true).flatMap((entry, index): FileParent[] => {
    const path = `padres.${index}`;
    const row = shape.record(entry, path, ['nombre', 'tipo', 'categoria', 'descripcion', 'fila', 'variantes'], ['nombre', 'tipo', 'categoria', 'fila', 'variantes']);
    if (!row) return [];
    const fila = shape.fila(row.fila, path);
    const variantes = shape.list(row.variantes, fila, 'variantes').flatMap((variant, position) => {
      const parsed = itemFields(variant, `${fila} variantes.${position}`, [], ['unidadBase']);
      return parsed ? [parsed] : [];
    });
    return [{ nombre: shape.text(row.nombre, fila, 'nombre'), tipo: row.tipo, categoria: shape.text(row.categoria, fila, 'categoria'), descripcion: shape.optionalText(row.descripcion, fila, 'descripcion'), fila, variantes }];
  });

  const recetas = shape.list(root.recetas, '$', 'recetas', true).flatMap((entry, index): FileRecipe[] => {
    const path = `recetas.${index}`;
    const row = shape.record(entry, path, ['articulo', 'rendimiento', 'nota', 'fila', 'lineas'], ['articulo', 'rendimiento', 'fila', 'lineas']);
    if (!row) return [];
    const fila = shape.fila(row.fila, path);
    const lineas = shape.list(row.lineas, fila, 'lineas').flatMap((line, position): FileLine[] => {
      const linePath = `${fila} lineas.${position}`;
      const parsed = shape.record(line, linePath, ['ingrediente', 'cantidad', 'unidad', 'merma', 'nota', 'fila'], ['ingrediente', 'cantidad', 'unidad', 'fila']);
      if (!parsed) return [];
      const lineFila = shape.fila(parsed.fila, linePath);
      return [
        {
          ingrediente: shape.text(parsed.ingrediente, lineFila, 'ingrediente'),
          cantidad: shape.optionalText(parsed.cantidad, lineFila, 'cantidad'),
          unidad: shape.text(parsed.unidad, lineFila, 'unidad'),
          merma: shape.optionalText(parsed.merma, lineFila, 'merma'),
          nota: shape.optionalText(parsed.nota, lineFila, 'nota'),
          fila: lineFila,
        },
      ];
    });
    return [{ articulo: shape.text(row.articulo, fila, 'articulo'), rendimiento: shape.optionalText(row.rendimiento, fila, 'rendimiento'), nota: shape.optionalText(row.nota, fila, 'nota'), fila, lineas }];
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, file: { ficticio: root.ficticio === true, correcciones, categorias, articulos, padres, recetas } };
}

// --- Plan --------------------------------------------------------------------------------------

/** Unidades del archivo: alias del libro y unidades del sistema (sin distinguir mayúsculas). */
const UNIT_ALIASES: Readonly<Record<string, string>> = Object.freeze({ gr: 'g', g: 'g', kg: 'kg', lt: 'L', l: 'L', ml: 'ml', pza: 'pza', hr: 'hr' });
const normalizeUnit = (raw: unknown): string | null => (typeof raw === 'string' ? (UNIT_ALIASES[raw.trim().toLowerCase()] ?? null) : null);

/** Nombres de los campos de core -> claves del archivo (los mensajes señalan la clave del archivo). */
const ITEM_FIELD_NAMES: Readonly<Record<string, string>> = Object.freeze({
  name: 'nombre',
  description: 'descripcion',
  sku: 'sku',
  baseUnit: 'unidadBase',
  units: 'empaques',
  referenceCost: 'costoReferencia',
  inventoriable: 'inventariable',
  type: 'tipo',
});
const LINE_FIELD_NAMES: Readonly<Record<string, string>> = Object.freeze({ ingredient: 'ingrediente', quantity: 'cantidad', unit: 'unidad', wastePercent: 'merma', note: 'nota' });

function itemFieldName(field: string): string {
  const match = /^units\.(\d+)(?:\.(name|factor))?$/.exec(field);
  if (match) return `empaques.${match[1]}${match[2] ? `.${match[2] === 'name' ? 'nombre' : 'factor'}` : ''}`;
  return ITEM_FIELD_NAMES[field] ?? field;
}

type Ref = { kind: 'existing'; id: number } | { kind: 'new'; index: number };

interface PlannedCategory {
  name: string;
  nameKey: string;
  fila: string;
}
interface PlannedItem {
  /** Id provisional (mayor que cualquier id guardado) mientras no se escribe. */
  provisionalId: number;
  kind: ItemKind;
  item: InventoryItem;
  categoryRef: Ref;
  parentRef: Ref | null;
  fila: string;
}
interface PlannedRecipe {
  itemRef: Ref & { provisionalId: number };
  yieldQuantity: bigint;
  note: string | null;
  lines: RecipeLine[];
  fila: string;
}

export interface ImportPlan {
  report: ImportReport;
  categories: PlannedCategory[];
  items: PlannedItem[];
  recipes: PlannedRecipe[];
}

/** Todos los artículos guardados (activos e inactivos), por páginas. */
async function allItems(reader: InventoryStoreReader): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];
  for (let page = 1; ; page += 1) {
    const result = await reader.listItems({ status: 'all', type: null, categoryId: null, q: null, page, pageSize: PAGE_SIZE });
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}

const emptyCounts = (): ImportCounts => ({ categorias: 0, articulos: 0, variantes: 0, recetas: 0, lineas: 0 });

/** Plan de la importación con los datos guardados: qué se crea, qué se omite y qué choca. Solo lee. */
export async function planImport(reader: InventoryStoreReader, file: ImportFile, { mode, at, author = IMPORT_AUTHOR }: { mode: ImportReport['mode']; at: Date; author?: InventoryAuthor }): Promise<ImportPlan> {
  const report: ImportReport = { mode, written: false, ficticio: file.ficticio, created: emptyCounts(), omitted: { categorias: 0, articulos: 0, variantes: 0, recetas: 0 }, conflicts: [], errors: [], warnings: [] };
  const error = (fila: string, campo: string, mensaje: string) => report.errors.push({ fila, campo, mensaje });
  const conflict = (fila: string, campo: string, mensaje: string) => report.conflicts.push({ fila, campo, mensaje });

  // 1. Correcciones de nombres (coincidencia exacta tras recortar).
  const corrections = new Map<string, { to: string; fila: string; used: boolean }>();
  for (const entry of file.correcciones) {
    const original = entry.original.trim();
    const corrected = entry.corregido.trim();
    if (original === '' || corrected === '') error(entry.fila, original === '' ? 'original' : 'corregido', 'No puede estar vacío.');
    else if (corrections.has(original)) error(entry.fila, 'original', `Corrección repetida (ya está en ${corrections.get(original)?.fila ?? '?'}).`);
    else corrections.set(original, { to: corrected, fila: entry.fila, used: false });
  }
  const fix = (raw: string): string => {
    const name = raw.trim();
    const correction = corrections.get(name);
    if (!correction) return name;
    correction.used = true;
    return correction.to;
  };

  // 2. Lo guardado.
  const [categories, items, current] = await Promise.all([reader.listCategories(), allItems(reader), reader.currentRecipes()]);
  const activeCategoryByKey = new Map(categories.filter((category) => category.active).map((category) => [category.nameKey, category]));
  const categoryById = new Map<number, InventoryCategory>(categories.map((category) => [category.id, category]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const activeItemByKey = new Map(items.filter((item) => item.active).map((item) => [item.nameKey, item]));
  const skuOwnerByKey = new Map(items.flatMap((item) => (item.sku === null ? [] : [[skuKey(item.sku), item] as const])));
  const currentByItem = new Map(current.map((version) => [version.itemId, version]));

  // 3. Categorías.
  const plannedCategories: PlannedCategory[] = [];
  const categoryRefByKey = new Map<string, Ref>();
  const categoryFilaByKey = new Map<string, string>();
  for (const entry of file.categorias) {
    const fields = validateCategoryFields({ name: fix(entry.nombre) });
    if (!fields.ok) {
      for (const [field, message] of Object.entries(fields.errors)) error(entry.fila, field === 'name' ? 'nombre' : field, message);
      continue;
    }
    const { name, nameKey: key } = fields.value;
    const previous = categoryFilaByKey.get(key);
    if (previous) {
      error(entry.fila, 'nombre', `Categoría repetida en el archivo (ya está en ${previous}).`);
      continue;
    }
    categoryFilaByKey.set(key, entry.fila);
    const existing = activeCategoryByKey.get(key);
    if (existing) {
      if (existing.name === name) {
        report.omitted.categorias += 1;
        categoryRefByKey.set(key, { kind: 'existing', id: existing.id });
      } else conflict(entry.fila, 'nombre', 'Ya existe una categoría con ese nombre escrito de otra forma: no se sobrescribe.');
      continue;
    }
    categoryRefByKey.set(key, { kind: 'new', index: plannedCategories.length });
    plannedCategories.push({ name, nameKey: key, fila: entry.fila });
  }
  const resolveCategory = (raw: string, fila: string): Ref | null => {
    const key = nameKey(fix(raw));
    const ref = categoryRefByKey.get(key) ?? (activeCategoryByKey.has(key) ? { kind: 'existing' as const, id: activeCategoryByKey.get(key)?.id ?? 0 } : null);
    if (!ref) error(fila, 'categoria', 'La categoría no está en el archivo ni activa en el inventario.');
    return ref;
  };

  // 4. Artículos: padres, simples y variantes.
  const plannedItems: PlannedItem[] = [];
  const itemRefByKey = new Map<string, Ref>();
  const itemFilaByKey = new Map<string, string>();
  const skuFilaByKey = new Map<string, string>();
  /** Artículos que intervienen en las recetas: guardados y nuevos (con id provisional). */
  const recipeItems = new Map<number, InventoryItem>();
  // Ids provisionales por encima de los guardados: las funciones de core exigen ids positivos.
  let nextProvisional = Math.max(0, ...items.map((item) => item.id)) + 1;

  const categoryNameKeyOf = (item: InventoryItem): string | null => categoryById.get(item.categoryId)?.nameKey ?? null;
  const parentNameKeyOf = (item: InventoryItem): string | null => (item.parentId === null ? null : (itemById.get(item.parentId)?.nameKey ?? null));

  const planItem = (entry: { fields: Partial<FileItemFields> & { nombre: string; fila: string }; kind: ItemKind; type: unknown; category: Ref | null; categoryKey: string | null; parent: Ref | null; parentKey: string | null }): void => {
    const { fields: source, kind } = entry;
    const fila = source.fila;
    const errors: FieldErrors = {};
    let type: ItemType | null = null;
    if (isItemType(entry.type)) type = entry.type;
    else errors.type = 'Elige insumo, intermedio, compuesto o reventa.';
    if (kind === 'parent' && type !== null && !PARENT_TYPES.includes(type)) errors.type = 'Un artículo padre solo puede ser de Reventa o Compuesto.';
    let baseUnit: string | null = null;
    if (kind !== 'parent') {
      baseUnit = normalizeUnit(source.unidadBase);
      if (baseUnit === null) errors.baseUnit = 'Unidad desconocida (usa kg, g o gr, L o lt, ml, pza o hr).';
    }
    const validated = validateItemFields(
      {
        name: fix(source.nombre),
        description: source.descripcion ?? null,
        sku: source.sku ?? null,
        baseUnit,
        units: (source.empaques ?? []).map((packaging) => ({ name: packaging.nombre, factor: packaging.factor })),
      },
      kind,
    );
    if (!validated.ok) for (const [field, message] of Object.entries(validated.errors)) if (!(field === 'baseUnit' && errors.baseUnit)) errors[field] = message;
    const referenceCost = readReferenceCost(source.costoReferencia ?? null);
    if ('error' in referenceCost) errors.referenceCost = referenceCost.error;
    const inventoriable = readInventoriable(source.inventariable ?? true);
    if ('error' in inventoriable) errors.inventoriable = inventoriable.error;
    if (type !== null && 'value' in referenceCost && 'value' in inventoriable) Object.assign(errors, costFieldErrors(kind, type, referenceCost.value, inventoriable.value));
    for (const [field, message] of Object.entries(errors)) error(fila, itemFieldName(field), message);
    if (!validated.ok || Object.keys(errors).length > 0 || type === null || !('value' in referenceCost) || !('value' in inventoriable)) return;
    if (entry.category === null || (kind === 'variant' && entry.parent === null)) return;

    const fields = validated.value;
    const previous = itemFilaByKey.get(fields.nameKey);
    if (previous) {
      error(fila, 'nombre', `Nombre repetido en el archivo (ya está en ${previous}): el nombre es único en todo el catálogo.`);
      return;
    }
    itemFilaByKey.set(fields.nameKey, fila);
    if (fields.sku !== null) {
      const key = skuKey(fields.sku);
      const skuFila = skuFilaByKey.get(key);
      if (skuFila) error(fila, 'sku', `SKU repetido en el archivo (ya está en ${skuFila}).`);
      skuFilaByKey.set(key, fila);
      const owner = skuOwnerByKey.get(key);
      if (owner && owner.nameKey !== fields.nameKey) error(fila, 'sku', 'El SKU ya lo usa otro artículo del inventario.');
    }

    const existing = activeItemByKey.get(fields.nameKey);
    if (existing) {
      const differs: string[] = [];
      const compare = (field: string, before: unknown, after: unknown) => {
        if (JSON.stringify(before) !== JSON.stringify(after)) differs.push(field);
      };
      compare('tipo', existing.type, type);
      compare('clase', existing.kind, kind);
      compare('categoria', categoryNameKeyOf(existing), entry.categoryKey);
      compare('padre', parentNameKeyOf(existing), entry.parentKey);
      compare('nombre', existing.name, fields.name);
      compare('descripcion', existing.description, fields.description);
      compare('sku', existing.sku, fields.sku);
      compare('unidadBase', existing.baseUnit, fields.baseUnit);
      compare('empaques', unitsSnapshot(existing.units), unitsSnapshot(fields.units));
      compare('costoReferencia', existing.referenceCost?.toString() ?? null, referenceCost.value?.toString() ?? null);
      compare('inventariable', existing.inventoriable, inventoriable.value);
      if (differs.length > 0) {
        conflict(fila, differs.join(', '), 'Ya existe un artículo activo con ese nombre y datos distintos: no se sobrescribe.');
        return;
      }
      if (kind === 'variant') report.omitted.variantes += 1;
      else report.omitted.articulos += 1;
      itemRefByKey.set(fields.nameKey, { kind: 'existing', id: existing.id });
      recipeItems.set(existing.id, existing);
      return;
    }

    const provisionalId = nextProvisional;
    nextProvisional += 1;
    const item: InventoryItem = {
      id: provisionalId,
      kind,
      type,
      parentId: entry.parent === null ? null : entry.parent.kind === 'existing' ? entry.parent.id : (plannedItems[entry.parent.index]?.provisionalId ?? null),
      categoryId: entry.category.kind === 'existing' ? entry.category.id : -(entry.category.index + 1),
      ...fields,
      active: true,
      version: 1,
      createdAt: at,
      updatedAt: at,
      updatedById: author.id,
      updatedByName: author.name,
      referenceCost: referenceCost.value,
      inventoriable: inventoriable.value,
    };
    itemRefByKey.set(fields.nameKey, { kind: 'new', index: plannedItems.length });
    plannedItems.push({ provisionalId, kind, item, categoryRef: entry.category, parentRef: entry.parent, fila });
    recipeItems.set(provisionalId, item);
    if (kind === 'variant') report.created.variantes += 1;
    else report.created.articulos += 1;
  };

  for (const parent of file.padres) {
    const category = resolveCategory(parent.categoria, parent.fila);
    const categoryKey = nameKey(fix(parent.categoria));
    planItem({ fields: { nombre: parent.nombre, descripcion: parent.descripcion, fila: parent.fila }, kind: 'parent', type: parent.tipo, category, categoryKey, parent: null, parentKey: null });
    const parentKey = nameKey(fix(parent.nombre));
    const parentRef = itemRefByKey.get(parentKey) ?? null;
    for (const variant of parent.variantes) {
      if (parentRef === null) {
        error(variant.fila, 'padre', 'El artículo padre no se pudo importar: revisa su fila.');
        continue;
      }
      planItem({ fields: variant, kind: 'variant', type: parent.tipo, category, categoryKey, parent: parentRef, parentKey });
    }
  }
  for (const entry of file.articulos) {
    planItem({ fields: entry, kind: 'simple', type: entry.tipo, category: resolveCategory(entry.categoria, entry.fila), categoryKey: nameKey(fix(entry.categoria)), parent: null, parentKey: null });
  }

  const resolveItem = (raw: string): InventoryItem | null => {
    const key = nameKey(fix(raw));
    const ref = itemRefByKey.get(key);
    if (ref) return ref.kind === 'existing' ? (itemById.get(ref.id) ?? null) : (plannedItems[ref.index]?.item ?? null);
    return activeItemByKey.get(key) ?? null;
  };

  // 5. Recetas.
  const plannedRecipes: PlannedRecipe[] = [];
  const recipeFilaByItem = new Map<number, string>();
  for (const recipe of file.recetas) {
    const target = resolveItem(recipe.articulo);
    if (!target) {
      error(recipe.fila, 'articulo', 'El artículo no está en el archivo ni activo en el inventario.');
      continue;
    }
    if (!recipeAllowed(target)) {
      error(recipe.fila, 'articulo', 'Solo un artículo Intermedio o Compuesto (que no sea padre) lleva receta.');
      continue;
    }
    const previous = recipeFilaByItem.get(target.id);
    if (previous) {
      error(recipe.fila, 'articulo', `Receta repetida para el mismo artículo (ya está en ${previous}).`);
      continue;
    }
    recipeFilaByItem.set(target.id, recipe.fila);

    let unresolved = false;
    const lines: RecipeLineInput[] = recipe.lineas.map((line) => {
      const ingredient = resolveItem(line.ingrediente);
      if (!ingredient) {
        unresolved = true;
        error(line.fila, 'ingrediente', 'El ingrediente no está en el archivo ni activo en el inventario.');
      } else recipeItems.set(ingredient.id, ingredient);
      const unit = typeof line.unidad === 'string' ? (normalizeUnit(line.unidad) ?? line.unidad.trim()) : line.unidad;
      return { ingredientId: ingredient?.id ?? null, quantity: line.cantidad, unit, wastePercent: line.merma, note: line.nota };
    });
    if (unresolved) continue;

    const fieldErrors: FieldErrors = {};
    const parsed = readRecipeInput({ baseVersionId: null, yieldQuantity: recipe.rendimiento, note: recipe.nota, lines });
    const resolved = parsed.ok ? resolveRecipeLines(parsed.value.lines, recipeItems, fieldErrors) : [];
    const allErrors = parsed.ok ? fieldErrors : parsed.errors;
    for (const [field, message] of Object.entries(allErrors)) {
      const match = /^lines\.(\d+)(?:\.(\w+))?$/.exec(field);
      const line = match ? recipe.lineas[Number(match[1])] : undefined;
      if (match && line) error(line.fila, match[2] ? (LINE_FIELD_NAMES[match[2]] ?? match[2]) : '', message);
      else error(recipe.fila, field === 'yieldQuantity' ? 'rendimiento' : field === 'note' ? 'nota' : field === 'lines' ? 'lineas' : field, message);
    }
    if (!parsed.ok || Object.keys(fieldErrors).length > 0) continue;

    const { yieldQuantity, note } = parsed.value;
    const existingCurrent = currentByItem.get(target.id);
    if (existingCurrent) {
      if (sameRecipeContent(existingCurrent, yieldQuantity, note, resolved)) report.omitted.recetas += 1;
      else {
        // DEF-005: el conflicto señala qué difiere (rendimiento, nota o líneas), como los de artículos.
        const differing = [
          ...(existingCurrent.yieldQuantity === yieldQuantity ? [] : ['rendimiento']),
          ...(existingCurrent.note === note ? [] : ['nota']),
          ...(sameRecipeContent(existingCurrent, existingCurrent.yieldQuantity, existingCurrent.note, resolved) ? [] : ['lineas']),
        ];
        conflict(recipe.fila, differing.join(', '), 'El artículo ya tiene una receta vigente distinta: no se sobrescribe (crea una versión nueva en el admin).');
      }
      continue;
    }
    const ref = itemRefByKey.get(target.nameKey);
    const itemRef: Ref = ref ?? { kind: 'existing', id: target.id };
    plannedRecipes.push({ itemRef: { ...itemRef, provisionalId: target.id }, yieldQuantity, note, lines: resolved, fila: recipe.fila });
    report.created.recetas += 1;
    report.created.lineas += resolved.length;
  }

  // 6. Ciclos y profundidad con las vigentes y las nuevas (RN-5, RF-5).
  const adjacency = buildAdjacency(current);
  for (const recipe of plannedRecipes) adjacency.set(recipe.itemRef.provisionalId, recipe.lines.map((line) => line.ingredientId));
  const reportedCycles = new Set<string>();
  for (const recipe of plannedRecipes) {
    const target = recipe.itemRef.provisionalId;
    const cycle = findCycle(adjacency, target);
    if (cycle) {
      const key = [...new Set(cycle)].sort((a, b) => a - b).join(',');
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        const path = cycle.map((id) => recipeFilaByItem.get(id) ?? 'receta vigente del inventario');
        error(recipe.fila, 'lineas', `La receta se contendría a sí misma: ${path.join(' → ')}.`);
      }
      continue;
    }
    const depth = recipeDepth(adjacency, target);
    if (depth > RECIPE_LIMITS.MAX_DEPTH) error(recipe.fila, 'lineas', `Las recetas quedarían anidadas en ${depth} niveles; el máximo es ${RECIPE_LIMITS.MAX_DEPTH}.`);
  }

  for (const correction of corrections.values()) if (!correction.used) report.warnings.push({ fila: correction.fila, campo: 'original', mensaje: 'La corrección no se usó en ningún nombre.' });
  report.created.categorias = plannedCategories.length;
  return { report, categories: plannedCategories, items: plannedItems, recipes: plannedRecipes };
}

// --- Escritura ---------------------------------------------------------------------------------

/** La importación se rechazó (errores o conflictos): la transacción se deshace y nada queda escrito. */
export class ImportRejectedError extends InventoryError {
  readonly report: ImportReport;

  constructor(report: ImportReport) {
    super('Importación rechazada: no se escribió nada');
    this.name = 'ImportRejectedError';
    this.report = report;
  }
}

/** Escribe el plan dentro de la transacción (con el candado de recetas ya tomado). */
async function applyImport(tx: InventoryStoreTx, plan: ImportPlan, author: InventoryAuthor, at: Date): Promise<void> {
  const record = (entity: InventoryEntity, entityId: number, action: InventoryAction | RecipeAction, changes: FieldChange[]) =>
    tx.addChange({ at, entity, entityId, action, actorId: author.id, actorName: author.name, changes });

  const categoryIds: number[] = [];
  for (const category of plan.categories) {
    const saved = await tx.insertCategory({ name: category.name, nameKey: category.nameKey, active: true, createdAt: at, updatedAt: at });
    categoryIds.push(saved.id);
    await record('category', saved.id, INVENTORY_ACTIONS.CREATE, historyChanges(null, categoryHistorySnapshot(saved)));
  }
  const realId = new Map<number, number>();
  const provisionalIds = new Set(plan.items.map((planned) => planned.provisionalId));
  const resolve = (ref: Ref, provisional: (index: number) => number | undefined): number => {
    const id = ref.kind === 'existing' ? ref.id : provisional(ref.index);
    // El plan solo referencia entradas anteriores de su propia lista.
    if (id === undefined) throw new TypeError('Referencia del plan sin resolver');
    return id;
  };
  for (const planned of plan.items) {
    const categoryId = resolve(planned.categoryRef, (index) => categoryIds[index]);
    const parentId = planned.parentRef === null ? null : resolve(planned.parentRef, (index) => realId.get(plan.items[index]?.provisionalId ?? 0));
    // El id provisional no se guarda: el store asigna el definitivo.
    const item: NewItem = { ...planned.item, categoryId, parentId };
    const saved = await tx.insertItem(item);
    realId.set(planned.provisionalId, saved.id);
    if (saved.sku !== null) {
      const owner = await tx.skuOwner(skuKey(saved.sku));
      if (owner !== null && owner !== saved.id) {
        plan.report.errors.push({ fila: planned.fila, campo: 'sku', mensaje: 'Ese SKU ya se usó en otro artículo del inventario.' });
        throw new ImportRejectedError(plan.report);
      }
      if (owner === null) await tx.registerSku(skuKey(saved.sku), saved.id, at);
    }
    await record('item', saved.id, INVENTORY_ACTIONS.CREATE, historyChanges(null, itemHistorySnapshot(saved)));
  }
  for (const recipe of plan.recipes) {
    const itemId = recipe.itemRef.kind === 'existing' ? recipe.itemRef.id : realId.get(recipe.itemRef.provisionalId);
    if (itemId === undefined) throw new TypeError('Receta del plan sin artículo');
    const lines = recipe.lines.map((line) => {
      // El plan distingue sin ambigüedad: los ids provisionales son mayores que cualquier id guardado.
      const ingredientId = provisionalIds.has(line.ingredientId) ? realId.get(line.ingredientId) : line.ingredientId;
      if (ingredientId === undefined) throw new TypeError('Línea del plan sin ingrediente');
      return { ...line, ingredientId };
    });
    const previous = await tx.recipeVersions(itemId);
    const number = Math.max(0, ...previous.map((version) => version.number)) + 1;
    await tx.insertRecipeVersion({ itemId, number, yieldQuantity: recipe.yieldQuantity, validFrom: at, note: recipe.note, createdAt: at, createdById: author.id, createdByName: author.name, lines });
    await record('recipe', itemId, RECIPE_ACTIONS.NEW_VERSION, [
      { field: 'number', before: null, after: number },
      { field: 'yieldQuantity', before: null, after: recipe.yieldQuantity.toString() },
      { field: 'lines', before: null, after: lines.length },
    ]);
  }
}

const hasProblems = (report: ImportReport): boolean => report.errors.length > 0 || report.conflicts.length > 0;

/**
 * Importa (o ensaya) un archivo ya leído como JSON. El ensayo solo lee; la escritura es todo o nada y
 * con un error o un conflicto no escribe nada (PT-2). Nunca registra contenidos: devuelve el informe.
 */
export async function runMasterImport({
  store,
  input,
  write,
  author: rawAuthor = IMPORT_AUTHOR,
  now = () => new Date(),
}: {
  store: InventoryStore;
  input: unknown;
  write: boolean;
  author?: InventoryAuthor;
  now?: () => Date;
}): Promise<ImportReport> {
  const author = normalizeAuthor(rawAuthor);
  const mode = write ? 'escritura' : 'ensayo';
  const parsed = parseImportFile(input);
  if (!parsed.ok) {
    const ficticio = isRecord(input) && input.ficticio === true;
    return { mode, written: false, ficticio, created: emptyCounts(), omitted: { categorias: 0, articulos: 0, variantes: 0, recetas: 0 }, conflicts: [], errors: parsed.errors, warnings: [] };
  }
  if (!write) return (await store.read((reader) => planImport(reader, parsed.file, { mode, at: now(), author }))).report;
  try {
    return await store.transaction(async (tx) => {
      await tx.lockRecipes();
      const at = now();
      const plan = await planImport(tx, parsed.file, { mode, at, author });
      if (hasProblems(plan.report)) throw new ImportRejectedError(plan.report);
      await applyImport(tx, plan, author, at);
      return { ...plan.report, written: true };
    });
  } catch (err) {
    if (err instanceof ImportRejectedError) return err.report;
    throw err;
  }
}
