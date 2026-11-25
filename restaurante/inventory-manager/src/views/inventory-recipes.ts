import {
  INVENTORY_RECIPE_ITEM_TYPES,
  INVENTORY_UNITS,
  type CostedRecipeLine,
  type CurrentRecipe,
  type InventoryCostSource,
  type InventoryItemType,
  type RecipeDetailResponse,
  type RecipeIngredientsResponse,
  type RecipeItemRef,
  type RecipeLineDto,
  type RecipeListResponse,
  type RecipeVersionResponse,
  type RecipeVersionSummary,
} from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { NoticeOptions, PageContext, PageOptions } from './index.ts';
import { TYPE_LABELS, itemPath, trimDecimal } from './inventory.ts';

/**
 * Recetas del inventario en el admin (REQ-F-050, T2: RF-1 a RF-9 y RF-13), con el sistema visual del
 * admin y las decisiones de diseño aprobadas (H-1 a H-5): lista con filtros, receta del artículo con su
 * costo teórico, editor de versión sin JavaScript (un `fieldset` por línea: tarjeta en móvil y fila
 * compacta en escritorio; 10 filas por bloque hasta 40; un único `datalist` de ingredientes), historial en
 * solo lectura y confirmación de cierre. Los costos llegan con 4 decimales y se muestran con 2 (RF-6).
 * Solo para administradores y gerentes (la API es la autoridad).
 */

export const RECIPES_PATH = '/inventario/recetas';
export const recipePath = (itemId: number): string => `/inventario/articulos/${itemId}/receta`;
export const recipeEditPath = (itemId: number): string => `${recipePath(itemId)}/nueva`;
export const recipeClosePath = (itemId: number): string => `${recipePath(itemId)}/cerrar`;
export const recipeVersionPath = (versionId: number): string => `${RECIPES_PATH}/versiones/${versionId}`;

/** Tipos que llevan receta (RN-T2-2). */
export const RECIPE_TYPES: readonly InventoryItemType[] = INVENTORY_RECIPE_ITEM_TYPES;
/** Filas del editor: bloques de 10 hasta el máximo de core (40 líneas). */
export const RECIPE_ROWS_STEP = 10;
export const RECIPE_MAX_ROWS = 40;
export const RECIPE_LINE_PARTS = Object.freeze(['ingredient', 'quantity', 'unit', 'wastePercent', 'note'] as const);
export type RecipeLinePart = (typeof RECIPE_LINE_PARTS)[number];
export const recipeLineField = (slot: number, part: RecipeLinePart): string => `lines.${slot}.${part}`;

const PART_LABELS: Readonly<Record<RecipeLinePart, string>> = Object.freeze({ ingredient: 'ingrediente', quantity: 'cantidad neta', unit: 'unidad', wastePercent: 'merma', note: 'nota' });
const SOURCE_LABELS: Readonly<Record<InventoryCostSource, string>> = Object.freeze({ cpp: 'CPP', referencia: 'Referencia', receta: 'Receta', sin_costo: 'Sin costo' });
const INGREDIENTS_LIST_ID = 'recipe-ingredients';
const UNITS_LIST_ID = 'recipe-units';
const HELP_ID = 'recipe-help-text';

export interface RecipeLineValues {
  ingredient: string;
  quantity: string;
  unit: string;
  wastePercent: string;
  note: string;
}

export interface RecipeFormValues {
  yieldQuantity: string;
  note: string;
  /** Las 40 filas posibles, en su posición del formulario (las vacías, con ''). */
  lines: RecipeLineValues[];
}

const EMPTY_LINE: RecipeLineValues = Object.freeze({ ingredient: '', quantity: '', unit: '', wastePercent: '', note: '' });
export const isEmptyLine = (line: RecipeLineValues): boolean => RECIPE_LINE_PARTS.every((part) => line[part].trim() === '');

