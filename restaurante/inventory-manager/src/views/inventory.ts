import {
  INVENTORY_ITEM_STATUSES,
  INVENTORY_ITEM_TYPES,
  INVENTORY_UNITS,
  type InventoryCategoryWithUsage,
  type InventoryHistoryEntry,
  type InventoryItem,
  type InventoryItemDetail,
  type InventoryItemKind,
  type InventoryItemListResponse,
  type InventoryItemType,
  type RecipeUsedInResponse,
} from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { HeaderSection, NoticeOptions, PageContext, PageOptions } from './index.ts';
import { RECIPE_TYPES, recipePath } from './inventory-recipes.ts';

/**
 * Inventario del admin nuevo (REQ-F-049, T1: RF-1 a RF-7 y RF-11), con el sistema visual del admin
 * (PV-8): lista con filtros, ficha (datos, empaques, equivalencias, conversión, variantes e historial),
 * formularios de artículo y categorías. Todo funciona sin JavaScript (formularios GET y
 * POST/redirect/GET); los errores van junto a su campo y en un resumen con enlaces, con texto e
 * icono, no solo color. Solo para administradores y gerentes (la API es la autoridad).
 */

export const INVENTORY_PATH = '/inventario';
export const ITEMS_PATH = `${INVENTORY_PATH}/articulos`;
export const NEW_ITEM_PATH = `${ITEMS_PATH}/nuevo`;
export const itemPath = (id: number): string => `${ITEMS_PATH}/${id}`;
export const itemEditPath = (id: number): string => `${itemPath(id)}/editar`;
export const itemDeactivatePath = (id: number): string => `${itemPath(id)}/desactivar`;
export const itemReactivatePath = (id: number): string => `${itemPath(id)}/reactivar`;
export const CATEGORIES_PATH = `${INVENTORY_PATH}/categorias`;
export const categoryPath = (id: number): string => `${CATEGORIES_PATH}/${id}`;
export const categoryEditPath = (id: number): string => `${categoryPath(id)}/editar`;
export const categoryStatusPath = (id: number, active: boolean): string => `${categoryPath(id)}/${active ? 'desactivar' : 'reactivar'}`;

/** Filas de empaque del formulario (máximo de core: 8 por artículo). */
export const UNIT_SLOTS = 8;
export const unitField = (slot: number, part: 'name' | 'factor'): string => `units.${slot}.${part}`;

export const TYPE_LABELS: Readonly<Record<InventoryItemType, string>> = Object.freeze({ insumo: 'Insumo', intermedio: 'Intermedio', compuesto: 'Compuesto', reventa: 'Reventa' });
/** Un padre solo puede ser de Reventa o Compuesto (RF-5). */
const PARENT_TYPES: readonly InventoryItemType[] = ['compuesto', 'reventa'];
const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({ active: 'Activos', inactive: 'Inactivos', all: 'Todos' });
const ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  create: 'Alta',
  update: 'Edición',
  overwrite_after_conflict: 'Edición guardada sobre otra versión',
  deactivate: 'Inactivado',
  reactivate: 'Reactivado',
  inherit: 'Categoría heredada del padre',
});
const CHANGE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  kind: 'Clase',
  type: 'Tipo',
  parentId: 'Artículo padre',
  categoryId: 'Categoría',
  name: 'Nombre',
  description: 'Descripción',
  sku: 'SKU',
  baseUnit: 'Unidad base',
  units: 'Empaques',
  active: 'Estado',
  referenceCost: 'Costo de referencia',
  inventoriable: 'Inventariable',
});
const KIND_LABELS: Readonly<Record<InventoryItemKind, string>> = Object.freeze({ simple: 'Artículo', parent: 'Con variantes', variant: 'Variante' });

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  name: 'Nombre',
  description: 'Descripción',
  type: 'Tipo',
  categoryId: 'Categoría',
  sku: 'SKU o código de barras',
  baseUnit: 'Unidad base',
  units: 'Unidades de empaque',
  referenceCost: 'Costo de referencia',
  inventoriable: 'Inventariable',
});

/** Tipos que admiten costo de referencia (REQ-F-050, PT-7): no un Compuesto ni un padre. */
const REFERENCE_COST_TYPES: readonly string[] = Object.freeze(['insumo', 'intermedio', 'reventa']);

/**
 * Qué campos de costo muestra el formulario (REQ-F-050, RF-10 y PT-7): el costo de referencia en Insumo,
 * Intermedio y Reventa, y la casilla inventariable solo en un Insumo. En un alta simple el tipo aún no
 * está elegido: se muestran los dos con su ayuda y la API rechaza lo que no corresponde.
 */
