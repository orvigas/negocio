import { isBusinessId } from '../shared/index.ts';
import { QUOTE_UNITS, type QuoteCatalog, type QuoteCost, type QuotePackage, type QuoteSaleItem, type QuoteSupply, type QuoteUnit } from './catalog.ts';
import { checkFieldValue, crossCheck, normalizeList, quoteFieldDefs } from './fields.ts';

/**
 * Validación del JSON del cotizador (REQ-F-046, RF-10 y CA-21). Recibe `unknown` y devuelve el catálogo
 * normalizado y congelado, o la lista de problemas con la ruta del JSON y un mensaje que nombra el
 * paquete (o el insumo, la receta...) y el campo. Aplica las mismas reglas que los ajustes de la
 * pantalla (`fields.ts`), más la forma: campos conocidos, ids únicos y referencias existentes.
 */

export interface QuoteCatalogIssue {
  path: string;
  message: string;
}

export type QuoteCatalogParse = { ok: true; catalog: QuoteCatalog } | { ok: false; issues: QuoteCatalogIssue[] };

/** Las claves de los ajustes caben en el contrato (200 como máximo por petición). */
export const QUOTE_MAX_FIELDS = 200;

const ID_PATTERN = /^[a-z0-9-]{1,30}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 60;
const NAME_MAX = 80;
const LIST_MAX = 20;
const RECIPE_MAX = 10;
const PACKAGES_MAX = 8;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

function createReader() {
  const issues: QuoteCatalogIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  const reader = {
    issues,
    add,
    object(value: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Json | null {
      if (!isObject(value)) {
        add(path, 'Debe ser un objeto.');
        return null;
      }
      for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) add(`${path}.${key}`, 'Campo desconocido.');
      for (const key of required) if (!(key in value)) add(`${path}.${key}`, 'Falta este campo.');
      return value;
    },
    array(value: unknown, path: string, min: number, max: number): unknown[] {
      if (!Array.isArray(value)) {
        add(path, 'Debe ser una lista.');
        return [];
      }
      if (value.length < min || value.length > max) add(path, `Debe tener entre ${String(min)} y ${String(max)} elementos.`);
      return value;
    },
    text(value: unknown, path: string): string {
      if (typeof value !== 'string' || value.trim() === '' || value.length > NAME_MAX) {
        add(path, `Debe ser un texto de 1 a ${String(NAME_MAX)} caracteres.`);
        return '';
      }
      return value;
    },
    id(value: unknown, path: string): string {
      if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
        add(path, 'Debe ser un id de 1 a 30 caracteres: minúsculas, números y guiones.');
        return '';
      }
      return value;
    },
    number(value: unknown, path: string): number {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        add(path, 'Debe ser un número.');
        return 0;
      }
      return value;
    },
    optionalNumber(value: unknown, path: string): number | null {
      return value === undefined || value === null ? null : reader.number(value, path);
    },
    boolean(value: unknown, path: string, fallback: boolean): boolean {
      if (value === undefined) return fallback;
      if (typeof value !== 'boolean') {
        add(path, 'Debe ser true o false.');
        return fallback;
      }
      return value;
    },
    uniqueIds(list: readonly { id: string }[], path: string): void {
      const seen = new Set<string>();
      list.forEach(({ id }, index) => {
        if (id !== '' && seen.has(id)) add(`${path}[${String(index)}].id`, `El id "${id}" está repetido.`);
        seen.add(id);
      });
    },
  };
  return reader;
}

type Reader = ReturnType<typeof createReader>;

function readSupply(r: Reader, value: unknown, path: string): QuoteSupply {
  const raw = r.object(value, path, ['id', 'nombre', 'unidad', 'costo'], ['mermaPct', 'presentacion', 'provisional']) ?? {};
  let unidad: QuoteUnit = 'kg';
  if (typeof raw.unidad === 'string' && (QUOTE_UNITS as readonly string[]).includes(raw.unidad)) unidad = raw.unidad as QuoteUnit;
  else r.add(`${path}.unidad`, `Debe ser una de: ${QUOTE_UNITS.join(', ')}.`);
  return {
    id: r.id(raw.id, `${path}.id`),
    nombre: r.text(raw.nombre, `${path}.nombre`),
    unidad,
    costo: r.number(raw.costo, `${path}.costo`),
    mermaPct: r.optionalNumber(raw.mermaPct, `${path}.mermaPct`),
    presentacion: r.optionalNumber(raw.presentacion, `${path}.presentacion`),
    provisional: r.boolean(raw.provisional, `${path}.provisional`, false),
  };
}

