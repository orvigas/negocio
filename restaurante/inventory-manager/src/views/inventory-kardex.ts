import {
  INVENTORY_STOCK_ITEM_TYPES,
  type InventoryHistoryEntry,
  type InventoryItemType,
  type ItemKardexResponse,
  type ItemStock,
  type KardexDocument,
  type KardexDocumentDetailResponse,
  type KardexDocumentListResponse,
  type KardexReversalPreviewResponse,
  type StockResponse,
  type SupplierListResponse,
} from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { NoticeOptions, PageContext, PageOptions } from './index.ts';
import { TYPE_LABELS, itemPath, trimDecimal } from './inventory.ts';
import { money } from './inventory-recipes.ts';

/**
 * Pantallas del Kardex en el admin (REQ-F-051, T3; PR 3a): existencias valorizadas (RF-7), Kardex del
 * artículo en su ficha (RF-8), proveedores (RF-1), lista y detalle de documentos (RF-9) y la
 * confirmación de la reversión (RF-4). Sin JavaScript obligatorio; tablas con `caption`; los estados
 * («Negativo», «Sin costo», «Revertido») van con texto, no solo con color (RF-16). Sistema visual del
 * admin, sin Stitch (PV-8 y PV-T3-10): reutiliza los parciales de T1 y T2.
 */

export const STOCK_PATH = '/inventario/existencias';
export const SUPPLIERS_PATH = '/inventario/proveedores';
export const NEW_SUPPLIER_PATH = `${SUPPLIERS_PATH}/nuevo`;
export const supplierPath = (id: number): string => `${SUPPLIERS_PATH}/${id}`;
export const supplierEditPath = (id: number): string => `${supplierPath(id)}/editar`;
export const supplierStatusPath = (id: number, active: boolean): string => `${supplierPath(id)}/${active ? 'desactivar' : 'reactivar'}`;
export const DOCUMENTS_PATH = '/inventario/documentos';
export const documentPath = (id: number): string => `${DOCUMENTS_PATH}/${id}`;
export const reversalPath = (id: number): string => `${documentPath(id)}/revertir`;
/** Parámetro de la página del Kardex en la ficha (la ficha ya usa `cantidad` y `unidad`). */
export const KARDEX_PAGE_PARAM = 'kardex';

/** Tipos de documento que escribe T3 (filtro de la lista). */
const DOCUMENT_TYPES: readonly [string, string][] = [
  ['saldo_inicial', 'Saldo inicial'],
  ['compra', 'Compra'],
  ['devolucion_proveedor', 'Devolución a proveedor'],
  ['ajuste', 'Ajuste'],
  ['reversion', 'Reversión'],
];
const STOCK_STATUS_LABELS: readonly [string, string][] = [
  ['todos', 'Todos'],
  ['negativos', 'Negativos'],
  ['sin_costo', 'Sin costo'],
];
const SUPPLIER_STATUS_LABELS: readonly [string, string][] = [
  ['active', 'Activos'],
  ['inactive', 'Inactivos'],
  ['all', 'Todos'],
];
const REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({ error_captura: 'Error de captura', otro: 'Otro' });
const COST_BASIS_LABELS: Readonly<Record<string, string>> = Object.freeze({ con_iva: 'Con IVA', sin_iva: 'Sin IVA' });
const HISTORY_FIELDS: Readonly<Record<string, string>> = Object.freeze({ name: 'Nombre', contact: 'Contacto', active: 'Estado' });

/** Importe con 2 decimales y signo («-200.00» -> «−$200.00»). */
export function signedMoney(text: string): string {
  const negative = text.startsWith('-');
  const [integer = '0', fraction = '00'] = (negative ? text.slice(1) : text).split('.');
  return `${negative ? '−' : ''}$${BigInt(integer).toLocaleString('es-MX')}.${fraction.padEnd(2, '0').slice(0, 2)}`;
}

/** Cantidad con su unidad, sin ceros finales («-2.000» -> «−2 kg»). */
export function quantityWithUnit(quantity: string, unit: string | null): string {
  const trimmed = trimDecimal(quantity.replace(/^-/, ''));
  return `${quantity.startsWith('-') ? '−' : ''}${trimmed}${unit ? ` ${unit}` : ''}`;
}

