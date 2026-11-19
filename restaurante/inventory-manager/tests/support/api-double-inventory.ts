import type { Context } from 'koa';

import { IDEMPOTENCY_HEADER, type AdminUser, type InventoryHistoryEntry, type InventoryItem, type InventoryItemKind, type InventoryItemType, type InventoryUnit } from '@restaurante/contracts';

/**
 * Doble de `/api/v1/admin/inventario` (REQ-F-049, T1) para las pruebas de las pantallas. Mismo orden
 * que la API real: sesión y CSRF (en `api-double.ts`) -> rol administrador o gerente (403
 * `FORBIDDEN_ROLE`) -> datos. Reglas mínimas para la interfaz (las reales están en core y se prueban
 * en api/tests): 422 por campo (nombre vacío o repetido entre los activos, factor no válido, filtro
 * desconocido), 409 de versión con `current`, padre con variantes activas, categoría en uso y nombre
 * ocupado al reactivar, alta idempotente y la conversión por empaque o por factor fijo.
 */

interface Category {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDouble {
  items: InventoryItem[];
  categories: Category[];
  history: Map<number, InventoryHistoryEntry[]>;
  /** Cambia un artículo "desde otra sesión" (para el 409). */
  touch(id: number, by: string): void;
}

const AT = '2026-11-19T10:00:00-06:00';
const LATER = '2026-11-19T12:30:00-06:00';
const FIXED: Readonly<Record<string, { magnitude: string; factor: number }>> = Object.freeze({
  kg: { magnitude: 'masa', factor: 1000 },
  g: { magnitude: 'masa', factor: 1 },
  L: { magnitude: 'volumen', factor: 1000 },
  ml: { magnitude: 'volumen', factor: 1 },
  pza: { magnitude: 'pieza', factor: 1 },
});
const PAGE_SIZE = 50;
const FORBIDDEN_MESSAGE = 'No tienes permiso para gestionar el inventario.';

export function createInventoryDouble(): InventoryDouble {
  const double: InventoryDouble = {
    items: [],
    categories: [],
    history: new Map(),
    touch(id, by) {
      const found = double.items.find((item) => item.id === id);
      if (found) Object.assign(found, { version: found.version + 1, updatedAt: LATER, updatedBy: by });
    },
  };
  return double;
}

let sequence = 5000;
const idempotency = new Map<string, number>();

const decimal = (value: number): string => value.toFixed(3);
const isDecimal = (value: unknown): value is string => typeof value === 'string' && /^\d{1,10}(\.\d{1,3})?$/.test(value.trim());

function fail(ctx: Context, status: number, code: string, message: string, more: Record<string, unknown> = {}): void {
  ctx.status = status;
  ctx.body = { error: { code, message, ...more } };
}
const invalid = (ctx: Context, fields: Record<string, string>) => fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields });

export function handleInventory(ctx: Context, double: InventoryDouble, user: AdminUser, path: string, record: Record<string, unknown>): void {
  if (user.role !== 'admin' && user.role !== 'gerente') return fail(ctx, 403, 'FORBIDDEN_ROLE', FORBIDDEN_MESSAGE);
  const author = user.name;
  const categoryOf = (id: number) => double.categories.find((category) => category.id === id);
  const activeCount = (categoryId: number) => double.items.filter((item) => item.active && item.categoryId === categoryId).length;
  const record_ = (id: number, action: InventoryHistoryEntry['action'], changes: InventoryHistoryEntry['changes'] = []) =>
    double.history.set(id, [{ id: ++sequence, at: AT, action, author, changes }, ...(double.history.get(id) ?? [])]);
  const nameTaken = (name: string, except: number | null) => double.items.some((item) => item.active && item.id !== except && item.name.toLowerCase() === name.trim().toLowerCase());

  /** Campos comunes del alta y la edición; null si ya respondió 422. */
  function fieldsOf(kind: InventoryItemKind, except: number | null) {
    const errors: Record<string, string> = {};
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (name === '') errors.name = 'Escribe el nombre.';
    else if (nameTaken(name, except)) errors.name = 'Ya hay un artículo activo con ese nombre.';
    const units: { name: string; factor: string }[] = [];
    let baseUnit: InventoryUnit | null = null;
    if (kind !== 'parent') {
      if (typeof record.baseUnit === 'string' && record.baseUnit in FIXED) baseUnit = record.baseUnit as InventoryUnit;
      else errors.baseUnit = 'Elige la unidad base (kg, g, L, ml, pza).';
      for (const [index, unit] of ((record.units ?? []) as { name?: unknown; factor?: unknown }[]).entries()) {
        if (typeof unit.name !== 'string' || unit.name.trim() === '') errors[`units.${index}.name`] = 'Escribe el nombre del empaque.';
        if (!isDecimal(unit.factor) || Number(unit.factor) <= 0) errors[`units.${index}.factor`] = 'El factor debe ser un número mayor que 0, con punto decimal.';
        else units.push({ name: String(unit.name).trim(), factor: decimal(Number(unit.factor)) });
      }
    }
    if (Object.keys(errors).length > 0) {
      invalid(ctx, errors);
      return null;
    }
    const sku = kind === 'parent' || typeof record.sku !== 'string' || record.sku.trim() === '' ? null : record.sku.trim();
    const description = typeof record.description === 'string' && record.description.trim() !== '' ? record.description.trim() : null;
    return { name, baseUnit, units, sku, description };
  }

  function detail(item: InventoryItem) {
    const category = categoryOf(item.categoryId) as Category;
    const parent = item.parentId === null ? null : double.items.find((candidate) => candidate.id === item.parentId);
    const base = item.baseUnit === null ? null : FIXED[item.baseUnit];
    const equivalences = base
      ? [
          ...Object.entries(FIXED)
            .filter(([, unit]) => unit.magnitude === base.magnitude)
            .map(([unit, info]) => ({ unit, quantity: decimal(info.factor / base.factor) })),
          ...item.units.map((unit) => ({ unit: unit.name, quantity: unit.factor })),
        ]
      : [];
    return {
      ...item,
      category: { id: category.id, name: category.name, active: category.active },
      parent: parent ? { id: parent.id, name: parent.name, active: parent.active } : null,
      variants: double.items.filter((candidate) => candidate.parentId === item.id).map(({ id, name, sku, baseUnit, active }) => ({ id, name, sku, baseUnit, active })),
      locked: false,
      equivalences,
    };
  }

  const categoryMatch = /^\/categorias(?:\/(\d+))?(?:\/(desactivar|reactivar))?$/.exec(path);
  if (categoryMatch) {
    const [, rawId, action] = categoryMatch;
    if (rawId === undefined) {
      if (ctx.method === 'GET') {
        ctx.body = { categories: double.categories.map((category) => ({ ...category, activeItemCount: activeCount(category.id) })) };
        return undefined;
      }
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (name === '') return invalid(ctx, { name: 'Escribe el nombre.' });
      const key = ctx.get(IDEMPOTENCY_HEADER);
      const replay = key ? double.categories.find((category) => category.id === idempotency.get(`c:${key}`)) : undefined;
      const created = replay ?? { id: ++sequence, name, active: true, createdAt: AT, updatedAt: AT };
      if (!replay) {
        double.categories.push(created);
        if (key) idempotency.set(`c:${key}`, created.id);
      }
      ctx.status = 201;
      ctx.body = { category: created };
      return undefined;
    }
    const category = categoryOf(Number(rawId));
    if (!category) return fail(ctx, 404, 'CATEGORY_NOT_FOUND', 'Categoría no encontrada.');
    if (action === 'desactivar') {
      const count = activeCount(category.id);
      if (count > 0) return fail(ctx, 409, 'CATEGORY_IN_USE', `No se puede inactivar: la usan ${count} artículos activos.`);
      category.active = false;
    } else if (action === 'reactivar') {
      category.active = true;
    } else {
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (name === '') return invalid(ctx, { name: 'Escribe el nombre.' });
      category.name = name;
    }
    ctx.body = { category };
    return undefined;
  }

  const itemMatch = /^\/articulos(?:\/(\d+))?(?:\/(desactivar|reactivar|conversion))?$/.exec(path);
  if (!itemMatch) return fail(ctx, 404, 'NOT_FOUND', 'Recurso no encontrado.');
  const [, rawId, action] = itemMatch;

  if (rawId === undefined) {
    if (ctx.method === 'GET') {
      const status = String(ctx.query.estado ?? 'active');
      if (!['active', 'inactive', 'all'].includes(status)) return invalid(ctx, { estado: 'Estado desconocido: usa active, inactive o all.' });
      const q = String(ctx.query.q ?? '').toLowerCase();
      const page = Number(ctx.query.pagina ?? 1);
      const found = double.items
        .filter((item) => (status === 'all' ? true : item.active === (status === 'active')))
        .filter((item) => !ctx.query.tipo || item.type === ctx.query.tipo)
        .filter((item) => !ctx.query.categoria || item.categoryId === Number(ctx.query.categoria))
        .filter((item) => q === '' || item.name.toLowerCase().includes(q) || (item.sku ?? '').toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      ctx.body = {
        items: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item) => ({
          ...item,
          categoryName: categoryOf(item.categoryId)?.name ?? '',
          variantCount: double.items.filter((candidate) => candidate.parentId === item.id).length,
        })),
        page: { number: page, size: PAGE_SIZE, total: found.length },
      };
      return undefined;
    }
    // Alta.
    const key = ctx.get(IDEMPOTENCY_HEADER);
    const replay = key ? double.items.find((item) => item.id === idempotency.get(`i:${key}`)) : undefined;
    if (replay) {
      ctx.status = 201;
      ctx.body = { item: replay };
      return undefined;
    }
    const kind = (typeof record.kind === 'string' ? record.kind : 'simple') as InventoryItemKind;
    let type = record.type as InventoryItemType;
    let categoryId = Number(record.categoryId);
    let parentId: number | null = null;
    if (kind === 'variant') {
      const parent = double.items.find((item) => item.id === Number(record.parentId) && item.kind === 'parent');
      if (!parent) return invalid(ctx, { parentId: 'El artículo padre no existe.' });
      if (!parent.active) return fail(ctx, 409, 'PARENT_INACTIVE', 'El artículo padre está inactivo.');
      ({ type, categoryId } = parent);
      parentId = parent.id;
    } else {
      const errors: Record<string, string> = {};
      if (!['insumo', 'intermedio', 'compuesto', 'reventa'].includes(String(type))) errors.type = 'Elige el tipo de artículo.';
      if (!categoryOf(categoryId)) errors.categoryId = 'Elige la categoría.';
      if (Object.keys(errors).length > 0) return invalid(ctx, errors);
    }
    const fields = fieldsOf(kind, null);
    if (!fields) return undefined;
    const item: InventoryItem = { id: ++sequence, kind, type, parentId, categoryId, ...fields, active: true, version: 1, createdAt: AT, updatedAt: AT, updatedBy: author };
    double.items.push(item);
    if (key) idempotency.set(`i:${key}`, item.id);
    record_(item.id, 'create', [{ field: 'name', before: null, after: item.name }]);
    ctx.status = 201;
    ctx.body = { item };
    return undefined;
  }

  const item = double.items.find((candidate) => candidate.id === Number(rawId));
  if (!item) return fail(ctx, 404, 'ITEM_NOT_FOUND', 'Artículo no encontrado.');
  const version = Number(record.version);
  const conflict = () => fail(ctx, 409, 'VERSION_CONFLICT', 'El artículo cambió mientras lo editabas: no se guardó nada.', { current: { id: item.id, version: item.version, updatedAt: item.updatedAt, updatedBy: item.updatedBy } });
  const bump = (changes: Partial<InventoryItem>) => Object.assign(item, changes, { version: item.version + 1, updatedAt: AT, updatedBy: author });

  if (ctx.method === 'GET' && action === undefined) {
    ctx.body = { item: detail(item), history: double.history.get(item.id) ?? [] };
    return undefined;
  }
  if (action === 'conversion') {
    const quantity = String(ctx.query.cantidad ?? '');
    if (!isDecimal(quantity)) return invalid(ctx, { cantidad: 'Escribe una cantidad con punto decimal y hasta 3 decimales.' });
    const unit = String(ctx.query.unidad ?? '');
    const base = item.baseUnit === null ? undefined : FIXED[item.baseUnit];
    const packaging = item.units.find((candidate) => candidate.name === unit);
    const fixed = FIXED[unit];
    const factor = packaging ? Number(packaging.factor) : fixed && base && fixed.magnitude === base.magnitude ? fixed.factor / base.factor : null;
    if (factor === null) return fail(ctx, 422, 'UNIT_CONVERSION_UNAVAILABLE', `No hay factor para convertir ${unit} a ${item.baseUnit ?? '?'} en este artículo.`);
    ctx.body = { quantity: decimal(Number(quantity) * factor), unit: item.baseUnit };
    return undefined;
  }
  if (action === 'desactivar') {
    if (version !== item.version) return conflict();
    const active = double.items.filter((candidate) => candidate.parentId === item.id && candidate.active);
    if (active.length > 0 && record.variants !== 'deactivate') return fail(ctx, 409, 'ITEM_HAS_ACTIVE_VARIANTS', `Tiene ${active.length} variantes activas: confirma que también se inactivan.`);
    for (const variant of active) {
      Object.assign(variant, { active: false, version: variant.version + 1 });
      record_(variant.id, 'deactivate', [{ field: 'active', before: true, after: false }]);
    }
    bump({ active: false });
    record_(item.id, 'deactivate', [{ field: 'active', before: true, after: false }]);
    ctx.body = { item };
    return undefined;
  }
  if (action === 'reactivar') {
    if (version !== item.version) return conflict();
    if (nameTaken(item.name, item.id)) return fail(ctx, 409, 'ITEM_NAME_TAKEN', 'Ya hay un artículo activo con ese nombre.');
    bump({ active: true });
    record_(item.id, 'reactivate', [{ field: 'active', before: false, after: true }]);
    ctx.body = { item };
    return undefined;
  }
  // Edición.
  if (version !== item.version && record.overwrite !== true) return conflict();
  const fields = fieldsOf(item.kind, item.id);
  if (!fields) return undefined;
  const before = item.name;
  bump({ ...fields, ...(item.kind === 'variant' ? {} : { categoryId: Number(record.categoryId) }) });
  record_(item.id, record.overwrite === true ? 'overwrite_after_conflict' : 'update', before === item.name ? [] : [{ field: 'name', before, after: item.name }]);
  ctx.body = { item };
  return undefined;
}