function readItem(r: Reader, value: unknown, path: string, supplies: ReadonlySet<string>): QuoteSaleItem {
  const raw = r.object(value, path, ['id', 'nombre', 'producto', 'precioCarta', 'receta'], ['pieza']) ?? {};
  const nombre = r.text(raw.nombre, `${path}.nombre`);
  let producto: string | null = null;
  if (raw.producto !== null) {
    if (typeof raw.producto === 'string' && raw.producto.length <= SLUG_MAX && SLUG_PATTERN.test(raw.producto)) producto = raw.producto;
    else r.add(`${path}.producto`, 'Debe ser el slug de un producto (minúsculas, números y guiones) o null.');
  }
  const seen = new Set<string>();
  const receta = r.array(raw.receta, `${path}.receta`, 1, RECIPE_MAX).map((entry, index) => {
    const linePath = `${path}.receta[${String(index)}]`;
    const line = r.object(entry, linePath, ['insumo', 'cantidad']) ?? {};
    const insumo = r.id(line.insumo, `${linePath}.insumo`);
    if (insumo !== '' && !supplies.has(insumo)) r.add(`${linePath}.insumo`, `Receta de "${nombre}": el insumo "${insumo}" no existe.`);
    if (insumo !== '' && seen.has(insumo)) r.add(`${linePath}.insumo`, `Receta de "${nombre}": el insumo "${insumo}" está repetido.`);
    seen.add(insumo);
    return { insumo, cantidad: r.number(line.cantidad, `${linePath}.cantidad`) };
  });
  return {
    id: r.id(raw.id, `${path}.id`),
    nombre,
    producto,
    precioCarta: r.optionalNumber(raw.precioCarta, `${path}.precioCarta`),
    pieza: r.boolean(raw.pieza, `${path}.pieza`, false),
    receta,
  };
}

function readCost(r: Reader, value: unknown, path: string): QuoteCost {
  const raw = r.object(value, path, ['id', 'concepto', 'costo']) ?? {};
  return { id: r.id(raw.id, `${path}.id`), concepto: r.text(raw.concepto, `${path}.concepto`), costo: r.number(raw.costo, `${path}.costo`) };
}

function readPackage(r: Reader, value: unknown, path: string, items: readonly QuoteSaleItem[]): QuotePackage {
  const raw = r.object(value, path, ['id', 'nombre', 'tarifa', 'items'], ['activo']) ?? {};
  const nombre = r.text(raw.nombre, `${path}.nombre`);
  const tarifa = r.object(raw.tarifa, `${path}.tarifa`, ['a', 'b', 'f']) ?? {};
  const quantities = new Map<string, number>();
  r.array(raw.items, `${path}.items`, 1, LIST_MAX).forEach((entry, index) => {
    const entryPath = `${path}.items[${String(index)}]`;
    const line = r.object(entry, entryPath, ['item', 'porPersona']) ?? {};
    const item = r.id(line.item, `${entryPath}.item`);
    if (item !== '' && !items.some(({ id }) => id === item)) r.add(`${entryPath}.item`, `Paquete "${nombre}": el ítem "${item}" no existe.`);
    if (quantities.has(item)) r.add(`${entryPath}.item`, `Paquete "${nombre}": el ítem "${item}" está repetido.`);
    quantities.set(item, r.number(line.porPersona, `${entryPath}.porPersona`));
  });
  return {
    id: r.id(raw.id, `${path}.id`),
    nombre,
    activo: r.boolean(raw.activo, `${path}.activo`, true),
    tarifa: { a: r.number(tarifa.a, `${path}.tarifa.a`), b: r.number(tarifa.b, `${path}.tarifa.b`), f: r.number(tarifa.f, `${path}.tarifa.f`) },
    // Todos los ítems del catálogo, en su orden: 0 = no incluido (S-2).
    items: items.map(({ id }) => ({ item: id, porPersona: quantities.get(id) ?? 0 })),
  };
}