/**
 * Costo unitario con sus 4 decimales («21.3333» -> «$21.3333»): RN-T3-10 y PV-13, decisión A del usuario
 * en REQUIREMENT_AMBIGUITY-1 del QA del PR 3a. Los importes y valores siguen con 2 (`money`, `signedMoney`).
 */
export function unitCost(text: string): string {
  const [integer = '0', fraction = ''] = text.split('.');
  return `$${BigInt(integer).toLocaleString('es-MX')}.${fraction.padEnd(4, '0').slice(0, 4)}`;
}

const costText = (cost: string | null, baseUnit: string | null): string => (cost === null ? 'Sin costo' : `${unitCost(cost)}${baseUnit ? ` / ${baseUnit}` : ''}`);
const dayText = (day: string): string => {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
};

interface KardexViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  errorSummary: (errors: Record<string, string>, fields: readonly { name: string; label: string }[]) => SafeHtml | null;
  fieldId: (name: string) => string;
  displayDate: (iso: string | null) => string;
}

export interface StockFilterValues {
  q: string;
  categoria: string;
  tipo: string;
  estado: string;
}

export interface SupplierFormValues {
  name: string;
  contact: string;
}

export function createKardexViews({ render, join, attrs, page, notice, errorSummary, fieldId, displayDate }: KardexViewHelpers) {
  const none = () => join([]);
  const selected = (on: boolean) => (on ? render('partials/selected') : none());
  const option = (value: string, label: string, current: string) => render('partials/option', { value, label, selected: selected(value === current) });
  const dataRow = (term: string, value: string) => render('partials/inventory-data-row', { term, value });
  const section = (id: string, title: string, content: SafeHtml) => render('partials/inventory-section', { id, title, content });
  const actionLink = (href: string, label: string) => render('partials/action-link', { href, label });
  const cell = (text: string, align = '') => render('partials/recipe-cell', { text, align });
  const cellHtml = (content: SafeHtml, align = '') => render('partials/recipe-cell-html', { content, align });
  const headCell = (content: SafeHtml) => render('partials/recipe-cell-head', { content });
  const link = (href: string, text: string) => render('partials/recipe-link', { href, text });
  const row = (cells: SafeHtml[]) => render('partials/recipe-row', { cells: join(cells) });
  const head = (labels: readonly (string | [string, string])[]) => join(labels.map((entry) => (typeof entry === 'string' ? render('partials/recipe-th', { label: entry, align: '' }) : render('partials/recipe-th', { label: entry[0], align: entry[1] }))));
  const table = (captionId: string, caption: string, labels: readonly (string | [string, string])[], rows: SafeHtml[]) => render('partials/recipe-table', { captionId, caption, head: head(labels), rows: join(rows) });
  const state = (text: string, modifier: 'negative' | 'no-cost' | 'reversed' | 'inactive') =>
    render('partials/kardex-state', { text, modifier, icon: modifier === 'negative' || modifier === 'reversed' ? '⚠' : '•', toneClass: modifier === 'negative' ? 'text-error' : 'text-maiz' });
  const inventoryPage = (title: string, context: PageContext | null, sectionName: PageOptions['section'], body: SafeHtml) => page({ title, ...(context ? { context } : {}), section: sectionName, body });

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
  function input(name: string, label: string, value: string, error: string | undefined, { help = null, optional = false, extra = [] }: { help?: string | null; optional?: boolean; extra?: [string, string | number | boolean | undefined][] } = {}): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-input', { ...field, label, optional: optional ? ' (opcional)' : '', span: '', value, attrs: attrs([...extra, ...field.aria]) });
  }
  function select(name: string, label: string, options: SafeHtml[], error: string | undefined): SafeHtml {
    const field = describe(name, null, error);
    return render('partials/field-select', { ...field, label, span: '', attrs: attrs(field.aria), options: join(options) });
  }
  function textarea(name: string, label: string, value: string, error: string | undefined, help: string, max: number): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-textarea', { ...field, label, optional: '', value, attrs: attrs([['maxlength', max], ['required', true], ...field.aria]) });
  }

  /**
   * Resumen, aviso fuera de rango y paginación de una lista (OBS-12 c): una página fuera de rango no dice
   * a la vez «N resultados» y «No hay…»; ofrece ir a la última.
   */
  function listing(info: { number: number; size: number; total: number }, nouns: [string, string], empty: string, rows: SafeHtml | null, hrefFor: (page: number) => string) {
    const pages = Math.max(1, Math.ceil(info.total / info.size));
    const outOfRange = info.total > 0 && info.number > pages;
    const pageLink = (number: number, label: string) => render('partials/inventory-page-link', { href: hrefFor(number), label });
    const summary = outOfRange ? '' : info.total === 1 ? `1 ${nouns[0]}.` : `${info.total} ${nouns[1]}.`;
    const results = outOfRange
      ? render('partials/empty', { text: `Esta página no existe: hay ${info.total === 1 ? `1 ${nouns[0]}` : `${info.total} ${nouns[1]}`} en ${pages === 1 ? '1 página' : `${pages} páginas`}.` })
      : rows ?? render('partials/empty', { text: empty });
    const pagination =
      pages > 1 || outOfRange
        ? render('partials/inventory-pagination', {
            text: outOfRange ? `La última página es la ${pages}.` : `Página ${info.number} de ${pages}`,
            links: outOfRange ? pageLink(pages, 'Ir a la última página') : join([...(info.number > 1 ? [pageLink(info.number - 1, 'Anterior')] : []), ...(info.number < pages ? [pageLink(info.number + 1, 'Siguiente')] : [])]),
          })
        : none();
    return { summary, results, pagination };
  }

  const queryHref = (path: string, values: Record<string, string>, pageNumber: number, pageParam = 'pagina') => {
    const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== ''));
    params.set(pageParam, String(pageNumber));
    return `${path}?${params.toString()}`;
  };
  const filterNotice = (errors: Record<string, string>) => (Object.keys(errors).length > 0 ? [notice({ tone: 'error', title: 'Revisa los filtros.', paragraphs: Object.values(errors) })] : []);
  const supplierText = (document: KardexDocument) => document.supplier?.name ?? (document.type === 'compra' || document.type === 'devolucion_proveedor' ? 'Sin proveedor' : '—');
  const documentState = (document: KardexDocument): SafeHtml =>
    document.reversedById !== null
      ? join([state('Revertido por', 'reversed'), render('partials/recipe-link', { href: documentPath(document.reversedById), text: ` #${document.reversedById}` })])
      : document.reversesDocumentId !== null
        ? render('partials/recipe-link', { href: documentPath(document.reversesDocumentId), text: `Reversión de #${document.reversesDocumentId}` })
        : render('partials/inventory-paragraph', { text: 'Vigente' });

  return {
    /** Existencia, CPP y último costo de la ficha (RF-10): sustituyen al «Sin costo» de T2. */
    itemStockRows(stock: ItemStock | null, baseUnit: string | null): SafeHtml[] {
      if (stock === null) return [dataRow('Existencias', 'No lleva existencias (Compuesto o no inventariable): se costea por su receta o su costo de referencia.')];
      return [
        dataRow('Existencia', `${quantityWithUnit(stock.quantity, baseUnit)}${stock.quantity.startsWith('-') ? ' (negativa)' : ''}`),
        dataRow('Costo promedio (CPP)', costText(stock.avgCost, baseUnit)),
        dataRow('Último costo', stock.lastCost === null ? 'Sin compras' : costText(stock.lastCost, baseUnit)),
      ];
    },

    /** Kardex del artículo en su ficha (RF-8, CA-17): del más reciente al más antiguo, de 50 en 50. */
    itemKardexSection(kardex: ItemKardexResponse | null): SafeHtml {
      if (kardex === null) return section('kardex', 'Kardex', render('partials/empty', { text: 'No se pudo consultar el Kardex. Inténtalo de nuevo en unos minutos.' }));
      if (kardex.stock === null) return none();
      const unit = kardex.item.baseUnit;
      const rows =
        kardex.movements.length > 0
          ? table(
              'kardex-caption',
              `Movimientos de ${kardex.item.name}, del más reciente al más antiguo`,
              ['Registro', 'Fecha del hecho', 'Tipo', 'Documento', ['Cantidad', 'text-right'], ['En unidad base', 'text-right'], ['Existencia anterior', 'text-right'], ['Existencia nueva', 'text-right'], ['Costo unitario', 'text-right'], ['CPP posterior', 'text-right'], 'Usuario'],
              kardex.movements.map((movement) =>
                row([
                  headCell(render('partials/recipe-ingredient', { name: displayDate(movement.recordedAt), flag: none() })),
                  cell(dayText(movement.occurredOn)),
                  cell(movement.typeLabel),
                  cellHtml(link(documentPath(movement.documentId), `#${movement.documentId}`)),
                  cell(`${movement.quantity.startsWith('-') ? '−' : '+'}${trimDecimal(movement.enteredQuantity)} ${movement.enteredUnit}`, 'text-right tabular-nums'),
                  cell(`${movement.quantity.startsWith('-') ? '' : '+'}${quantityWithUnit(movement.quantity, unit)}`, 'text-right tabular-nums'),
                  cell(quantityWithUnit(movement.balanceBefore, unit), 'text-right tabular-nums'),
                  cell(quantityWithUnit(movement.balanceAfter, unit), 'text-right tabular-nums'),
                  movement.unitCost === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : cell(unitCost(movement.unitCost), 'text-right tabular-nums'),
                  movement.avgCostAfter === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : cell(unitCost(movement.avgCostAfter), 'text-right tabular-nums'),
                  cell(movement.author),
                ]),
              ),
            )
          : null;
      const { summary, results, pagination } = listing(kardex.page, ['movimiento', 'movimientos'], 'Todavía no tiene movimientos.', rows, (number) => `${itemPath(kardex.item.id)}?${KARDEX_PAGE_PARAM}=${number}#kardex`);
      return section('kardex', 'Kardex', join([render('partials/inventory-paragraph', { text: summary }), results, pagination]));
    },

    inventoryStock({ context, filter, categories, data, errors = {}, notices = [] }: { context: PageContext; filter: StockFilterValues; categories: readonly { id: number; name: string; active: boolean }[]; data: StockResponse | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const filters = join([
        input('q', 'Buscar por nombre', filter.q, errors.q, { extra: [['type', 'search'], ['maxlength', 80], ['autocomplete', 'off']] }),
        select('categoria', 'Categoría', [option('', 'Todas', filter.categoria), ...categories.map((category) => option(String(category.id), category.active ? category.name : `${category.name} (inactiva)`, filter.categoria))], errors.categoria),
        select('tipo', 'Tipo', [option('', 'Todos', filter.tipo), ...INVENTORY_STOCK_ITEM_TYPES.map((type) => option(type, TYPE_LABELS[type as InventoryItemType], filter.tipo))], errors.tipo),
        select('estado', 'Estado', STOCK_STATUS_LABELS.map(([value, label]) => option(value, label, filter.estado || 'todos')), errors.estado),
      ]);
      let summary = '';
      let results: SafeHtml = none();
      let pagination: SafeHtml = none();
      let totals: SafeHtml = none();
      if (data) {
        const rows =
          data.entries.length > 0
            ? table(
                'stock-caption',
                'Existencias valorizadas al CPP',
                ['Artículo', 'Categoría', 'Tipo', ['Existencia', 'text-right'], ['CPP', 'text-right'], ['Último costo', 'text-right'], ['Valor', 'text-right'], 'Estado'],
                data.entries.map((entry) =>
                  row([
                    headCell(link(itemPath(entry.item.id), entry.item.name)),
                    cell(entry.categoryName),
                    cell(TYPE_LABELS[entry.item.type]),
                    cell(quantityWithUnit(entry.quantity, entry.item.baseUnit), 'text-right tabular-nums'),
                    cell(costText(entry.avgCost, entry.item.baseUnit), 'text-right tabular-nums'),
                    cell(entry.lastCost === null ? '—' : costText(entry.lastCost, entry.item.baseUnit), 'text-right tabular-nums'),
                    entry.value === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : cell(signedMoney(entry.value), 'text-right tabular-nums'),
                    cellHtml(
                      join([
                        ...(entry.negative ? [state('Negativo', 'negative')] : []),
                        ...(entry.noCost ? [state('Sin costo', 'no-cost')] : []),
                        ...(entry.item.active ? [] : [state('Inactivo', 'inactive')]),
                        ...(!entry.negative && !entry.noCost && entry.item.active ? [render('partials/inventory-paragraph', { text: '—' })] : []),
                      ]),
                    ),
                  ]),
                ),
              )
            : null;
        ({ summary, results, pagination } = listing(data.page, ['artículo', 'artículos'], 'No hay artículos con existencias que coincidan con los filtros.', rows, (number) => queryHref(STOCK_PATH, { ...filter }, number)));
        totals = render('partials/kardex-totals', {
          rows: join([
            dataRow('Valor de las existencias positivas con costo', signedMoney(data.totals.positiveValue)),
            dataRow('Valor de las existencias negativas', signedMoney(data.totals.negativeValue)),
            dataRow('Artículos sin costo', String(data.totals.noCostCount)),
          ]),
        });
      }
      return inventoryPage('Existencias', context, 'inventory-stock', render('pages/inventory-list', {
        title: 'Existencias',
        intro: 'Existencia de cada Insumo, Intermedio y Reventa inventariable, con su costo promedio (CPP), su último costo y su valor (existencia × CPP, con IVA). Los totales suman los valores redondeados de todos los resultados, no solo los de esta página.',
        actions: join([actionLink(DOCUMENTS_PATH, 'Documentos')]),
        notices: join([...notices, ...filterNotice(errors)]),
        action: STOCK_PATH,
        filterLabel: 'Filtrar existencias',
        filters,
        extra: totals,
        summary,
        results,
        pagination,
      }));
    },

    inventorySuppliers({ context, filter, data, errors = {}, notices = [] }: { context: PageContext; filter: { estado: string; q: string }; data: SupplierListResponse | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const filters = join([
        select('estado', 'Estado', SUPPLIER_STATUS_LABELS.map(([value, label]) => option(value, label, filter.estado || 'active')), errors.estado),
        input('q', 'Buscar por nombre', filter.q, errors.q, { extra: [['type', 'search'], ['maxlength', 80], ['autocomplete', 'off']] }),
      ]);
      let summary = '';
      let results: SafeHtml = none();
      let pagination: SafeHtml = none();
      if (data) {
        const rows =
          data.suppliers.length > 0
            ? table(
                'suppliers-caption',
                'Proveedores',
                ['Nombre', 'Contacto', 'Estado', 'Acciones'],
                data.suppliers.map((supplier) =>
                  row([
                    headCell(link(supplierEditPath(supplier.id), supplier.name)),
                    cell(supplier.contact ?? '—'),
                    supplier.active ? cell('Activo') : cellHtml(state('Inactivo', 'inactive')),
                    cellHtml(
                      render('partials/inventory-post-button', {
                        action: supplierStatusPath(supplier.id, supplier.active),
                        csrfToken: context.csrfToken,
                        version: String(supplier.version),
                        label: supplier.active ? 'Inactivar' : 'Reactivar',
                        name: supplier.name,
                        hidden: none(),
                        busyText: 'Guardando…',
                        ...(supplier.active ? { buttonModifier: 'button--danger', buttonClass: 'border-error text-error hover:bg-error/10' } : { buttonModifier: 'button--secondary', buttonClass: 'border-adobo text-crema hover:bg-adobo/15' }),
                      }),
                    ),
                  ]),
                ),
              )
            : null;
        ({ summary, results, pagination } = listing(data.page, ['proveedor', 'proveedores'], 'No hay proveedores que coincidan con los filtros. Cambia o quita alguno, o crea uno nuevo.', rows, (number) => queryHref(SUPPLIERS_PATH, filter, number)));
      }
      return inventoryPage('Proveedores', context, 'inventory-suppliers', render('pages/inventory-list', {
        title: 'Proveedores',
        intro: 'Del proveedor solo se guardan el nombre comercial y un contacto (un teléfono o un correo). Un proveedor inactivo no se ofrece en compras nuevas, pero sigue en la historia.',
        actions: actionLink(NEW_SUPPLIER_PATH, 'Nuevo proveedor'),
        notices: join([...notices, ...filterNotice(errors)]),
        action: SUPPLIERS_PATH,
        filterLabel: 'Filtrar proveedores',
        filters,
        extra: none(),
        summary,
        results,
        pagination,
      }));
    },

    inventorySupplierForm({
      context,
      csrfToken,
      id,
      values,
      version = '',
      requestId = '',
      history = [],
      errors = {},
      notices = [],
      conflict = false,
    }: {
      context: PageContext | null;
      csrfToken: string;
      /** null: alta. */
      id: number | null;
      values: SupplierFormValues;
      version?: string;
      requestId?: string;
      history?: InventoryHistoryEntry[];
      errors?: Record<string, string>;
      notices?: SafeHtml[];
      conflict?: boolean;
    }): SafeHtml {
      const title = id === null ? 'Nuevo proveedor' : `Editar ${values.name || 'proveedor'}`;
      const summary = errorSummary(errors, [
        ...(errors.name ? [{ name: 'name', label: 'Nombre comercial' }] : []),
        ...(errors.contact ? [{ name: 'contact', label: 'Contacto' }] : []),
      ]);
      const hidden: Record<string, string> = id === null ? { requestId } : { version };
      const historyHtml =
        id === null
          ? none()
          : section(
              'historial',
              'Historial de cambios',
              history.length > 0
                ? render('partials/inventory-plain-list', {
                    items: join(
                      history.map((entry) =>
                        render('partials/inventory-plain-item', {
                          text: `${displayDate(entry.at)} · ${entry.author}: ${entry.changes.map((change) => `${HISTORY_FIELDS[change.field] ?? change.field} ${change.field === 'active' ? (change.after === true ? 'activo' : 'inactivo') : `«${typeof change.after === 'string' ? change.after : '—'}»`}`).join(', ')}`,
                        }),
                      ),
                    ),
                  })
                : render('partials/empty', { text: 'Sin cambios registrados.' }),
            );
      return inventoryPage(title, context, 'inventory-suppliers', join([
        render('pages/inventory-simple-form', {
          backHref: SUPPLIERS_PATH,
          backLabel: 'Volver a proveedores',
          title,
          notices: join([...(summary ? [summary] : []), ...notices]),
          before: none(),
          formId: 'inventory-supplier-form',
          action: id === null ? SUPPLIERS_PATH : supplierPath(id),
          csrfToken,
          hidden: join(Object.entries(hidden).map(([name, value]) => render('partials/hidden', { name, value }))),
          fields: join([
            input('name', 'Nombre comercial', values.name, errors.name, { help: 'Máximo 80 caracteres. No puede repetirse entre los proveedores activos.', extra: [['maxlength', 80], ['autocomplete', 'off'], ['required', true]] }),
            input('contact', 'Contacto', values.contact, errors.contact, { optional: true, help: 'Un teléfono (de 7 a 20 dígitos) o un correo, nada más.', extra: [['maxlength', 120], ['autocomplete', 'off']] }),
          ]),
          buttons: conflict ? render('partials/overwrite') : render('partials/submit', { value: id === null ? 'create' : 'update', label: id === null ? 'Crear' : 'Guardar cambios' }),
        }),
        historyHtml,
      ]));
    },

    inventoryDocuments({ context, filter, suppliers, data, errors = {}, notices = [] }: { context: PageContext; filter: { tipo: string; proveedor: string }; suppliers: readonly { id: number; name: string }[]; data: KardexDocumentListResponse | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const filters = join([
        select('tipo', 'Tipo', [option('', 'Todos', filter.tipo), ...DOCUMENT_TYPES.map(([value, label]) => option(value, label, filter.tipo))], errors.tipo),
        select('proveedor', 'Proveedor', [option('', 'Todos', filter.proveedor), ...suppliers.map((supplier) => option(String(supplier.id), supplier.name, filter.proveedor))], errors.proveedor),
      ]);
      let summary = '';
      let results: SafeHtml = none();
      let pagination: SafeHtml = none();
      if (data) {
        const rows =
          data.documents.length > 0
            ? table(
                'documents-caption',
                'Documentos del Kardex, del más reciente al más antiguo',
                ['Documento', 'Tipo', 'Fecha del hecho', 'Registro', 'Proveedor', ['Total', 'text-right'], 'Estado', 'Usuario'],
                data.documents.map((document) =>
                  row([
                    headCell(link(documentPath(document.id), `#${document.id}`)),
                    cell(document.typeLabel),
                    cell(dayText(document.occurredOn)),
                    cell(displayDate(document.recordedAt)),
                    cell(supplierText(document)),
                    cell(money(document.totalCost), 'text-right tabular-nums'),
                    cellHtml(documentState(document)),
                    cell(document.author),
                  ]),
                ),
              )
            : null;
        ({ summary, results, pagination } = listing(data.page, ['documento', 'documentos'], 'No hay documentos que coincidan con los filtros.', rows, (number) => queryHref(DOCUMENTS_PATH, filter, number)));
      }
      return inventoryPage('Documentos', context, 'inventory-documents', render('pages/inventory-list', {
        title: 'Documentos',
        intro: 'Saldos iniciales, compras, devoluciones, ajustes y reversiones. Un documento no se edita ni se borra: un error se corrige revirtiéndolo.',
        actions: join([actionLink(STOCK_PATH, 'Existencias')]),
        notices: join([...notices, ...filterNotice(errors)]),
        action: DOCUMENTS_PATH,
        filterLabel: 'Filtrar documentos',
        filters,
        extra: none(),
        summary,
        results,
        pagination,
      }));
    },

    inventoryDocument({ context, data, notices = [] }: { context: PageContext; data: KardexDocumentDetailResponse; notices?: SafeHtml[] }): SafeHtml {
      const { document, lines, returns } = data;
      const title = `${document.typeLabel} #${document.id}`;
      const reversible = document.type !== 'reversion' && document.reversedById === null;
      const header = [
        dataRow('Fecha del hecho', dayText(document.occurredOn)),
        dataRow('Registrado', `${displayDate(document.recordedAt)} por ${document.author}`),
        ...(document.type === 'compra' || document.type === 'devolucion_proveedor' ? [dataRow('Proveedor', supplierText(document))] : []),
        ...(document.reference ? [dataRow('Folio', document.reference)] : []),
        ...(document.costBasis ? [dataRow('Criterio de costo', COST_BASIS_LABELS[document.costBasis] ?? document.costBasis)] : []),
        ...(document.reason ? [dataRow('Motivo', REASON_LABELS[document.reason] ?? document.reason)] : []),
        ...(document.note ? [dataRow(document.type === 'reversion' ? 'Motivo de la reversión' : 'Nota', document.note)] : []),
        dataRow('Total', money(document.totalCost)),
      ];
      const lineRows = lines.map((line) =>
        row([
          headCell(link(itemPath(line.itemId), line.itemName)),
          cell(`${trimDecimal(line.enteredQuantity)} ${line.enteredUnit}`, 'text-right tabular-nums'),
          cell(`${line.quantity.startsWith('-') ? '' : '+'}${quantityWithUnit(line.quantity, line.baseUnit)}`, 'text-right tabular-nums'),
          line.unitCost === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : cell(unitCost(line.unitCost), 'text-right tabular-nums'),
          line.lineTotal === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : document.type === 'compra' && /^0+\.0+$/.test(line.lineTotal) ? cell('Sin cargo', 'text-right') : cell(money(line.lineTotal), 'text-right tabular-nums'),
          cell(quantityWithUnit(line.balanceAfter, line.baseUnit), 'text-right tabular-nums'),
          ...(document.type === 'compra' ? [cell(line.returnable === null ? '—' : quantityWithUnit(line.returnable, line.baseUnit), 'text-right tabular-nums')] : []),
        ]),
      );
      const labels: (string | [string, string])[] = ['Artículo', ['Capturado', 'text-right'], ['En unidad base', 'text-right'], ['Costo unitario', 'text-right'], ['Importe', 'text-right'], ['Existencia nueva', 'text-right'], ...(document.type === 'compra' ? [['Por devolver', 'text-right'] as [string, string]] : [])];
      const returnsHtml =
        document.type === 'compra'
          ? section(
              'devoluciones',
              'Devoluciones',
              returns.length > 0
                ? render('partials/inventory-plain-list', {
                    items: join(returns.map((entry) => render('partials/inventory-link-item', { href: documentPath(entry.id), text: `#${entry.id} · ${dayText(entry.occurredOn)} · ${money(entry.totalCost)}${entry.reversedById === null ? '' : ` · revertida por #${entry.reversedById}`}` }))),
                  })
                : render('partials/empty', { text: 'Sin devoluciones.' }),
            )
          : none();
      return inventoryPage(title, context, 'inventory-documents', render('pages/inventory-detail', {
        backHref: DOCUMENTS_PATH,
        backLabel: 'Volver a documentos',
        eyebrow: 'Documento del Kardex',
        title,
        subtitle: document.reversedById !== null ? `Revertido por #${document.reversedById}` : document.reversesDocumentId !== null ? `Reversión de #${document.reversesDocumentId}` : 'Vigente',
        // OBS-22: «Revertido por #N» y «Reversión de #N» enlazan al otro documento.
        actions: join([
          ...(reversible ? [actionLink(reversalPath(document.id), 'Revertir')] : []),
          ...(document.reversedById !== null ? [actionLink(documentPath(document.reversedById), `Ver la reversión #${document.reversedById}`)] : []),
          ...(document.reversesDocumentId !== null ? [actionLink(documentPath(document.reversesDocumentId), `Ver el documento revertido #${document.reversesDocumentId}`)] : []),
        ]),
        buttons: none(),
        notices: join(notices),
        sections: join([
          render('partials/inventory-section', { id: 'cabecera', title: 'Datos', content: render('partials/kardex-totals-list', { rows: join(header) }) }),
          section('lineas', 'Líneas', table('lines-caption', `Líneas del documento #${document.id}`, labels, lineRows)),
          returnsHtml,
        ]),
      }));
    },

    inventoryReversal({
      context,
      csrfToken,
      document,
      preview,
      units = new Map(),
      reason,
      requestId,
      errors = {},
      notices = [],
    }: {
      context: PageContext | null;
      csrfToken: string;
      /** Solo el id y el tipo: con la API caída se pinta sin leer el documento (DEF-005). */
      document: Pick<KardexDocument, 'id' | 'typeLabel'>;
      preview: KardexReversalPreviewResponse | null;
      /** Unidad base por artículo, para las cantidades de la vista previa (OBS-26). */
      units?: ReadonlyMap<number, string | null>;
      reason: string;
      requestId: string;
      errors?: Record<string, string>;
      notices?: SafeHtml[];
    }): SafeHtml {
      const title = `Revertir ${document.typeLabel.toLowerCase()} #${document.id}`;
      const summary = errorSummary(errors, errors.reason ? [{ name: 'reason', label: 'Motivo de la reversión' }] : []);
      // OBS-14: un error de las líneas (p. ej. un CPP fuera de rango) no tiene campo en este formulario: va como aviso.
      const lineErrors = Object.entries(errors).filter(([key]) => key.startsWith('lines'));
      const negative = preview?.lines.some((line) => line.negative) ?? false;
      const before = join([
        render('partials/inventory-paragraph', { text: 'Se registra un documento nuevo con los movimientos contrarios, cada uno al costo con que entró o salió. El documento original no cambia y queda como «Revertido». Una reversión no se puede revertir.' }),
        ...(lineErrors.length > 0 ? [notice({ tone: 'error', title: 'No se puede revertir.', paragraphs: lineErrors.map(([, message]) => message) })] : []),
        ...(negative ? [notice({ tone: 'warning', title: 'Alguna existencia quedará negativa.', paragraphs: ['Se permite (PV-2): el artículo aparecerá como «Negativo» en Existencias.'] })] : []),
        preview
          ? table(
              'reversal-caption',
              'Movimientos contrarios que se registrarán',
              ['Artículo', ['Cantidad', 'text-right'], ['Costo unitario', 'text-right'], ['Existencia resultante', 'text-right'], 'Aviso'],
              preview.lines.map((line) =>
                row([
                  headCell(link(itemPath(line.itemId), line.itemName)),
                  cell(`${line.quantity.startsWith('-') ? '' : '+'}${quantityWithUnit(line.quantity, units.get(line.itemId) ?? null)}`, 'text-right tabular-nums'),
                  line.unitCost === null ? cellHtml(state('Sin costo', 'no-cost'), 'text-right') : cell(unitCost(line.unitCost), 'text-right tabular-nums'),
                  cell(quantityWithUnit(line.balanceAfter, units.get(line.itemId) ?? null), 'text-right tabular-nums'),
                  line.negative ? cellHtml(state('Quedará negativa', 'negative')) : cell('—'),
                ]),
              ),
            )
          : none(),
      ]);
      return inventoryPage(title, context, 'inventory-documents', render('pages/inventory-simple-form', {
        backHref: documentPath(document.id),
        backLabel: 'Volver al documento',
        title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        before,
        formId: 'inventory-reversal-form',
        action: reversalPath(document.id),
        csrfToken,
        hidden: render('partials/hidden', { name: 'requestId', value: requestId }),
        fields: textarea('reason', 'Motivo de la reversión', reason, errors.reason, 'Obligatorio, máximo 400 caracteres. Queda en el documento de la reversión.', 400),
        buttons: render('partials/submit', { value: 'reverse', label: 'Revertir' }),
      }));
    },
  };
}

export type KardexViews = ReturnType<typeof createKardexViews>;
