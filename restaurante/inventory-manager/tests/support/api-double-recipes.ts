import type { Context } from 'koa';

import { IDEMPOTENCY_HEADER, type AdminUser, type InventoryCostSource, type InventoryItem } from '@restaurante/contracts';

import type { InventoryDouble } from './api-double-inventory.ts';

/**
 * Doble de las recetas de `/api/v1/admin/inventario` (REQ-F-050, T2) para las pantallas del admin. Reglas
 * mínimas para la interfaz (las reales y el costo exacto están en core y se prueban en api/tests): quién
 * lleva receta (409 `RECIPE_NOT_ALLOWED`), artículo inactivo (409 `RECIPE_ITEM_INACTIVE`), 422 por línea y
 * campo, ciclo directo (422 `RECIPE_CYCLE` con la ruta), conflicto de la versión de partida (409 con la
 * vigente), guardar sin cambios (200 sin versión), clave de idempotencia y el costo por referencia o receta
 * (con `number`: aquí basta con 2 decimales). Datos ficticios.
 */

interface Line {
  position: number;
  ingredientId: number;
  quantity: number;
  unit: string;
  wastePercent: number;
  note: string | null;
}

interface Version {
  id: number;
  itemId: number;
  number: number;
  yieldQuantity: number;
  validFrom: string;
  validTo: string | null;
  createdBy: string;
  note: string | null;
  lines: Line[];
}

export interface RecipeState {
  versions: Version[];
  /** Guarda una versión "desde otra sesión" (para el 409). */
  saveFrom(itemId: number, by: string, yieldQuantity: number, lines: Omit<Line, 'position'>[]): Version;
}

const AT = '2026-11-19T10:00:00-06:00';
const LATER = '2026-11-19T12:30:00-06:00';
const MASS: Readonly<Record<string, number>> = Object.freeze({ kg: 1000, g: 1, L: 1000, ml: 1, pza: 1, hr: 1 });
const RECIPE_TYPES = ['intermedio', 'compuesto'];
const INGREDIENT_TYPES = ['insumo', 'intermedio', 'reventa'];

let sequence = 9000;
const idempotency = new Map<string, number>();

export function createRecipeState(): RecipeState {
  const state: RecipeState = {
    versions: [],
    saveFrom(itemId, by, yieldQuantity, lines) {
      const current = state.versions.find((version) => version.itemId === itemId && version.validTo === null);
      if (current) current.validTo = LATER;
      const version: Version = { id: ++sequence, itemId, number: state.versions.filter((entry) => entry.itemId === itemId).length + 1, yieldQuantity, validFrom: LATER, validTo: null, createdBy: by, note: null, lines: lines.map((line, index) => ({ ...line, position: index + 1 })) };
      state.versions.push(version);
      return version;
    },
  };
  return state;
}

const q3 = (value: number) => value.toFixed(3);
const c4 = (value: number) => value.toFixed(4);
const isNumber = (value: unknown): value is string => typeof value === 'string' && /^\d{1,10}(\.\d{1,3})?$/.test(value.trim());

function fail(ctx: Context, status: number, code: string, message: string, more: Record<string, unknown> = {}): void {
  ctx.status = status;
  ctx.body = { error: { code, message, ...more } };
}

const currentOf = (double: InventoryDouble, itemId: number) => double.recipes.versions.find((version) => version.itemId === itemId && version.validTo === null);

/** Recetas vigentes que usan alguno de los artículos (para la baja y «usado en»). */
export function recipesUsing(double: InventoryDouble, ids: readonly number[]): { itemId: number; name: string }[] {
  return double.recipes.versions
    .filter((version) => version.validTo === null && version.lines.some((line) => ids.includes(line.ingredientId)))
    .map((version) => ({ itemId: version.itemId, name: double.items.find((item) => item.id === version.itemId)?.name ?? '?' }));
}