/** Forma y referencias; los valores se comprueban después con las reglas de los campos. */
function readStructure(r: Reader, raw: unknown): QuoteCatalog | null {
  const root = r.object(raw, '$', ['version', 'negocio', 'insumos', 'itemsVenta', 'costosPorPersona', 'combustible', 'costosFijosEvento', 'politica', 'matriz', 'paquetes']);
  if (!root) return null;
  if (root.version !== 1) r.add('$.version', 'Debe ser 1.');
  if (!isBusinessId(root.negocio)) r.add('$.negocio', 'Debe ser un negocio conocido.');

  const insumos = r.array(root.insumos, '$.insumos', 1, LIST_MAX).map((entry, index) => readSupply(r, entry, `$.insumos[${String(index)}]`));
  r.uniqueIds(insumos, '$.insumos');
  const supplyIds = new Set(insumos.map(({ id }) => id));
  const itemsVenta = r.array(root.itemsVenta, '$.itemsVenta', 1, LIST_MAX).map((entry, index) => readItem(r, entry, `$.itemsVenta[${String(index)}]`, supplyIds));
  r.uniqueIds(itemsVenta, '$.itemsVenta');
  const costosPorPersona = r.array(root.costosPorPersona, '$.costosPorPersona', 0, LIST_MAX).map((entry, index) => readCost(r, entry, `$.costosPorPersona[${String(index)}]`));
  r.uniqueIds(costosPorPersona, '$.costosPorPersona');
  const costosFijosEvento = r.array(root.costosFijosEvento, '$.costosFijosEvento', 0, LIST_MAX).map((entry, index) => readCost(r, entry, `$.costosFijosEvento[${String(index)}]`));
  r.uniqueIds(costosFijosEvento, '$.costosFijosEvento');

  const fuel = r.object(root.combustible, '$.combustible', ['costoHora', 'horasTanda', 'insumoBase', 'crudoPorTandaKg']) ?? {};
  const insumoBase = r.id(fuel.insumoBase, '$.combustible.insumoBase');
  const base = insumos.find(({ id }) => id === insumoBase);
  if (insumoBase !== '' && !base) r.add('$.combustible.insumoBase', `Combustible: el insumo base "${insumoBase}" no existe.`);
  if (base && base.unidad !== 'kg') r.add('$.combustible.insumoBase', `Combustible: el insumo base "${insumoBase}" debe ir en kg.`);

  const policy = r.object(root.politica, '$.politica', ['minPersonas', 'refPersonas', 'margenObjetivoPct']) ?? {};
  const matrix = r.object(root.matriz, '$.matriz', ['desde', 'hasta', 'paso', 'extra']) ?? {};
  const extra = r.array(matrix.extra, '$.matriz.extra', 0, Number.MAX_SAFE_INTEGER).map((entry, index) => r.number(entry, `$.matriz.extra[${String(index)}]`));

  const paquetes = r.array(root.paquetes, '$.paquetes', 1, PACKAGES_MAX).map((entry, index) => readPackage(r, entry, `$.paquetes[${String(index)}]`, itemsVenta));
  r.uniqueIds(paquetes, '$.paquetes');

  return {
    version: 1,
    negocio: isBusinessId(root.negocio) ? root.negocio : 'birria',
    insumos,
    itemsVenta,
    costosPorPersona,
    combustible: {
      costoHora: r.number(fuel.costoHora, '$.combustible.costoHora'),
      horasTanda: r.number(fuel.horasTanda, '$.combustible.horasTanda'),
      insumoBase,
      crudoPorTandaKg: r.number(fuel.crudoPorTandaKg, '$.combustible.crudoPorTandaKg'),
    },
    costosFijosEvento,
    politica: {
      minPersonas: r.number(policy.minPersonas, '$.politica.minPersonas'),
      refPersonas: r.number(policy.refPersonas, '$.politica.refPersonas'),
      margenObjetivoPct: r.number(policy.margenObjetivoPct, '$.politica.margenObjetivoPct'),
    },
    matriz: { desde: r.number(matrix.desde, '$.matriz.desde'), hasta: r.number(matrix.hasta, '$.matriz.hasta'), paso: r.number(matrix.paso, '$.matriz.paso'), extra },
    paquetes,
  };
}

/** Valida el JSON del cotizador. Nunca lanza. */
export function parseQuoteCatalog(raw: unknown): QuoteCatalogParse {
  const r = createReader();
  const catalog = readStructure(r, raw);
  if (!catalog || r.issues.length > 0) return { ok: false, issues: r.issues };

  const defs = quoteFieldDefs(catalog);
  if (defs.length > QUOTE_MAX_FIELDS) return { ok: false, issues: [{ path: '$', message: `El catálogo tiene ${String(defs.length)} campos editables; el máximo es ${String(QUOTE_MAX_FIELDS)}.` }] };
  for (const def of defs) {
    const error = checkFieldValue(def, def.get(catalog));
    if (error) r.add(`$.${def.path}`, `${def.context} — ${def.label}: ${error}`);
  }
  if (r.issues.length > 0) return { ok: false, issues: r.issues };

  const byKey = new Map(defs.map((def) => [def.key, def]));
  for (const { key, message, named } of crossCheck(catalog, { activeOnly: false })) {
    const def = byKey.get(key);
    r.add(def ? `$.${def.path}` : '$', named || !def ? message : `${def.context} — ${def.label}: ${message}`);
  }
  if (r.issues.length > 0) return { ok: false, issues: r.issues };

  catalog.matriz.extra = normalizeList(catalog.matriz.extra);
  return { ok: true, catalog: deepFreeze(catalog) };
}