export function readRecipeForm(fields: Map<string, string>): RecipeFormValues {
  const lines = Array.from({ length: RECIPE_MAX_ROWS }, (_, slot) => {
    const line = { ...EMPTY_LINE };
    for (const part of RECIPE_LINE_PARTS) line[part] = fields.get(recipeLineField(slot, part)) ?? '';
    return line;
  });
  return { yieldQuantity: fields.get('yieldQuantity') ?? '', note: fields.get('note') ?? '', lines };
}

/** Valores del editor a partir de la vigente (o vacíos si no hay receta). */
export function recipeFormValues(current: CurrentRecipe | null): RecipeFormValues {
  const lines: RecipeLineValues[] = (current?.version.lines ?? []).map((line) => ({
    ingredient: line.ingredient.name,
    quantity: trimDecimal(line.quantity),
    unit: line.unit,
    wastePercent: trimDecimal(line.wastePercent),
    note: line.note ?? '',
  }));
  return { yieldQuantity: current ? trimDecimal(current.version.yieldQuantity) : '', note: current?.version.note ?? '', lines };
}

/** Filas que se muestran: las pedidas (`rows`) y las necesarias para lo escrito, en bloques de 10. */
export function visibleRows(values: RecipeFormValues, rows: number): number {
  const last = values.lines.reduce((acc, line, slot) => (isEmptyLine(line) ? acc : slot), -1);
  const needed = Math.ceil((last + 1) / RECIPE_ROWS_STEP) * RECIPE_ROWS_STEP;
  return Math.min(RECIPE_MAX_ROWS, Math.max(RECIPE_ROWS_STEP, rows, needed));
}