export function handleRecipes(ctx: Context, double: InventoryDouble, user: AdminUser, path: string, record: Record<string, unknown>): void {
  const itemOf = (id: number) => double.items.find((item) => item.id === id);
  const ref = (item: InventoryItem) => ({ id: item.id, name: item.name, kind: item.kind, type: item.type, baseUnit: item.baseUnit, active: item.active });
  const summary = (version: Version) => ({ id: version.id, itemId: version.itemId, number: version.number, yieldQuantity: q3(version.yieldQuantity), validFrom: version.validFrom, validTo: version.validTo, createdBy: version.createdBy, lineCount: version.lines.length });
  const factorOf = (ingredient: InventoryItem, unit: string) => {
    const packaging = ingredient.units.find((candidate) => candidate.name === unit);
    if (packaging) return Number(packaging.factor);
    const from = MASS[unit];
    const base = ingredient.baseUnit ? MASS[ingredient.baseUnit] : undefined;
    return from !== undefined && base !== undefined ? from / base : null;
  };
  const lineDto = (line: Line) => {
    const ingredient = itemOf(line.ingredientId) as InventoryItem;
    const net = line.quantity * (factorOf(ingredient, line.unit) ?? 1);
    const gross = net / (1 - line.wastePercent / 100);
    return { position: line.position, ingredient: ref(ingredient), quantity: q3(line.quantity), unit: line.unit, netBaseQuantity: q3(net), wastePercent: line.wastePercent.toFixed(2), grossBaseQuantity: q3(gross), note: line.note, gross };
  };

  /** Costo por unidad base de un artículo: receta vigente (Intermedio) -> referencia -> sin costo. */
  function unitCost(item: InventoryItem, depth = 0): { cost: number | null; source: InventoryCostSource; missing: { itemId: number; name: string; path: string[] }[] } {
    const version = currentOf(double, item.id);
    if (version && depth < 8) {
      const costed = costOf(version, depth + 1);
      return { cost: costed.unitCost, source: 'receta', missing: costed.missing.map((entry) => ({ ...entry, path: [item.name, ...entry.path] })) };
    }
    if (item.referenceCost !== null) return { cost: Number(item.referenceCost), source: 'referencia', missing: [] };
    return { cost: null, source: 'sin_costo', missing: [{ itemId: item.id, name: item.name, path: [item.name] }] };
  }

  function costOf(version: Version, depth = 0) {
    const missing: { itemId: number; name: string; path: string[] }[] = [];
    const lines = version.lines.map((line) => {
      const dto = lineDto(line);
      const ingredient = itemOf(line.ingredientId) as InventoryItem;
      const unit = unitCost(ingredient, depth);
      missing.push(...unit.missing);
      const { gross, ...rest } = dto;
      return { ...rest, unitCost: unit.cost === null ? null : c4(unit.cost), cost: unit.cost === null ? null : c4(gross * unit.cost), source: unit.source };
    });
    const complete = lines.every((line) => line.cost !== null);
    const total = complete ? lines.reduce((sum, line) => sum + Number(line.cost), 0) : null;
    return { lines, total, unitCost: total === null ? null : total / version.yieldQuantity, missing };
  }

  const detail = (item: InventoryItem) => {
    const version = currentOf(double, item.id);
    let current = null;
    if (version) {
      const costed = costOf(version);
      current = {
        version: { ...summary(version), note: version.note, lines: costed.lines },
        total: costed.total === null ? null : c4(costed.total),
        unitCost: costed.unitCost === null ? null : c4(costed.unitCost),
        missing: costed.missing,
        inactiveIngredientIds: version.lines.filter((line) => !itemOf(line.ingredientId)?.active).map((line) => line.ingredientId),
      };
    }
    const versions = double.recipes.versions.filter((entry) => entry.itemId === item.id).sort((a, b) => b.number - a.number);
    return { item: ref(item), current, versions: versions.map(summary) };
  };

  if (path === '/recetas' && ctx.method === 'GET') {
    const type = String(ctx.query.tipo ?? '');
    if (type !== '' && !RECIPE_TYPES.includes(type)) return fail(ctx, 422, 'VALIDATION_FAILED', 'Los filtros no son válidos.', { fields: { tipo: 'Tipo desconocido: usa intermedio o compuesto.' } });
    const text = String(ctx.query.q ?? '').toLowerCase();
    const recipes = double.recipes.versions
      .filter((version) => version.validTo === null)
      .map((version) => ({ version, item: itemOf(version.itemId) as InventoryItem }))
      .filter(({ item }) => (type === '' || item.type === type) && (text === '' || item.name.toLowerCase().includes(text)))
      .map(({ version, item }) => {
        const costed = costOf(version);
        return {
          item: ref(item),
          versionId: version.id,
          versionNumber: version.number,
          yieldQuantity: q3(version.yieldQuantity),
          unitCost: costed.unitCost === null ? null : c4(costed.unitCost),
          missingCount: costed.missing.length,
          validFrom: version.validFrom,
          usesInactive: version.lines.some((line) => !itemOf(line.ingredientId)?.active),
        };
      });
    ctx.body = { recipes, page: { number: 1, size: 50, total: recipes.length } };
    return undefined;
  }
  if (path === '/recetas/ingredientes' && ctx.method === 'GET') {
    ctx.body = { ingredients: double.items.filter((item) => item.active && item.kind !== 'parent' && INGREDIENT_TYPES.includes(item.type)).map((item) => ({ ...ref(item), units: item.units })) };
    return undefined;
  }
  const versionMatch = /^\/recetas\/versiones\/(\d+)$/.exec(path);
  if (versionMatch) {
    const version = double.recipes.versions.find((entry) => entry.id === Number(versionMatch[1]));
    if (!version) return fail(ctx, 404, 'RECIPE_VERSION_NOT_FOUND', 'Versión de receta no encontrada.');
    ctx.body = { item: ref(itemOf(version.itemId) as InventoryItem), version: { ...summary(version), note: version.note, lines: version.lines.map((line) => ({ ...lineDto(line), gross: undefined })) } };
    return undefined;
  }
  const match = /^\/articulos\/(\d+)\/(recetas|usado-en)(\/cerrar)?$/.exec(path);
  if (!match) return fail(ctx, 404, 'NOT_FOUND', 'Recurso no encontrado.');
  const item = itemOf(Number(match[1]));
  if (!item) return fail(ctx, 404, 'ITEM_NOT_FOUND', 'Artículo no encontrado.');
  if (match[2] === 'usado-en') {
    ctx.body = {
      recipes: recipesUsing(double, [item.id]).map((entry) => {
        const version = currentOf(double, entry.itemId) as Version;
        return { itemId: entry.itemId, name: entry.name, active: itemOf(entry.itemId)?.active ?? false, versionId: version.id, versionNumber: version.number };
      }),
    };
    return undefined;
  }
  if (item.kind === 'parent' || !RECIPE_TYPES.includes(item.type)) return fail(ctx, 409, 'RECIPE_NOT_ALLOWED', 'Este artículo no lleva receta.');
  if (ctx.method === 'GET') {
    ctx.body = detail(item);
    return undefined;
  }
  const current = currentOf(double, item.id);
  const conflict = () =>
    fail(ctx, 409, 'RECIPE_VERSION_CONFLICT', 'La receta cambió mientras la editabas: no se guardó nada. Revisa la versión vigente.', {
      current: current ? { id: current.id, number: current.number, validFrom: current.validFrom, createdBy: current.createdBy } : null,
    });
  const base = record.baseVersionId ?? null;
  if (match[3] === '/cerrar') {
    if (!current) {
      ctx.body = { version: null };
      return undefined;
    }
    if (base !== current.id) return conflict();
    current.validTo = AT;
    ctx.body = { version: summary(current) };
    return undefined;
  }
  // Guardar una versión.
  const key = ctx.get(IDEMPOTENCY_HEADER);
  const replay = key ? double.recipes.versions.find((version) => version.id === idempotency.get(key)) : undefined;
  if (replay) {
    ctx.body = { created: true, version: summary(replay) };
    return undefined;
  }
  if (!item.active) return fail(ctx, 409, 'RECIPE_ITEM_INACTIVE', 'El artículo está inactivo: no admite versiones nuevas.');
  const errors: Record<string, string> = {};
  if (!isNumber(record.yieldQuantity) || Number(record.yieldQuantity) <= 0) errors.yieldQuantity = 'El rendimiento debe ser mayor que 0.';
  const raw = Array.isArray(record.lines) ? (record.lines as Record<string, unknown>[]) : [];
  if (raw.length < 1 || raw.length > 40) errors.lines = raw.length < 1 ? 'Agrega al menos un ingrediente.' : 'Máximo 40 ingredientes.';
  const lines: Omit<Line, 'position'>[] = [];
  const seen = new Set<number>();
  raw.forEach((line, index) => {
    const path_ = `lines.${index}`;
    const ingredient = typeof line.ingredientId === 'number' ? itemOf(line.ingredientId) : undefined;
    if (!ingredient) errors[`${path_}.ingredient`] = 'Elige el ingrediente.';
    else if (!ingredient.active) errors[`${path_}.ingredient`] = 'El ingrediente está inactivo: elige otro.';
    else if (ingredient.kind === 'parent' || !INGREDIENT_TYPES.includes(ingredient.type)) errors[`${path_}.ingredient`] = 'Un Compuesto no puede ser ingrediente de otra receta.';
    else if (seen.has(ingredient.id)) errors[`${path_}.ingredient`] = 'Ingrediente repetido: júntalo en una sola línea.';
    if (ingredient) seen.add(ingredient.id);
    if (!isNumber(line.quantity) || Number(line.quantity) <= 0) errors[`${path_}.quantity`] = 'La cantidad neta debe ser mayor que 0, con punto decimal.';
    if (typeof line.unit !== 'string' || line.unit === '') errors[`${path_}.unit`] = 'Elige la unidad.';
    else if (ingredient && factorOf(ingredient, line.unit) === null) errors[`${path_}.unit`] = `No hay factor para convertir ${line.unit} a ${ingredient.baseUnit ?? '?'}.`;
    const waste = line.wastePercent === undefined ? 0 : Number(line.wastePercent);
    if (!(waste >= 0 && waste < 100)) errors[`${path_}.wastePercent`] = 'La merma debe ser menor que 100 %.';
    if (ingredient) lines.push({ ingredientId: ingredient.id, quantity: Number(line.quantity), unit: String(line.unit), wastePercent: waste, note: typeof line.note === 'string' ? line.note : null });
  });
  if (Object.keys(errors).length > 0) return fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields: errors });
  for (const line of lines) {
    if (currentOf(double, line.ingredientId)?.lines.some((sub) => sub.ingredientId === item.id) || line.ingredientId === item.id) {
      const ingredient = itemOf(line.ingredientId) as InventoryItem;
      const cycle = line.ingredientId === item.id ? [item.name, item.name] : [item.name, ingredient.name, item.name];
      return fail(ctx, 422, 'RECIPE_CYCLE', `La receta se contendría a sí misma: ${cycle.join(' → ')}.`, { path: cycle });
    }
  }
  const yieldQuantity = Number(record.yieldQuantity);
  const note = typeof record.note === 'string' && record.note !== '' ? record.note : null;
  const same =
    current &&
    current.yieldQuantity === yieldQuantity &&
    current.note === note &&
    current.lines.length === lines.length &&
    current.lines.every((line, index) => {
      const other = lines[index];
      return other !== undefined && line.ingredientId === other.ingredientId && line.quantity === other.quantity && line.unit === other.unit && line.wastePercent === other.wastePercent && line.note === other.note;
    });
  if (same) {
    ctx.body = { created: false, version: summary(current) };
    return undefined;
  }
  if ((current?.id ?? null) !== base) return conflict();
  if (current) current.validTo = AT;
  const version: Version = { id: ++sequence, itemId: item.id, number: double.recipes.versions.filter((entry) => entry.itemId === item.id).length + 1, yieldQuantity, validFrom: AT, validTo: null, createdBy: user.name, note, lines: lines.map((line, index) => ({ ...line, position: index + 1 })) };
  double.recipes.versions.push(version);
  if (key) idempotency.set(key, version.id);
  ctx.status = 201;
  ctx.body = { created: true, version: summary(version) };
  return undefined;
}