export function costFields(mode: 'create' | 'edit', kind: InventoryItemKind, type: string): { referenceCost: boolean; inventoriable: boolean } {
  if (kind === 'parent') return { referenceCost: false, inventoriable: false };
  if (mode === 'create' && kind === 'simple') return { referenceCost: true, inventoriable: true };
  return { referenceCost: REFERENCE_COST_TYPES.includes(type), inventoriable: type === 'insumo' };
}

/** «18.4000» -> «$18.4000» (costo de referencia, 4 decimales, MXN con IVA). */
const referenceCostText = (value: string, baseUnit: string | null): string => `$${value}${baseUnit ? ` por ${baseUnit}` : ''} (con IVA)`;

/** «24.000» -> «24»; «0.500» -> «0.5» (las respuestas llevan siempre 3 decimales). */
export const trimDecimal = (value: string): string => (value.includes('.') ? value.replace(/\.?0+$/, '') : value);

export interface ItemFormValues {
  name: string;
  description: string;
  type: string;
  categoryId: string;
  sku: string;
  baseUnit: string;
  /** REQ-F-050: costo de referencia tal como se escribió ('' = sin costo) y la casilla inventariable. */
  referenceCost: string;
  inventoriable: boolean;
  /** Filas de empaque en su posición del formulario (las vacías, como ''). */
  units: { name: string; factor: string }[];
}

export function readItemForm(fields: Map<string, string>): ItemFormValues {
  const units = Array.from({ length: UNIT_SLOTS }, (_, slot) => ({ name: fields.get(unitField(slot, 'name')) ?? '', factor: fields.get(unitField(slot, 'factor')) ?? '' }));
  return {
    name: fields.get('name') ?? '',
    description: fields.get('description') ?? '',
    type: fields.get('type') ?? '',
    categoryId: fields.get('categoryId') ?? '',
    sku: fields.get('sku') ?? '',
    baseUnit: fields.get('baseUnit') ?? '',
    referenceCost: fields.get('referenceCost') ?? '',
    inventoriable: fields.get('inventoriable') === 'on',
    units,
  };
}

export const itemFormValues = (item: InventoryItem): ItemFormValues => ({
  name: item.name,
  description: item.description ?? '',
  type: item.type,
  categoryId: String(item.categoryId),
  sku: item.sku ?? '',
  baseUnit: item.baseUnit ?? '',
  referenceCost: item.referenceCost ?? '',
  inventoriable: item.inventoriable,
  units: item.units.map((unit) => ({ name: unit.name, factor: trimDecimal(unit.factor) })),
});

export const EMPTY_ITEM_FORM: ItemFormValues = Object.freeze({ name: '', description: '', type: '', categoryId: '', sku: '', baseUnit: '', referenceCost: '', inventoriable: true, units: [] });

/** Padre de una variante (tipo y categoría heredados, de solo lectura). */
export interface ParentInfo {
  id: number;
  name: string;
  type: InventoryItemType;
  categoryName: string;
}

export interface CategoryOption {
  id: number;
  name: string;
  active: boolean;
}

export interface ItemFormView {
  /** null cuando la API no responde y no se pudo comprobar la sesión: la página va sin cabecera. */
  context: PageContext | null;
  csrfToken: string;
  mode: 'create' | 'edit';
  kind: InventoryItemKind;
  /** Artículo editado (para el título y los enlaces). */
  id?: number | undefined;
  parent?: ParentInfo | null | undefined;
  categories: readonly CategoryOption[];
  values: ItemFormValues;
  hidden: Record<string, string>;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
  /** Tras un 409: "Guardar mis cambios sobre la versión vigente". */
  conflict?: boolean;
  /** RN-4: la unidad base y los empaques ya no se pueden cambiar. */
  locked?: boolean;
}

export interface ItemListView {
  context: PageContext;
  filter: { estado: string; tipo: string; categoria: string; q: string };
  categories: readonly CategoryOption[];
  /** null: los filtros no son válidos (422) y no hay resultados que mostrar. */
  list: InventoryItemListResponse | null;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
}

export interface ConversionView {
  quantity: string;
  unit: string;
  result?: string | undefined;
  error?: string | undefined;
}

interface InventoryViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  errorSummary: (errors: Record<string, string>, fields: readonly { name: string; label: string }[]) => SafeHtml | null;
  fieldId: (name: string) => string;
  displayDate: (iso: string | null) => string;
}

