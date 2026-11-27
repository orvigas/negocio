import { INVENTORY_UNITS, type KardexDocumentDetailResponse, type KardexOptionsResponse } from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { PageContext, PageOptions } from './index.ts';
import { TYPE_LABELS } from './inventory.ts';
import { DOCUMENTS_PATH, documentPath, quantityWithUnit, unitCost } from './inventory-kardex.ts';

/**
 * Formularios del Kardex con líneas (REQ-F-051, T3; PR 3b): saldo inicial (RF-2), compra (RF-3), ajuste
 * (RF-5) y devolución a proveedor (RF-6). Sin JavaScript obligatorio:
 *
 * - Bloques de 10 filas hasta 50 (PV-T3-4): «Añadir 10 filas» vuelve a pintar lo escrito y pone `autofocus`
 *   en el artículo de la primera fila nueva; un aviso de error con foco tiene prioridad (patrón de REQ-F-054).
 * - El artículo se elige con `<input list>` y un único `<datalist>`; la unidad, igual (sistema o empaque).
 * - En móvil, un `fieldset` por línea con su leyenda «Línea N»; en escritorio, una fila.
 * - Errores por campo y línea con texto (`error-summary` con enlaces), no solo con color.
 * - La devolución muestra una fila por cada línea de la compra con lo que queda por devolver.
 */

export const DOCUMENT_ROWS_STEP = 10;
export const DOCUMENT_MAX_ROWS = 50;

export const DOCUMENT_KINDS = Object.freeze(['saldo-inicial', 'compra', 'ajuste'] as const);
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const isDocumentKind = (value: unknown): value is DocumentKind => typeof value === 'string' && (DOCUMENT_KINDS as readonly string[]).includes(value);
export const newDocumentPath = (kind: DocumentKind): string => `${DOCUMENTS_PATH}/nuevo/${kind}`;
export const returnPath = (purchaseId: number): string => `${documentPath(purchaseId)}/devolver`;

export const LINE_PARTS = Object.freeze(['item', 'direction', 'quantity', 'unit', 'unitCost', 'amount'] as const);
export type LinePart = (typeof LINE_PARTS)[number];
export const lineField = (slot: number, part: LinePart | 'source' | 'label'): string => `lines.${slot}.${part}`;

interface KindConfig {
  title: string;
  parts: readonly LinePart[];
  intro: string;
  button: string;
}
export const KIND_CONFIG: Readonly<Record<DocumentKind, KindConfig>> = Object.freeze({
  'saldo-inicial': {
    title: 'Saldo inicial',
    parts: ['item', 'quantity', 'unit', 'unitCost'],
    intro: 'Existencias con que arranca el inventario. Solo artículos sin movimientos; el costo unitario se precarga con el costo de referencia, si lo tiene, al añadir filas o revisar el formulario.',
    button: 'Registrar saldo inicial',
  },
  compra: {
    title: 'Nueva compra',
    parts: ['item', 'quantity', 'unit', 'amount'],
    intro: 'Escribe lo que pagaste por cada línea (con IVA): el costo por unidad base se calcula al registrar. El mismo artículo puede ir en varias líneas.',
    button: 'Registrar compra',
  },
  ajuste: {
    title: 'Ajuste',
    parts: ['item', 'direction', 'quantity', 'unit', 'unitCost'],
    intro: 'Una salida sale al costo promedio (CPP). Una entrada entra al CPP vigente: escribe el costo unitario solo si el artículo todavía no tiene CPP.',
    button: 'Registrar ajuste',
  },
});