/** «166.6667» -> «$166.67» (mitad hacia arriba, como core; PV-13). */
export function money(text: string): string {
  const [integer = '0', fraction = ''] = text.split('.');
  const scaled = BigInt(`${integer}${fraction.padEnd(4, '0').slice(0, 4)}`);
  const cents = (scaled + 50n) / 100n;
  return `$${(cents / 100n).toLocaleString('es-MX')}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** Datos del artículo que muestra el editor (sin la API, solo lo que se conoce). */
export interface RecipeEditorItem {
  id: number;
  name: string;
  baseUnit: string | null;
}

export interface RecipeEditorView {
  /** null cuando la API no responde y no se pudo comprobar la sesión: la página va sin cabecera. */
  context: PageContext | null;
  csrfToken: string;
  item: RecipeEditorItem;
  values: RecipeFormValues;
  rows: number;
  hidden: Record<string, string>;
  /** null: la API no dio los ingredientes (se conserva lo escrito sin sugerencias). */
  ingredients: RecipeIngredientsResponse['ingredients'] | null;
  /** Vigente con su costo, para mostrar la bruta y el costo de las líneas que no cambiaron. */
  current: CurrentRecipe | null;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
  /** Tras un 409: "Guardar mis cambios sobre la versión vigente" (H-5). */
  conflict?: boolean;
}

interface RecipeViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  errorSummary: (errors: Record<string, string>, fields: readonly { name: string; label: string }[]) => SafeHtml | null;
  fieldId: (name: string) => string;
  displayDate: (iso: string | null) => string;
}

export function createRecipeViews({ render, join, attrs, page, notice, errorSummary, fieldId, displayDate }: RecipeViewHelpers) {
  const none = () => join([]);
  const selected = (on: boolean) => (on ? render('partials/selected') : none());
  const option = (value: string, label: string, current: string) => render('partials/option', { value, label, selected: selected(value === current) });
  const recipePage = (title: string, context: PageContext | null, body: SafeHtml) => page({ title, ...(context ? { context } : {}), section: 'inventory-recipes', body });

  function describe(name: string, help: string | null, error: string | undefined, extraDescribedBy: string[] = []) {
    const id = fieldId(name);
    const describedBy = [...extraDescribedBy, help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
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

  function input(name: string, label: string, value: string, error: string | undefined, { help = null, optional = false, extra = [], span = '', describedBy = [] }: { help?: string | null; optional?: boolean; extra?: [string, string | number | boolean | undefined][]; span?: string; describedBy?: string[] } = {}): SafeHtml {
    const field = describe(name, help, error, describedBy);
    return render('partials/field-input', { ...field, label, optional: optional ? ' (opcional)' : '', span, value, attrs: attrs([...extra, ...field.aria]) });
  }

  const quantityText = (quantity: string, unit: string | null) => `${trimDecimal(quantity)}${unit ? ` ${unit}` : ''}`;
  const unitCostText = (cost: string | null, baseUnit: string | null) => (cost === null ? 'Sin costo' : `${money(cost)}${baseUnit ? ` / ${baseUnit}` : ''}`);
  const flag = (text: string, modifier: string) => render('partials/recipe-flag', { text, modifier, toneClass: modifier === 'inactive' ? 'text-error' : 'text-maiz' });
  const cell = (text: string, align = '') => render('partials/recipe-cell', { text, align });
  const cellHtml = (content: SafeHtml, align = '') => render('partials/recipe-cell-html', { content, align });
  const head = (labels: readonly (string | [string, string])[]) => join(labels.map((entry) => (typeof entry === 'string' ? render('partials/recipe-th', { label: entry, align: '' }) : render('partials/recipe-th', { label: entry[0], align: entry[1] }))));
  const table = (captionId: string, caption: string, labels: readonly (string | [string, string])[], rows: SafeHtml[]) =>
    render('partials/recipe-table', { captionId, caption, head: head(labels), rows: join(rows) });
  const ingredientName = (ref: RecipeItemRef) => render('partials/recipe-ingredient', { name: ref.name, flag: ref.active ? none() : flag('inactivo', 'inactive') });

  function versionDates(version: RecipeVersionSummary): string {
    return version.validTo === null ? `Vigente desde el ${displayDate(version.validFrom)}` : `Del ${displayDate(version.validFrom)} al ${displayDate(version.validTo)}`;
  }

  /** Líneas guardadas (sin costo: historial; PT-4) o con su costo (vigente; RF-6). */
  function linesTable(captionId: string, caption: string, lines: readonly (RecipeLineDto | CostedRecipeLine)[], withCost: boolean): SafeHtml {
    const labels: (string | [string, string])[] = ['Ingrediente', ['Neta', 'text-right'], ['Merma', 'text-right'], ['Bruta', 'text-right'], ...(withCost ? [['Costo', 'text-right'] as [string, string], 'Origen'] : []), 'Nota'];
    const rows = lines.map((line) => {
      const costed = withCost && 'source' in line ? line : null;
      return render('partials/recipe-row', {
        cells: join([
          render('partials/recipe-cell-head', { content: ingredientName(line.ingredient) }),
          cell(quantityText(line.quantity, line.unit), 'text-right tabular-nums'),
          cell(`${trimDecimal(line.wastePercent)} %`, 'text-right tabular-nums'),
          cell(quantityText(line.grossBaseQuantity, line.ingredient.baseUnit), 'text-right tabular-nums'),
          ...(costed
            ? [
                costed.cost === null ? cellHtml(flag('Sin costo', 'missing'), 'text-right') : cell(money(costed.cost), 'text-right tabular-nums'),
                cell(SOURCE_LABELS[costed.source]),
              ]
            : []),
          cell(line.note ?? '—'),
        ]),
      });
    });
    return table(captionId, caption, labels, rows);
  }

  function historyList(versions: readonly RecipeVersionSummary[]): SafeHtml {
    if (versions.length === 0) return render('partials/empty', { text: 'Todavía no tiene versiones.' });
    return render('partials/inventory-history', {
      items: join(
        versions.map((version) =>
          render('partials/recipe-history-entry', {
            href: recipeVersionPath(version.id),
            label: `Versión ${version.number}`,
            current: version.validTo === null ? render('partials/recipe-current-mark') : none(),
            detail: `${versionDates(version)} · ${version.createdBy} · ${version.lineCount === 1 ? '1 línea' : `${version.lineCount} líneas`}`,
          }),
        ),
      ),
    });
  }

  /** Error de cada campo del editor con su ancla (las líneas, por fila: «Línea 3, cantidad neta»). */
  function summaryFields(errors: Record<string, string>): { name: string; label: string }[] {
    return Object.keys(errors).flatMap((name) => {
      if (name === 'yieldQuantity') return [{ name, label: 'Rendimiento' }];
      if (name === 'note') return [{ name, label: 'Nota de la versión' }];
      if (name === 'lines') return [{ name, label: 'Ingredientes' }];
      const line = /^lines\.(\d+)(?:\.(\w+))?$/.exec(name);
      if (!line) return [];
      const part = line[2] as RecipeLinePart | undefined;
      const label = `Línea ${Number(line[1]) + 1}${part && part in PART_LABELS ? `, ${PART_LABELS[part]}` : ''}`;
      return [{ name, label }];
    });
  }

  /** Bruta y costo guardados de una línea que no cambió respecto de la vigente (la API los calcula al guardar). */
  function savedLineText(line: RecipeLineValues, current: CurrentRecipe | null): string | null {
    const match = current?.version.lines.find(
      (saved) =>
        saved.ingredient.name === line.ingredient.trim() &&
        trimDecimal(saved.quantity) === line.quantity.trim() &&
        saved.unit === line.unit.trim() &&
        trimDecimal(saved.wastePercent) === (line.wastePercent.trim() === '' ? '0' : line.wastePercent.trim()),
    );
    if (!match) return null;
    return `Como en la versión vigente: bruta ${quantityText(match.grossBaseQuantity, match.ingredient.baseUnit)}; ${match.cost === null ? 'sin costo' : `costo ${money(match.cost)}`}.`;
  }

  function lineFieldset(slot: number, line: RecipeLineValues, errors: Record<string, string>, current: CurrentRecipe | null): SafeHtml {
    const name = (part: RecipeLinePart) => recipeLineField(slot, part);
    const error = (part: RecipeLinePart) => errors[name(part)];
    const saved = isEmptyLine(line) ? null : savedLineText(line, current);
    const rowError = errors[`lines.${slot}`];
    return render('partials/recipe-line', {
      id: fieldId(`lines.${slot}`),
      legend: `Línea ${slot + 1}`,
      fields: join([
        input(name('ingredient'), 'Ingrediente', line.ingredient, error('ingredient') ?? rowError, { span: 'sm:col-span-2 lg:col-span-1', extra: [['list', INGREDIENTS_LIST_ID], ['maxlength', 80], ['autocomplete', 'off']] }),
        input(name('quantity'), 'Cantidad neta', line.quantity, error('quantity'), { describedBy: [HELP_ID], extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20]] }),
        input(name('unit'), 'Unidad', line.unit, error('unit'), { extra: [['list', UNITS_LIST_ID], ['maxlength', 30], ['autocomplete', 'off']] }),
        input(name('wastePercent'), 'Merma %', line.wastePercent, error('wastePercent'), { extra: [['placeholder', '0'], ['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 6]] }),
        input(name('note'), 'Nota', line.note, error('note'), { optional: true, span: 'sm:col-span-2 lg:col-span-1', extra: [['maxlength', 200], ['autocomplete', 'off']] }),
      ]),
      saved: saved ? render('partials/recipe-line-saved', { text: saved }) : none(),
    });
  }

  return {
    inventoryRecipes({ context, filter, list, errors = {}, notices = [] }: { context: PageContext; filter: { tipo: string; q: string }; list: RecipeListResponse | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const fieldsNotice = Object.keys(errors).length > 0 ? [notice({ tone: 'error', title: 'Revisa los filtros.', paragraphs: Object.values(errors) })] : [];
      const typeField = describe('tipo', null, errors.tipo);
      const filters = join([
        render('partials/field-select', { ...typeField, label: 'Tipo', span: '', attrs: attrs(typeField.aria), options: join([option('', 'Todos', filter.tipo), ...RECIPE_TYPES.map((type) => option(type, TYPE_LABELS[type], filter.tipo))]) }),
        input('q', 'Buscar por artículo', filter.q, errors.q, { extra: [['type', 'search'], ['maxlength', 80], ['autocomplete', 'off']] }),
      ]);
      let results: SafeHtml = none();
      let pagination: SafeHtml = none();
      let summary = '';
      if (list) {
        const { recipes, page: info } = list;
        const pages = Math.max(1, Math.ceil(info.total / info.size));
        summary = info.total === 1 ? '1 receta vigente.' : `${info.total} recetas vigentes.`;
        results =
          recipes.length > 0
            ? table(
                'recipe-list-caption',
                'Recetas vigentes con su costo teórico por unidad',
                ['Artículo', 'Tipo', ['Rendimiento', 'text-right'], ['Costo por unidad', 'text-right'], 'Vigente desde', 'Avisos'],
                recipes.map((entry) =>
                  render('partials/recipe-row', {
                    cells: join([
                      render('partials/recipe-cell-head', { content: render('partials/recipe-link', { href: recipePath(entry.item.id), text: entry.item.name }) }),
                      cell(TYPE_LABELS[entry.item.type]),
                      cell(quantityText(entry.yieldQuantity, entry.item.baseUnit), 'text-right tabular-nums'),
                      entry.unitCost === null
                        ? cellHtml(flag(entry.missingCount === 1 ? 'Sin costo (falta 1)' : `Sin costo (faltan ${entry.missingCount})`, 'missing'), 'text-right')
                        : cell(unitCostText(entry.unitCost, entry.item.baseUnit), 'text-right tabular-nums'),
                      cell(displayDate(entry.validFrom)),
                      entry.usesInactive ? cellHtml(flag('Usa artículos inactivos', 'inactive')) : cell('—'),
                    ]),
                  }),
                ),
              )
            : render('partials/empty', { text: 'No hay recetas vigentes que coincidan con los filtros. Cambia o quita alguno; para crear una receta, abre la ficha de un artículo Intermedio o Compuesto.' });
        if (pages > 1) {
          const query = (number: number) => {
            const params = new URLSearchParams(Object.entries({ tipo: filter.tipo, q: filter.q }).filter(([, value]) => value !== ''));
            params.set('pagina', String(number));
            return `${RECIPES_PATH}?${params.toString()}`;
          };
          const link = (number: number, label: string) => render('partials/inventory-page-link', { href: query(number), label });
          pagination = render('partials/inventory-pagination', {
            text: `Página ${info.number} de ${pages}`,
            links: join([...(info.number > 1 ? [link(info.number - 1, 'Anterior')] : []), ...(info.number < pages ? [link(info.number + 1, 'Siguiente')] : [])]),
          });
        }
      }
      return recipePage('Recetas del inventario', context, render('pages/inventory-recipes', { notices: join([...notices, ...fieldsNotice]), filters, summary, results, pagination }));
    },

    inventoryRecipe({ context, detail, notices = [] }: { context: PageContext; detail: RecipeDetailResponse; notices?: SafeHtml[] }): SafeHtml {
      const { item, current, versions } = detail;
      const actions: SafeHtml[] = [];
      if (item.active) actions.push(render('partials/action-link', { href: recipeEditPath(item.id), label: current ? 'Nueva versión' : 'Crear receta' }));
      if (current) actions.push(render('partials/action-link', { href: recipeClosePath(item.id), label: 'Cerrar receta' }));
      const warnings: SafeHtml[] = [];
      if (!item.active) warnings.push(notice({ tone: 'warning', title: 'El artículo está inactivo: su receta se puede consultar o cerrar, pero no admite versiones nuevas.' }));
      let content: SafeHtml;
      if (current) {
        const { version } = current;
        if (current.missing.length > 0) {
          warnings.push(
            notice({
              tone: 'warning',
              title: current.missing.length === 1 ? 'Sin costo: falta el costo de 1 ingrediente.' : `Sin costo: falta el costo de ${current.missing.length} ingredientes.`,
              paragraphs: current.missing.map((missing) => (missing.path.length > 1 ? `${missing.name} (en ${missing.path.join(' → ')})` : missing.name)),
              links: current.missing.map((missing) => ({ href: itemPath(missing.itemId), label: `Completar el costo de ${missing.name}` })),
            }),
          );
        }
        const inactive = version.lines.filter((line) => current.inactiveIngredientIds.includes(line.ingredient.id));
        if (inactive.length > 0) {
          warnings.push(
            notice({
              tone: 'warning',
              title: 'Esta versión usa ingredientes inactivos.',
              paragraphs: [`${inactive.map((line) => line.ingredient.name).join(', ')}. La versión no cambia; en una versión nueva tendrás que reemplazarlos o quitarlos.`],
            }),
          );
        }
        const baseUnit = item.baseUnit;
        content = join([
          render('partials/inventory-section', {
            id: 'vigente',
            title: `Versión ${version.number} vigente`,
            content: render('partials/recipe-summary', {
              rows: join([
                render('partials/inventory-data-row', { term: 'Vigencia', value: versionDates(version) }),
                render('partials/inventory-data-row', { term: 'Autor', value: version.createdBy }),
                render('partials/inventory-data-row', { term: 'Rendimiento', value: quantityText(version.yieldQuantity, baseUnit) }),
                render('partials/inventory-data-row', { term: 'Costo total', value: current.total === null ? 'Sin costo' : money(current.total) }),
                render('partials/inventory-data-row', { term: 'Costo por unidad', value: unitCostText(current.unitCost, baseUnit) }),
                render('partials/inventory-data-row', { term: 'Nota', value: version.note ?? '—' }),
              ]),
            }),
          }),
          render('partials/inventory-section', {
            id: 'ingredientes',
            title: 'Ingredientes',
            content: join([
              render('partials/inventory-paragraph', { text: 'Neta: lo aprovechable tras la merma, en la unidad capturada. Bruta: lo que hay que surtir, en la unidad base del ingrediente. Los costos se calculan al consultar, con IVA.' }),
              linesTable('recipe-lines-caption', `Ingredientes de la versión ${version.number}`, version.lines, true),
            ]),
          }),
        ]);
      } else {
        content = render('partials/inventory-section', { id: 'vigente', title: 'Sin receta vigente', content: render('partials/empty', { text: item.active ? 'Este artículo no tiene receta vigente. Usa «Crear receta» para capturarla.' : 'Este artículo no tiene receta vigente.' }) });
      }
      return recipePage(`Receta de ${item.name}`, context, render('pages/inventory-recipe', {
        itemHref: itemPath(item.id),
        name: item.name,
        type: TYPE_LABELS[item.type],
        actions: join(actions),
        notices: join([...notices, ...warnings]),
        content,
        history: render('partials/inventory-section', { id: 'versiones', title: 'Historial de versiones', content: historyList(versions) }),
      }));
    },

    inventoryRecipeVersion({ context, data }: { context: PageContext; data: RecipeVersionResponse }): SafeHtml {
      const { item, version } = data;
      return recipePage(`Versión ${version.number} de ${item.name}`, context, render('pages/inventory-recipe-version', {
        backHref: recipePath(item.id),
        name: item.name,
        number: version.number,
        notices: version.validTo === null ? none() : notice({ tone: 'info', title: 'Versión cerrada: es de solo lectura y se muestra sin costo.', paragraphs: ['El costo teórico se calcula solo para la versión vigente, con los costos de hoy.'] }),
        rows: join([
          render('partials/inventory-data-row', { term: 'Vigencia', value: versionDates(version) }),
          render('partials/inventory-data-row', { term: 'Autor', value: version.createdBy }),
          render('partials/inventory-data-row', { term: 'Rendimiento', value: quantityText(version.yieldQuantity, item.baseUnit) }),
          render('partials/inventory-data-row', { term: 'Nota', value: version.note ?? '—' }),
        ]),
        lines: linesTable('recipe-version-caption', `Ingredientes de la versión ${version.number}`, version.lines, false),
      }));
    },

    inventoryRecipeClose({ context, detail, notices = [] }: { context: PageContext; detail: RecipeDetailResponse; notices?: SafeHtml[] }): SafeHtml {
      const { item, current } = detail;
      return recipePage(`Cerrar la receta de ${item.name}`, context, render('pages/inventory-recipe-close', {
        backHref: recipePath(item.id),
        name: item.name,
        notices: join(notices),
        intro: current
          ? `La versión ${current.version.number} deja de estar vigente y queda en el historial, sin cambios. El artículo queda sin receta vigente: las recetas que lo usan lo costearán por su costo de referencia o quedarán «Sin costo».`
          : 'Este artículo ya no tiene receta vigente.',
        button: current
          ? render('partials/inventory-post-button', {
              action: recipeClosePath(item.id),
              csrfToken: context.csrfToken,
              version: '',
              label: 'Cerrar receta',
              name: item.name,
              buttonModifier: 'button--danger',
              buttonClass: 'border-error text-error hover:bg-error/10',
              busyText: 'Guardando…',
              hidden: render('partials/hidden', { name: 'baseVersionId', value: String(current.version.id) }),
            })
          : none(),
      }));
    },

    inventoryRecipeEditor({ context, csrfToken, item, values, rows, hidden, ingredients, current, errors = {}, notices = [], conflict = false }: RecipeEditorView): SafeHtml {
      const title = current ? `Nueva versión de la receta de ${item.name}` : `Receta de ${item.name}`;
      const summary = errorSummary(errors, summaryFields(errors));
      const count = visibleRows(values, rows);
      const lines = Array.from({ length: count }, (_, slot) => lineFieldset(slot, values.lines[slot] ?? EMPTY_LINE, errors, current));
      const unitNames = [...new Set([...INVENTORY_UNITS, ...(ingredients ?? []).flatMap((ingredient) => ingredient.units.map((unit) => unit.name))])];
      const header = join([
        input('yieldQuantity', `Rendimiento (en ${item.baseUnit ?? 'la unidad base'})`, values.yieldQuantity, errors.yieldQuantity, {
          help: 'Cuánto produce la receta, ya cocido o terminado, en la unidad base del artículo. Mayor que 0, con punto decimal y hasta 3 decimales.',
          extra: [['inputmode', 'decimal'], ['autocomplete', 'off'], ['maxlength', 20], ['required', true]],
        }),
        render('partials/inventory-readonly', { label: 'Unidad base', value: item.baseUnit ?? '—' }),
      ]);
      const noteField = describe('note', 'Máximo 400 caracteres.', errors.note);
      const linesError = errors.lines ? render('partials/field-error', { id: 'f-lines-error', message: errors.lines }) : none();
      return recipePage(title, context, render('pages/inventory-recipe-form', {
        backHref: recipePath(item.id),
        title,
        notices: join([...(summary ? [summary] : []), ...notices]),
        helpId: HELP_ID,
        action: recipePath(item.id),
        csrfToken,
        hidden: join(Object.entries({ ...hidden, rows: String(count) }).map(([name, value]) => render('partials/hidden', { name, value }))),
        header,
        note: render('partials/field-textarea', { ...noteField, label: 'Nota de la versión', optional: ' (opcional)', value: values.note, attrs: attrs([['maxlength', 400], ...noteField.aria]) }),
        linesIntro: `De 1 a ${RECIPE_MAX_ROWS} ingredientes, sin repetir. Las filas vacías no se guardan. Elige el ingrediente de la lista (escribe para buscar) y la unidad: del sistema o un empaque del ingrediente.`,
        linesError,
        lines: join(lines),
        datalists: join([
          ...(ingredients
            ? [render('partials/recipe-datalist', { id: INGREDIENTS_LIST_ID, options: join(ingredients.map((ingredient) => render('partials/recipe-datalist-option', { value: ingredient.name, label: `${TYPE_LABELS[ingredient.type]} · ${ingredient.baseUnit ?? '—'}` }))) })]
            : []),
          render('partials/recipe-datalist', { id: UNITS_LIST_ID, options: join(unitNames.map((unit) => render('partials/recipe-datalist-option', { value: unit, label: '' }))) }),
        ]),
        buttons: join([
          conflict ? render('partials/overwrite') : render('partials/submit', { value: 'save', label: 'Guardar versión' }),
          count < RECIPE_MAX_ROWS ? render('partials/recipe-rows-button') : none(),
        ]),
      }));
    },
  };
}