export function createInventoryViews({ render, join, attrs, page, notice, errorSummary, fieldId, displayDate }: InventoryViewHelpers) {
  const none = () => join([]);
  const selected = (on: boolean) => (on ? render('partials/selected') : none());
  const option = (value: string, label: string, current: string) => render('partials/option', { value, label, selected: selected(value === current) });

  function describe(name: string, help: string | null, error: string | undefined) {
    const id = fieldId(name);
    const describedBy = [help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
    return {
      id,
      name,
      help: help ? render('partials/field-help', { id: `${id}-help`, text: help }) : none(),
      error: error ? render('partials/field-error', { id: `${id}-error`, message: error }) : none(),
      aria: [
        ['aria-invalid', error ? 'true' : undefined],
        ['aria-describedby', describedBy || undefined],
      ] as [string, string | undefined][],
    };
  }

  function input(name: string, label: string, value: string, error: string | undefined, { help = null, optional = false, extra = [], span = '' }: { help?: string | null; optional?: boolean; extra?: [string, string | number | boolean | undefined][]; span?: string } = {}): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-input', { ...field, label, optional: optional ? ' (opcional)' : '', span, value, attrs: attrs([...extra, ...field.aria]) });
  }

  function select(name: string, label: string, options: SafeHtml[], error: string | undefined, help: string | null = null): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-select', { ...field, label, span: '', attrs: attrs(field.aria), options: join(options) });
  }

  const typeOptions = (types: readonly InventoryItemType[], current: string, placeholder: string | null) => [
    ...(placeholder === null ? [] : [option('', placeholder, current)]),
    ...types.map((type) => option(type, TYPE_LABELS[type], current)),
  ];
  const categoryOptions = (categories: readonly CategoryOption[], current: string, placeholder: string) => [
    option('', placeholder, current),
    ...categories.map((category) => option(String(category.id), category.active ? category.name : `${category.name} (inactiva)`, current)),
  ];

  /** Campos con error que tienen ancla en el formulario (el resto va como texto en el resumen). */
  function summaryFields(errors: Record<string, string>): { name: string; label: string }[] {
    return Object.keys(errors).flatMap((name) => {
      const label = FIELD_LABELS[name];
      if (label && name !== 'units') return [{ name, label }];
      const unit = /^units\.(\d)\.(name|factor)$/.exec(name);
      return unit ? [{ name, label: `Empaque ${Number(unit[1]) + 1}, ${unit[2] === 'name' ? 'nombre' : 'factor'}` }] : [];
    });
  }

  function unitsSection(values: ItemFormValues, errors: Record<string, string>, locked: boolean): SafeHtml {
    // Filas visibles: las escritas más dos vacías (sin JS no se pueden añadir filas), hasta 8.
    const last = values.units.reduce((acc, unit, slot) => (unit.name.trim() !== '' || unit.factor.trim() !== '' ? slot : acc), -1);
    const count = Math.min(UNIT_SLOTS, Math.max(2, last + 3));
    const rows = Array.from({ length: count }, (_, slot) => {
      const unit = values.units[slot] ?? { name: '', factor: '' };
      const rowError = errors[`units.${slot}`];
      return render('partials/row-fieldset', {
        legend: `Empaque ${slot + 1}`,
        fields: join([
          input(unitField(slot, 'name'), 'Nombre', unit.name, errors[unitField(slot, 'name')] ?? rowError, { extra: [['maxlength', 30], ['autocomplete', 'off']] }),
          input(unitField(slot, 'factor'), 'Equivale a (en la unidad base)', unit.factor, errors[unitField(slot, 'factor')], { extra: [['inputmode', 'decimal'], ['autocomplete', 'off']] }),
        ]),
      });
    });
    const intro = [
      'Opcional. Cada empaque equivale a una cantidad de la unidad base: por ejemplo, caja = 24 (pza) o bulto = 25 (kg). Usa punto decimal y hasta 3 decimales. Para quitar un empaque, deja vacía su fila.',
      ...(locked ? ['Este artículo ya se usa: su unidad base y sus empaques no se pueden cambiar.'] : []),
    ];
    const generalError = errors.units ? render('partials/field-error', { id: 'f-units-error', message: errors.units }) : none();
    return render('partials/user-fieldset', {
      legend: 'Unidades de empaque',
      attrs: attrs([['id', 'f-units'], ['tabindex', '-1']]),
      intro: join([...intro.map((text) => render('partials/section-intro', { text })), generalError]),
      fields: join(rows),
    });
  }

  function itemTitle(mode: 'create' | 'edit', kind: InventoryItemKind, parent: ParentInfo | null | undefined, name: string): string {
    if (mode === 'edit') return `Editar ${name.trim() || 'artículo'}`;
    if (kind === 'variant') return parent ? `Nueva variante de ${parent.name}` : 'Nueva variante';
    return kind === 'parent' ? 'Nuevo artículo con variantes' : 'Nuevo artículo';
  }

  function backOf(id: number | undefined, parent: ParentInfo | null | undefined) {
    if (id !== undefined) return { backHref: itemPath(id), backLabel: 'Volver a la ficha' };
    if (parent) return { backHref: itemPath(parent.id), backLabel: `Volver a ${parent.name}` };
    return { backHref: ITEMS_PATH, backLabel: 'Volver a artículos' };
  }

  function statusText(active: boolean) {
    return active ? { state: 'Activo', stateModifier: 'active', stateClass: 'text-maiz' } : { state: 'Inactivo', stateModifier: 'inactive', stateClass: 'text-error' };
  }

  const dataRow = (term: string, value: string) => render('partials/inventory-data-row', { term, value });

  function historyValue(field: string, value: unknown, categories: ReadonlyMap<number, string>): string {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'active') return value === true ? 'Activo' : 'Inactivo';
    if (field === 'inventoriable') return value === true ? 'Sí' : 'No';
    if (field === 'referenceCost' && typeof value === 'string') return `$${value}`;
    if (field === 'type' && typeof value === 'string' && value in TYPE_LABELS) return TYPE_LABELS[value as InventoryItemType];
    if (field === 'kind' && typeof value === 'string' && value in KIND_LABELS) return KIND_LABELS[value as InventoryItemKind];
    if (field === 'categoryId' && typeof value === 'number') return categories.get(value) ?? `Categoría ${value}`;
    if (field === 'units' && Array.isArray(value)) {
      const units = (value as unknown[]).map((unit) =>
        unit !== null && typeof unit === 'object' && 'name' in unit && 'factor' in unit ? `${String(unit.name)} = ${trimDecimal(String(unit.factor))}` : '?',
      );
      return units.length > 0 ? units.join(', ') : 'Ninguno';
    }
    return typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
  }

  function historyEntry(entry: InventoryHistoryEntry, categories: ReadonlyMap<number, string>): SafeHtml {
    const changes = entry.action === 'create' ? [] : entry.changes;
    return render('partials/inventory-history-entry', {
      date: displayDate(entry.at),
      action: ACTION_LABELS[entry.action] ?? entry.action,
      author: entry.author,
      changes: changes.length > 0
        ? render('partials/inventory-change-list', {
            items: join(changes.map((change) => render('partials/inventory-change', { field: CHANGE_LABELS[change.field] ?? change.field, before: historyValue(change.field, change.before, categories), after: historyValue(change.field, change.after, categories) }))),
          })
        : none(),
    });
  }

  function postButton(action: string, csrfToken: string, version: number, label: string, name: string, tone: 'danger' | 'secondary', hidden: Record<string, string> = {}): SafeHtml {
    const look =
      tone === 'danger'
        ? { buttonModifier: 'button--danger', buttonClass: 'border-error text-error hover:bg-error/10', busyText: 'Guardando…' }
        : { buttonModifier: 'button--secondary', buttonClass: 'border-adobo text-crema hover:bg-adobo/15', busyText: 'Guardando…' };
    return render('partials/inventory-post-button', {
      action,
      csrfToken,
      version,
      label,
      name,
      ...look,
      hidden: join(Object.entries(hidden).map(([key, value]) => render('partials/hidden', { name: key, value }))),
    });
  }

  function inventoryPage(title: string, context: PageContext | null, section: HeaderSection, body: SafeHtml): SafeHtml {
    return page({ title, ...(context ? { context } : {}), section, body });
  }

  return {
    inventoryItems({ context, filter, categories, list, errors = {}, notices = [] }: ItemListView): SafeHtml {
      const fieldsNotice = Object.keys(errors).length > 0 ? [notice({ tone: 'error', title: 'Revisa los filtros.', paragraphs: Object.values(errors) })] : [];
      const filters = join([
        select('estado', 'Estado', INVENTORY_ITEM_STATUSES.map((status) => option(status, STATUS_LABELS[status] ?? status, filter.estado || 'active')), errors.estado),
        select('tipo', 'Tipo', typeOptions(INVENTORY_ITEM_TYPES, filter.tipo, 'Todos'), errors.tipo),
        select('categoria', 'Categoría', categoryOptions(categories, filter.categoria, 'Todas'), errors.categoria),
        input('q', 'Buscar por nombre o SKU', filter.q, errors.q, { extra: [['type', 'search'], ['maxlength', 80], ['autocomplete', 'off']] }),
      ]);
      let results: SafeHtml = none();
      let pagination: SafeHtml = none();
      let summary = '';
      if (list) {
        const { items, page: info } = list;
        const pages = Math.max(1, Math.ceil(info.total / info.size));
        summary = info.total === 1 ? '1 artículo.' : `${info.total} artículos.`;
        results =
          items.length > 0
            ? render('partials/inventory-item-list', {
                rows: join(
                  items.map((item) =>
                    render('partials/inventory-item-row', {
                      href: itemPath(item.id),
                      name: item.name,
                      type: TYPE_LABELS[item.type],
                      category: item.categoryName,
                      baseUnit: item.baseUnit ?? '—',
                      sku: item.sku ?? '—',
                      variants: item.kind === 'parent' ? render('partials/inventory-row-extra', { term: 'Variantes', value: String(item.variantCount) }) : none(),
                      ...statusText(item.active),
                    }),
                  ),
                ),
              })
            : render('partials/empty', { text: 'No hay artículos que coincidan con los filtros. Cambia o quita alguno, o crea un artículo nuevo.' });
        if (pages > 1) {
          const query = (number: number) => {
            const params = new URLSearchParams(Object.entries({ estado: filter.estado, tipo: filter.tipo, categoria: filter.categoria, q: filter.q }).filter(([, value]) => value !== ''));
            params.set('pagina', String(number));
            return `${ITEMS_PATH}?${params.toString()}`;
          };
          const link = (number: number, label: string) => render('partials/inventory-page-link', { href: query(number), label });
          pagination = render('partials/inventory-pagination', {
            text: `Página ${info.number} de ${pages}`,
            links: join([...(info.number > 1 ? [link(info.number - 1, 'Anterior')] : []), ...(info.number < pages ? [link(info.number + 1, 'Siguiente')] : [])]),
          });
        }
      }
      return inventoryPage('Artículos del inventario', context, 'inventory', render('pages/inventory-items', {
        actions: join([render('partials/action-link', { href: NEW_ITEM_PATH, label: 'Nuevo artículo' }), render('partials/action-link', { href: `${NEW_ITEM_PATH}?clase=padre`, label: 'Nuevo con variantes' })]),
        notices: join([...notices, ...fieldsNotice]),
        filters,
        summary,
        results,
        pagination,
      }));
    },

    inventoryItemForm({ context, csrfToken, mode, kind, id, parent, categories, values, hidden, errors = {}, notices = [], conflict = false, locked = false }: ItemFormView): SafeHtml {
      const title = itemTitle(mode, kind, parent, values.name);
      const summary = errorSummary(errors, summaryFields(errors));
      const main: SafeHtml[] = [input('name', FIELD_LABELS.name ?? 'Nombre', values.name, errors.name, { help: 'Máximo 80 caracteres. No puede repetirse entre los artículos activos.', extra: [['maxlength', 80], ['autocomplete', 'off']] })];
      if (kind === 'variant') {
        main.push(render('partials/inventory-readonly', { label: 'Tipo y categoría', value: parent ? `${TYPE_LABELS[parent.type]} · ${parent.categoryName} (los hereda de ${parent.name})` : 'Los hereda del artículo padre' }));
      } else {
        if (mode === 'create') {
          const types = kind === 'parent' ? PARENT_TYPES : INVENTORY_ITEM_TYPES;
          main.push(select('type', FIELD_LABELS.type ?? 'Tipo', typeOptions(types, values.type, 'Elige el tipo'), errors.type, kind === 'parent' ? 'Un artículo con variantes solo puede ser de Reventa o Compuesto.' : 'No se puede cambiar después de crearlo.'));
        } else {
          main.push(render('partials/inventory-readonly', { label: 'Tipo', value: values.type in TYPE_LABELS ? TYPE_LABELS[values.type as InventoryItemType] : values.type }));
        }
        main.push(select('categoryId', FIELD_LABELS.categoryId ?? 'Categoría', categoryOptions(categories, values.categoryId, 'Elige la categoría'), errors.categoryId, kind === 'parent' ? 'Sus variantes la heredan.' : null));
      }
      if (kind !== 'parent') {
        main.push(
          select('baseUnit', FIELD_LABELS.baseUnit ?? 'Unidad base', [option('', 'Elige la unidad', values.baseUnit), ...INVENTORY_UNITS.map((unit) => option(unit, unit, values.baseUnit))], errors.baseUnit, 'kg, g, L, ml, pza u hr (horas, sin conversión a otras). Las existencias y las recetas se cuentan en ella.'),
          input('sku', FIELD_LABELS.sku ?? 'SKU', values.sku, errors.sku, { optional: true, help: 'Letras sin acento, dígitos, punto, guion y guion bajo; máximo 40. Un SKU usado no se repite nunca.', extra: [['maxlength', 40], ['autocomplete', 'off'], ['spellcheck', 'false']] }),
        );
      }
      const shown = costFields(mode, kind, kind === 'variant' && parent ? parent.type : values.type);
      if (shown.referenceCost) {
        const help = mode === 'create' && kind === 'simple'
          ? 'Por unidad base, en pesos con IVA; hasta 4 decimales, con punto. Solo Insumo, Intermedio y Reventa: un Compuesto se costea por su receta. Se usa mientras no haya costo promedio (CPP).'
          : 'Por unidad base, en pesos con IVA; hasta 4 decimales, con punto. Se usa mientras no haya costo promedio (CPP). Déjalo vacío si no lo conoces.';
        main.push(input('referenceCost', FIELD_LABELS.referenceCost ?? 'Costo de referencia', values.referenceCost, errors.referenceCost, { optional: true, help, extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20]] }));
      }
      if (shown.inventoriable) {
        const field = describe('inventoriable', mode === 'create' ? 'Desmárcala solo en un Insumo que no lleva existencias (p. ej. mano de obra o gas): se costea por su costo de referencia. Solo se cambia mientras no tenga movimientos.' : 'Desmárcala si no lleva existencias (p. ej. mano de obra o gas): se costea por su costo de referencia. Solo se cambia mientras no tenga movimientos.', errors.inventoriable);
        main.push(render('partials/field-checkbox', { ...field, label: 'Inventariable (lleva existencias)', span: 'md:col-span-2', checked: values.inventoriable ? render('partials/checked') : none(), attrs: attrs(field.aria) }));
      }
      const description = describe('description', 'Máximo 400 caracteres.', errors.description);
      main.push(render('partials/field-textarea', { ...description, label: FIELD_LABELS.description ?? 'Descripción', optional: ' (opcional)', value: values.description, attrs: attrs([['maxlength', 400], ...description.aria]) }));

      const sections = [
        render('partials/user-fieldset', { legend: 'Datos del artículo', attrs: none(), intro: kind === 'parent' ? render('partials/section-intro', { text: 'Agrupa variantes (sabores, tamaños). No tiene existencias, unidad base, SKU ni empaques propios: van en cada variante.' }) : none(), fields: join(main) }),
        ...(kind === 'parent' ? [] : [unitsSection(values, errors, locked)]),
      ];
      const buttons = conflict ? render('partials/overwrite') : render('partials/submit', { value: mode === 'create' ? 'create' : 'update', label: mode === 'create' ? 'Crear' : 'Guardar cambios' });
      const back = backOf(id, parent);
      return inventoryPage(title, context, 'inventory', render('pages/inventory-item-form', {
        ...back,
        title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        action: mode === 'create' ? ITEMS_PATH : itemPath(id ?? 0),
        csrfToken,
        hidden: join(Object.entries(hidden).map(([name, value]) => render('partials/hidden', { name, value }))),
        sections: join(sections),
        buttons,
      }));
    },

    inventoryItem({
      context,
      item,
      history,
      categories,
      usedIn = null,
      conversion,
      notices = [],
    }: {
      context: PageContext;
      item: InventoryItemDetail;
      history: InventoryHistoryEntry[];
      categories: readonly CategoryOption[];
      /** REQ-F-050 (RF-8): recetas vigentes que lo usan; null si no se pudieron consultar. */
      usedIn?: RecipeUsedInResponse['recipes'] | null;
      conversion?: ConversionView | undefined;
      notices?: SafeHtml[];
    }): SafeHtml {
      const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
      const isParent = item.kind === 'parent';
      const data = [
        dataRow('Tipo', TYPE_LABELS[item.type]),
        dataRow('Clase', item.kind === 'variant' && item.parent ? `Variante de ${item.parent.name}` : KIND_LABELS[item.kind]),
        dataRow('Categoría', item.category.active ? item.category.name : `${item.category.name} (inactiva)`),
        ...(isParent
          ? [dataRow('Existencias', 'No tiene: se controlan en cada variante.')]
          : [
              dataRow('Unidad base', item.baseUnit ?? '—'),
              dataRow('SKU', item.sku ?? '—'),
              ...(item.type === 'insumo' ? [dataRow('Inventariable', item.inventoriable ? 'Sí' : 'No: no lleva existencias; se costea por su costo de referencia')] : []),
              ...(item.type === 'compuesto' ? [] : [dataRow('Costo de referencia', item.referenceCost === null ? 'Sin costo de referencia' : referenceCostText(item.referenceCost, item.baseUnit))]),
              dataRow('Último costo', 'Sin costo'),
              dataRow('Costo promedio (CPP)', 'Sin costo'),
            ]),
        dataRow('Descripción', item.description ?? '—'),
      ];
      const actions: SafeHtml[] = [];
      const hasRecipe = !isParent && RECIPE_TYPES.includes(item.type);
      if (hasRecipe) actions.push(render('partials/action-link', { href: recipePath(item.id), label: 'Receta' }));
      if (item.active) {
        actions.push(render('partials/action-link', { href: itemEditPath(item.id), label: 'Editar' }));
        if (isParent) actions.push(render('partials/action-link', { href: `${NEW_ITEM_PATH}?padre=${item.id}`, label: 'Añadir variante' }));
        actions.push(render('partials/action-link', { href: itemDeactivatePath(item.id), label: 'Inactivar' }));
      }
      const reactivate = item.active ? none() : postButton(itemReactivatePath(item.id), context.csrfToken, item.version, 'Reactivar', item.name, 'secondary');

      let units: SafeHtml = none();
      let equivalences: SafeHtml = none();
      let convert: SafeHtml = none();
      if (!isParent && item.baseUnit) {
        units = item.units.length > 0
          ? render('partials/inventory-unit-list', { items: join(item.units.map((unit) => render('partials/inventory-unit', { name: unit.name, factor: trimDecimal(unit.factor), baseUnit: item.baseUnit ?? '' }))) })
          : render('partials/empty', { text: 'Sin unidades de empaque.' });
        equivalences = render('partials/inventory-equivalences', {
          baseUnit: item.baseUnit,
          rows: join(item.equivalences.map((row) => render('partials/inventory-equivalence-row', { unit: row.unit, quantity: trimDecimal(row.quantity), baseUnit: item.baseUnit ?? '' }))),
        });
        const current = conversion ?? { quantity: '', unit: item.baseUnit };
        const unitChoices = [...new Set([...INVENTORY_UNITS, ...item.units.map((unit) => unit.name)])];
        convert = render('partials/inventory-convert', {
          action: itemPath(item.id),
          fields: join([
            input('cantidad', 'Cantidad', current.quantity, current.error, { help: 'Con punto decimal, hasta 3 decimales.', extra: [['inputmode', 'decimal'], ['autocomplete', 'off']] }),
            select('unidad', 'Unidad', unitChoices.map((unit) => option(unit, unit, current.unit)), undefined),
          ]),
          result: current.result ? render('partials/inventory-convert-result', { text: `${current.quantity} ${current.unit} = ${current.result} ${item.baseUnit}` }) : none(),
        });
      }
      const variants = isParent
        ? item.variants.length > 0
          ? render('partials/inventory-variant-list', {
              items: join(item.variants.map((variant) => render('partials/inventory-variant', { href: itemPath(variant.id), name: variant.name, sku: variant.sku ?? '—', baseUnit: variant.baseUnit ?? '—', ...statusText(variant.active) }))),
            })
          : render('partials/empty', { text: 'Todavía no tiene variantes.' })
        : none();
      return inventoryPage(item.name, context, 'inventory', render('pages/inventory-item', {
        name: item.name,
        ...statusText(item.active),
        notices: join(notices),
        actions: join(actions),
        reactivate,
        data: join(data),
        units: isParent ? none() : render('partials/inventory-section', { id: 'empaques', title: 'Unidades de empaque', content: units }),
        equivalences: isParent ? none() : render('partials/inventory-section', { id: 'conversion', title: 'Equivalencias y conversión', content: join([equivalences, convert]) }),
        variants: isParent ? render('partials/inventory-section', { id: 'variantes', title: 'Variantes', content: variants }) : none(),
        usedIn: isParent
          ? none()
          : render('partials/inventory-section', {
              id: 'usado-en',
              title: 'Usado en',
              content:
                usedIn === null
                  ? render('partials/empty', { text: 'No se pudieron consultar las recetas que lo usan. Inténtalo de nuevo en unos minutos.' })
                  : usedIn.length > 0
                    ? render('partials/inventory-plain-list', { items: join(usedIn.map((recipe) => render('partials/inventory-link-item', { href: recipePath(recipe.itemId), text: `${recipe.name} (versión ${recipe.versionNumber})${recipe.active ? '' : ' · inactivo'}` }))) })
                    : render('partials/empty', { text: 'No se usa en ninguna receta vigente.' }),
            }),
        history: render('partials/inventory-section', {
          id: 'historial',
          title: 'Historial de cambios',
          content: history.length > 0 ? render('partials/inventory-history', { items: join(history.map((entry) => historyEntry(entry, categoryNames))) }) : render('partials/empty', { text: 'Sin cambios registrados.' }),
        }),
      }));
    },

    inventoryItemDeactivate({ context, item, recipes = [], notices = [] }: { context: PageContext; item: InventoryItemDetail; recipes?: readonly { itemId: number; name: string }[]; notices?: SafeHtml[] }): SafeHtml {
      const active = item.kind === 'parent' ? item.variants.filter((variant) => variant.active) : [];
      const intro =
        active.length > 0
          ? `Tiene ${active.length === 1 ? '1 variante activa' : `${active.length} variantes activas`}: se inactivarán también. Puedes reactivarlas una por una después.`
          : 'Deja de aparecer en la lista de activos. Conserva su historial y puedes reactivarlo después.';
      // REQ-F-050 (RF-7, CA-10): las recetas vigentes que lo usan no cambian; se confirma con recipes=keep.
      const inRecipes =
        recipes.length > 0
          ? join([
              render('partials/inventory-paragraph', { text: `Se usa en ${recipes.length === 1 ? '1 receta vigente' : `${recipes.length} recetas vigentes`}. Esas recetas no cambian: mostrarán un aviso de ingrediente inactivo, y el artículo ya no se ofrecerá en versiones nuevas.` }),
              render('partials/inventory-plain-list', { items: join(recipes.map((recipe) => render('partials/inventory-link-item', { href: recipePath(recipe.itemId), text: recipe.name }))) }),
            ])
          : none();
      const hidden = { ...(active.length > 0 ? { variants: 'deactivate' } : {}), ...(recipes.length > 0 ? { recipes: 'keep' } : {}) };
      const label = active.length > 0 ? 'Inactivar con sus variantes' : recipes.length > 0 ? 'Inactivar de todos modos' : 'Inactivar';
      return inventoryPage(`Inactivar ${item.name}`, context, 'inventory', render('pages/inventory-item-deactivate', {
        backHref: itemPath(item.id),
        name: item.name,
        notices: join(notices),
        intro,
        variants: join([active.length > 0 ? render('partials/inventory-plain-list', { items: join(active.map((variant) => render('partials/inventory-plain-item', { text: variant.name }))) }) : none(), inRecipes]),
        button: postButton(itemDeactivatePath(item.id), context.csrfToken, item.version, label, item.name, 'danger', hidden),
      }));
    },

    inventoryCategories({ context, csrfToken, categories, name = '', requestId, errors = {}, notices = [] }: { context: PageContext | null; csrfToken: string; categories: readonly InventoryCategoryWithUsage[] | null; name?: string; requestId: string; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const summary = errorSummary(errors, errors.name ? [{ name: 'name', label: 'Nombre de la categoría' }] : []);
      const rows = (categories ?? []).map((category) =>
        render('partials/inventory-category-row', {
          name: category.name,
          usage: category.activeItemCount === 1 ? '1 artículo activo' : `${category.activeItemCount} artículos activos`,
          ...statusText(category.active),
          state: category.active ? 'Activa' : 'Inactiva',
          renameHref: categoryEditPath(category.id),
          status: render('partials/inventory-post-button', {
            action: categoryStatusPath(category.id, category.active),
            csrfToken,
            version: '',
            label: category.active ? 'Inactivar' : 'Reactivar',
            name: category.name,
            hidden: none(),
            busyText: 'Guardando…',
            ...(category.active ? { buttonModifier: 'button--danger', buttonClass: 'border-error text-error hover:bg-error/10' } : { buttonModifier: 'button--secondary', buttonClass: 'border-adobo text-crema hover:bg-adobo/15' }),
          }),
        }),
      );
      return inventoryPage('Categorías del inventario', context, 'inventory-categories', render('pages/inventory-categories', {
        notices: join([...(summary ? [summary] : []), ...notices]),
        csrfToken,
        requestId,
        field: input('name', 'Nombre de la categoría', name, errors.name, { help: 'Máximo 60 caracteres. No puede repetirse entre las activas.', extra: [['maxlength', 60], ['autocomplete', 'off']] }),
        list: categories === null ? none() : rows.length > 0 ? render('partials/inventory-category-list', { rows: join(rows) }) : render('partials/empty', { text: 'Todavía no hay categorías. Crea la primera con el formulario de arriba.' }),
      }));
    },

    inventoryCategoryForm({ context, csrfToken, id, name, currentName, errors = {}, notices = [] }: { context: PageContext | null; csrfToken: string; id: number; name: string; currentName: string | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const title = currentName ? `Renombrar ${currentName}` : 'Renombrar categoría';
      const summary = errorSummary(errors, errors.name ? [{ name: 'name', label: 'Nombre de la categoría' }] : []);
      return inventoryPage(title, context, 'inventory-categories', render('pages/inventory-category-form', {
        title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        action: categoryPath(id),
        csrfToken,
        field: input('name', 'Nombre de la categoría', name, errors.name, { help: 'Máximo 60 caracteres. No puede repetirse entre las activas.', extra: [['maxlength', 60], ['autocomplete', 'off']] }),
      }));
    },
  };
}