const PART_LABELS: Readonly<Record<LinePart, string>> = Object.freeze({
  item: 'Artículo',
  direction: 'Movimiento',
  quantity: 'Cantidad',
  unit: 'Unidad',
  unitCost: 'Costo unitario por unidad base',
  amount: 'Importe pagado (con IVA)',
});
const HEADER_LABELS: Readonly<Record<string, string>> = Object.freeze({ occurredOn: 'Fecha del hecho', supplierId: 'Proveedor', reference: 'Folio', reason: 'Motivo', note: 'Nota', lines: 'Líneas' });
/** Columnas de la fila en escritorio (clases literales para que Tailwind las genere). */
const GRID_COLUMNS: Readonly<Record<number, string>> = Object.freeze({ 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' });
const ITEMS_LIST_ID = 'kardex-items';
const UNITS_LIST_ID = 'kardex-units';

export type DocumentLineValues = Record<LinePart, string>;
const EMPTY_LINE: DocumentLineValues = Object.freeze({ item: '', direction: '', quantity: '', unit: '', unitCost: '', amount: '' });

export interface DocumentFormValues {
  occurredOn: string;
  note: string;
  supplierId: string;
  reference: string;
  reason: string;
  lines: DocumentLineValues[];
}

/** Una fila está vacía si no tiene nada escrito (el movimiento por defecto no cuenta). */
export const isEmptyLine = (line: DocumentLineValues): boolean => (['item', 'quantity', 'unit', 'unitCost', 'amount'] as const).every((part) => line[part].trim() === '');

export function readDocumentForm(fields: Map<string, string>): DocumentFormValues {
  const lines = Array.from({ length: DOCUMENT_MAX_ROWS }, (_, slot) => {
    const line = { ...EMPTY_LINE };
    for (const part of LINE_PARTS) line[part] = fields.get(lineField(slot, part)) ?? '';
    return line;
  });
  return {
    occurredOn: fields.get('occurredOn') ?? '',
    note: fields.get('note') ?? '',
    supplierId: fields.get('supplierId') ?? '',
    reference: fields.get('reference') ?? '',
    reason: fields.get('reason') ?? '',
    lines,
  };
}

export const emptyDocumentForm = (today: string): DocumentFormValues => ({ occurredOn: today, note: '', supplierId: '', reference: '', reason: '', lines: [] });

/** Filas que se muestran: las pedidas y las necesarias para lo escrito, en bloques de 10. */
export function visibleRows(values: DocumentFormValues, rows: number): number {
  const last = values.lines.reduce((acc, line, slot) => (isEmptyLine(line) ? acc : slot), -1);
  const needed = Math.ceil((last + 1) / DOCUMENT_ROWS_STEP) * DOCUMENT_ROWS_STEP;
  return Math.min(DOCUMENT_MAX_ROWS, Math.max(DOCUMENT_ROWS_STEP, rows, needed));
}

/** Fecha `AAAA-MM-DD` desplazada `days` días (para el mínimo de la fecha del hecho: hoy − 31). */
export function shiftDay(day: string, days: number): string {
  const time = Date.parse(`${day}T12:00:00Z`);
  return Number.isNaN(time) ? '' : new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

interface DocumentViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  errorSummary: (errors: Record<string, string>, fields: readonly { name: string; label: string }[], heading?: { title: string; paragraphs?: string[] }) => SafeHtml | null;
  fieldId: (name: string) => string;
}

export interface DocumentFormView {
  context: PageContext | null;
  csrfToken: string;
  kind: DocumentKind;
  values: DocumentFormValues;
  rows: number;
  requestId: string;
  /** null: la API no respondió (se pinta lo escrito sin las listas). */
  options: KardexOptionsResponse | null;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
  /** Fila nueva que recibe el foco tras «Añadir 10 filas» (REQ-F-054, RF-3). */
  focusSlot?: number | undefined;
  /** «Hoy» enviado por el formulario: mantiene `min` y `max` de la fecha si la API no responde (DEF-008). */
  today?: string;
}

export interface ReturnFormView {
  context: PageContext | null;
  csrfToken: string;
  purchase: KardexDocumentDetailResponse | null;
  purchaseId: number;
  occurredOn: string;
  note: string;
  /** Cantidad escrita por id de la línea de compra. */
  quantities: ReadonlyMap<number, string>;
  today: string;
  requestId: string;
  /** Sin la compra (API caída): las filas enviadas, con su id de compra y su etiqueta (DEF-009). */
  fallbackRows?: { slot: number; source: number; label: string }[];
  errors?: Record<string, string>;
  notices?: SafeHtml[];
}

export function createDocumentViews({ render, join, attrs, page, errorSummary, fieldId }: DocumentViewHelpers) {
  const none = () => join([]);
  const selected = (on: boolean) => (on ? render('partials/selected') : none());
  const option = (value: string, label: string, current: string) => render('partials/option', { value, label, selected: selected(value === current) });
  const documentPage = (title: string, context: PageContext | null, body: SafeHtml) => page({ title, ...(context ? { context } : {}), section: 'inventory-documents', body });

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
  function input(name: string, label: string, value: string, error: string | undefined, { help = null, optional = false, span = '', extra = [] }: { help?: string | null; optional?: boolean; span?: string; extra?: [string, string | number | boolean | undefined][] } = {}): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-input', { ...field, label, optional: optional ? ' (opcional)' : '', span, value, attrs: attrs([...extra, ...field.aria]) });
  }
  function select(name: string, label: string, options: SafeHtml[], error: string | undefined, help: string | null = null): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-select', { ...field, label, span: '', attrs: attrs(field.aria), options: join(options) });
  }
  function textarea(name: string, label: string, value: string, error: string | undefined, help: string, optional: boolean): SafeHtml {
    const field = describe(name, help, error);
    return render('partials/field-textarea', { ...field, label, optional: optional ? ' (opcional)' : '', value, attrs: attrs([['maxlength', 400], ...field.aria]) });
  }
  const dateInput = (value: string, error: string | undefined, today: string) =>
    input('occurredOn', HEADER_LABELS.occurredOn ?? 'Fecha del hecho', value, error, {
      help: today ? `Hoy o hasta 31 días atrás (desde el ${shiftDay(today, -31)}); nunca una fecha futura.` : 'Hoy o hasta 31 días atrás; nunca una fecha futura.',
      extra: [['type', 'date'], ['required', true], ...(today ? ([['max', today], ['min', shiftDay(today, -31)]] as [string, string][]) : [])],
    });

  /** Campos con error y su ancla, para el resumen (también los de las líneas). */
  function summaryFields(errors: Record<string, string>): { name: string; label: string }[] {
    return Object.keys(errors).flatMap((name) => {
      if (name in HEADER_LABELS) return [{ name, label: HEADER_LABELS[name] ?? name }];
      const line = /^lines\.(\d+)(?:\.(\w+))?$/.exec(name);
      if (!line) return [];
      const part = line[2] as LinePart | undefined;
      return [{ name, label: `Línea ${Number(line[1]) + 1}${part && part in PART_LABELS ? `, ${(PART_LABELS[part] ?? '').toLowerCase()}` : ''}` }];
    });
  }

  function lineFieldset(kind: DocumentKind, slot: number, line: DocumentLineValues, errors: Record<string, string>, focus: boolean): SafeHtml {
    const error = (part: LinePart) => errors[lineField(slot, part)];
    const rowError = errors[`lines.${slot}`];
    const fields = KIND_CONFIG[kind].parts.map((part) => {
      const name = lineField(slot, part);
      switch (part) {
        case 'item':
          return input(name, PART_LABELS.item, line.item, error('item') ?? rowError, { span: 'sm:col-span-2 lg:col-span-1', extra: [['list', ITEMS_LIST_ID], ['maxlength', 80], ['autocomplete', 'off'], ['autofocus', focus]] });
        case 'direction':
          return select(name, PART_LABELS.direction, [option('salida', 'Salida', line.direction || 'salida'), option('entrada', 'Entrada', line.direction || 'salida')], error('direction'));
        case 'quantity':
          return input(name, PART_LABELS.quantity, line.quantity, error('quantity'), { extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20]] });
        case 'unit':
          return input(name, PART_LABELS.unit, line.unit, error('unit'), { extra: [['list', UNITS_LIST_ID], ['maxlength', 30], ['autocomplete', 'off']] });
        case 'unitCost':
          return input(name, PART_LABELS.unitCost, line.unitCost, error('unitCost'), { optional: kind === 'ajuste', extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20], ['placeholder', '0.0000']] });
        case 'amount':
          return input(name, PART_LABELS.amount, line.amount, error('amount'), { extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20], ['placeholder', '0.00']] });
      }
    });
    return render('partials/kardex-line', { id: fieldId(`lines.${slot}`), legend: `Línea ${slot + 1}`, columns: GRID_COLUMNS[KIND_CONFIG[kind].parts.length] ?? '', fields: join(fields) });
  }

  return {
    inventoryDocumentForm({ context, csrfToken, kind, values, rows, requestId, options, errors = {}, notices = [], focusSlot, today: sentToday = '' }: DocumentFormView): SafeHtml {
      const config = KIND_CONFIG[kind];
      const today = options?.today ?? sentToday;
      const summary = errorSummary(errors, summaryFields(errors));
      const count = visibleRows(values, rows);
      const header: SafeHtml[] = [dateInput(values.occurredOn, errors.occurredOn, today)];
      if (kind === 'compra') {
        const suppliers = options?.suppliers ?? [];
        header.push(
          select('supplierId', 'Proveedor', [option('', 'Sin proveedor', values.supplierId), ...suppliers.map((supplier) => option(String(supplier.id), supplier.name, values.supplierId))], errors.supplierId, 'Solo proveedores activos.'),
          input('reference', 'Folio', values.reference, errors.reference, { optional: true, help: 'Folio de la factura o nota; máximo 40 caracteres.', extra: [['maxlength', 40], ['autocomplete', 'off']] }),
          render('partials/inventory-readonly', { label: 'Criterio de costo', value: 'Con IVA: el importe pagado' }),
        );
      }
      if (kind === 'ajuste') {
        header.push(select('reason', 'Motivo', [option('', 'Elige el motivo', values.reason), option('error_captura', 'Error de captura', values.reason), option('otro', 'Otro (explícalo en la nota)', values.reason)], errors.reason));
      }
      header.push(textarea('note', 'Nota', values.note, errors.note, kind === 'ajuste' ? 'Obligatoria con el motivo «Otro». Máximo 400 caracteres.' : 'Máximo 400 caracteres.', true));
      const items = (options?.items ?? []).filter((item) => kind !== 'saldo-inicial' || item.initialBalanceAllowed);
      const unitNames = [...new Set([...INVENTORY_UNITS, ...items.flatMap((item) => item.units.map((unit) => unit.name))])];
      const lines = Array.from({ length: count }, (_, slot) => lineFieldset(kind, slot, values.lines[slot] ?? EMPTY_LINE, errors, slot === focusSlot));
      return documentPage(config.title, context, render('pages/inventory-document-form', {
        title: config.title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        action: newDocumentPath(kind),
        csrfToken,
        hidden: join(Object.entries({ requestId, rows: String(count), today }).map(([name, value]) => render('partials/hidden', { name, value }))),
        header: join(header),
        linesIntro: `${config.intro} De 1 a ${DOCUMENT_MAX_ROWS} líneas; las filas vacías no se registran. Cantidades con punto decimal (hasta 3 decimales), importes con hasta 2 y costos unitarios con hasta 4.`,
        linesError: errors.lines ? render('partials/field-error', { id: 'f-lines-error', message: errors.lines }) : none(),
        lines: join(lines),
        datalists: join([
          render('partials/recipe-datalist', {
            id: ITEMS_LIST_ID,
            options: join(
              items.map((item) =>
                render('partials/recipe-datalist-option', {
                  value: item.name,
                  label: `${TYPE_LABELS[item.type]} · ${item.baseUnit ?? '—'}${item.avgCost ? ` · CPP ${unitCost(item.avgCost)}` : item.referenceCost ? ` · referencia ${unitCost(item.referenceCost)}` : ''}`,
                }),
              ),
            ),
          }),
          render('partials/recipe-datalist', { id: UNITS_LIST_ID, options: join(unitNames.map((unit) => render('partials/recipe-datalist-option', { value: unit, label: '' }))) }),
        ]),
        buttons: join([render('partials/submit', { value: 'save', label: config.button }), count < DOCUMENT_MAX_ROWS ? render('partials/recipe-rows-button') : none()]),
      }));
    },

    inventoryReturnForm({ context, csrfToken, purchase, purchaseId, occurredOn, note, quantities, today, requestId, fallbackRows = [], errors = {}, notices = [] }: ReturnFormView): SafeHtml {
      const title = `Devolver mercancía de la compra #${purchaseId}`;
      const lines = purchase?.lines ?? [];
      const summary = errorSummary(
        errors,
        Object.keys(errors).flatMap((name) => {
          if (name in HEADER_LABELS) return [{ name, label: HEADER_LABELS[name] ?? name }];
          const line = /^lines\.(\d+)/.exec(name);
          return line ? [{ name: lineField(Number(line[1]), 'quantity'), label: `Línea ${Number(line[1]) + 1}, cantidad` }] : [];
        }),
      );
      const errorOf = (slot: number) =>
        // OBS-15: los errores del artículo o de la línea de compra (`lines.N.item`, `lines.N.sourceMovement`) van en la cantidad de su fila.
        errors[lineField(slot, 'quantity')] ?? errors[lineField(slot, 'item')] ?? errors[`lines.${slot}.sourceMovement`] ?? errors[`lines.${slot}`];
      const quantityInput = (slot: number, source: number, unit: string | null) =>
        input(lineField(slot, 'quantity'), `Cantidad a devolver (${unit ?? 'unidad base'})`, quantities.get(source) ?? '', errorOf(slot), { optional: true, extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20]] });
      // Cada fila lleva su id de compra y su etiqueta ocultos: si la API no responde, se vuelve a pintar sin leer la compra (DEF-009).
      const hiddenRow = (slot: number, source: number, label: string) =>
        join([render('partials/hidden', { name: lineField(slot, 'source'), value: String(source) }), render('partials/hidden', { name: lineField(slot, 'label'), value: label })]);
      const rows =
        lines.length > 0
          ? lines.map((line, slot) => {
              const label = `${line.itemName} (${line.baseUnit ?? 'unidad base'})`;
              return render('partials/kardex-line', {
                id: fieldId(`lines.${slot}`),
                legend: `Línea ${slot + 1}: ${line.itemName}`,
                columns: GRID_COLUMNS[3] ?? '',
                fields: join([
                  hiddenRow(slot, line.id, label),
                  render('partials/inventory-readonly', { label: 'Comprado', value: `${quantityWithUnit(line.quantity, line.baseUnit)} a ${line.unitCost === null ? 'sin costo' : `${unitCost(line.unitCost)} / ${line.baseUnit ?? ''}`}` }),
                  render('partials/inventory-readonly', { label: 'Queda por devolver', value: line.returnable === null ? '—' : quantityWithUnit(line.returnable, line.baseUnit) }),
                  quantityInput(slot, line.id, line.baseUnit),
                ]),
              });
            })
          : fallbackRows.map(({ slot, source, label }) =>
              render('partials/kardex-line', {
                id: fieldId(`lines.${slot}`),
                legend: `Línea ${slot + 1}: ${label}`,
                columns: GRID_COLUMNS[3] ?? '',
                fields: join([hiddenRow(slot, source, label), quantityInput(slot, source, null)]),
              }),
            );
      return documentPage(title, context, render('pages/inventory-document-form', {
        title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        action: returnPath(purchaseId),
        csrfToken,
        hidden: join([render('partials/hidden', { name: 'requestId', value: requestId }), render('partials/hidden', { name: 'today', value: today })]),
        header: join([dateInput(occurredOn, errors.occurredOn, today), textarea('note', 'Nota', note, errors.note, 'Máximo 400 caracteres.', true)]),
        linesIntro: 'Escribe solo las cantidades que devuelves, en la unidad base del artículo. Cada línea sale al costo de esta compra, como máximo lo que queda por devolver.',
        linesError: errors.lines ? render('partials/field-error', { id: 'f-lines-error', message: errors.lines }) : none(),
        lines: rows.length > 0 ? join(rows) : render('partials/empty', { text: 'No se pudieron cargar las líneas de la compra. Inténtalo de nuevo en unos minutos; lo que escribiste en la cabecera sigue aquí.' }),
        datalists: none(),
        buttons: rows.length > 0 ? render('partials/submit', { value: 'save', label: 'Registrar devolución' }) : none(),
      }));
    },
  };
}

export type DocumentViews = ReturnType<typeof createDocumentViews>;
