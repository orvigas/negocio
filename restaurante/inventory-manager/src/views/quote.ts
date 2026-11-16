import type { PublicBusinessId, QuoteCalculationResponse, QuoteDefaultsResponse, QuoteField, QuotePackageResult } from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { NoticeOptions, PageContext, PageOptions } from './index.ts';

/**
 * Cotizador de taquizas (REQ-F-046, RF-1 a RF-8) en el admin nuevo: la pantalla solo pinta lo que
 * devuelve la API (campos con sus valores del JSON, resultados y matriz); no calcula ni valida nada.
 * Formulario GET sin JavaScript: `details`/`summary` nativos, abiertos solo si la sección tiene algún
 * campo modificado o con error. Cada marca ("modificado", "provisional") es texto, no solo color.
 */

export const QUOTE_BUSINESS: PublicBusinessId = 'birria';
export const QUOTE_PATH = `/${QUOTE_BUSINESS}/cotizador`;
/** Marcador del botón "Calcular": el formulario completo, que se reduce a la URL de diferencias. */
export const QUOTE_SUBMIT_FIELD = 'calcular';
/** Clave de las personas en la query y en los errores de la API. */
export const QUOTE_PERSONAS_FIELD = 'n';

export type QuoteDefaults = QuoteDefaultsResponse['quote'];
export type QuoteResult = QuoteCalculationResponse['result'];

export interface QuoteView {
  context: PageContext;
  quote: QuoteDefaults;
  /** Personas tal como llegaron (o vacío). */
  personas: string;
  /** Valores recibidos en la query (solo las diferencias); el resto, el del JSON. */
  values: Readonly<Record<string, string>>;
  /** Claves que difieren del JSON (marca "modificado"). */
  modified: ReadonlySet<string>;
  resetHref: string;
  errors?: Readonly<Record<string, string>>;
  result?: QuoteResult | null;
  notices?: SafeHtml[];
}

interface QuoteViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  businessNames: Readonly<Record<PublicBusinessId, string>>;
}

const TITLE = 'Cotizador de taquizas';
const PERSONAS_LABEL = 'Personas';

/** Id del campo en la página (el resumen de errores enlaza a él). Las claves son `[a-z0-9.-]`. */
export const quoteFieldId = (key: string): string => `q-${key}`;

const number = (value: number, digits: number, minimum = digits): string =>
  value.toLocaleString('es-MX', { minimumFractionDigits: minimum, maximumFractionDigits: digits });
const pesos = (value: number, digits = 2): string => `${value < 0 ? '-' : ''}$${number(Math.abs(value), digits)}`;
const percent = (value: number): string => `${number(value, 1)} %`;
/** "$19" o "$19.50": sin decimales si el importe es entero. */
const pesosShort = (value: number): string => pesos(value, Number.isInteger(value) ? 0 : 2);

/** "De 0 a 100000", "Mayor que 0 y hasta 1000", "De 0 a menos de 100" (sin separador de miles). */
function rangeText({ min, max, minExclusive, maxExclusive }: QuoteField): string {
  if (min === null || max === null) return '';
  const from = minExclusive ? `Mayor que ${String(min)} y` : `De ${String(min)}`;
  const to = maxExclusive ? `a menos de ${String(max)}` : minExclusive ? `hasta ${String(max)}` : `a ${String(max)}`;
  return `${from} ${to}`;
}

function helpOf(field: QuoteField): string {
  const byDefault = field.defaultValue === '' ? 'Por defecto: vacío.' : `Por defecto: ${field.defaultValue}.`;
  switch (field.kind) {
    case 'int':
      return `${byDefault} Número entero. ${rangeText(field)}.`;
    case 'intList':
      return `${byDefault} Números enteros de ${String(field.min)} a ${String(field.max)}, separados por coma (hasta 10). Vacío: sin filas extra.`;
    case 'optionalMoney':
      return `${byDefault} Vacío si no se vende a la carta. ${rangeText(field)}, hasta ${String(field.decimals)} decimales.`;
    default:
      return `${byDefault} ${rangeText(field)}, hasta ${String(field.decimals)} decimales.`;
  }
}

const labelOf = (field: QuoteField): string => (field.unit ? `${field.label} (${field.unit})` : field.label);

export function createQuoteViews({ render, join, attrs, page, notice, businessNames }: QuoteViewHelpers) {
  const empty = () => join([]);

  function marks(field: QuoteField, modified: boolean): SafeHtml {
    return join([
      ...(field.provisional ? [render('partials/quote-mark', { modifier: 'provisional', toneClass: 'border-adobo text-crema', text: 'provisional' })] : []),
      ...(modified ? [render('partials/quote-mark', { modifier: 'modified', toneClass: 'border-maiz text-maiz', text: 'modificado' })] : []),
    ]);
  }

  function describedBy(id: string, help: boolean, error: string | undefined): [string, string | undefined][] {
    const ids = [help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
    return [
      ['aria-invalid', error ? 'true' : undefined],
      ['aria-describedby', ids || undefined],
    ];
  }

  const errorOf = (id: string, error: string | undefined): SafeHtml => (error ? render('partials/field-error', { id: `${id}-error`, message: error }) : empty());

  function field(entry: QuoteField, value: string, modified: boolean, error: string | undefined): SafeHtml {
    const id = quoteFieldId(entry.key);
    if (entry.kind === 'active') {
      const radio = describedBy(id, false, error);
      return render('partials/quote-active', {
        id,
        name: entry.key,
        label: entry.label,
        marks: marks(entry, modified),
        onChecked: value === '1' ? render('partials/checked') : empty(),
        offChecked: value === '0' ? render('partials/checked') : empty(),
        attrs: attrs(radio),
        error: errorOf(id, error),
      });
    }
    return render('partials/quote-field', {
      id,
      name: entry.key,
      label: labelOf(entry),
      marks: marks(entry, modified),
      value,
      attrs: attrs([['inputmode', entry.kind === 'int' || entry.kind === 'intList' ? 'numeric' : 'decimal'], ...describedBy(id, true, error)]),
      help: render('partials/field-help', { id: `${id}-help`, text: helpOf(entry) }),
      error: errorOf(id, error),
    });
  }

  function sections(view: QuoteView, errors: Readonly<Record<string, string>>): SafeHtml {
    const { quote, values, modified } = view;
    return join(
      quote.sections.map((section) => {
        const fields = quote.fields.filter((entry) => entry.section === section.id);
        const changed = fields.filter((entry) => modified.has(entry.key)).length;
        const failed = fields.some((entry) => Object.hasOwn(errors, entry.key));
        const groups = [...new Set(fields.map((entry) => entry.group))];
        const state = [
          ...(changed > 0 ? [render('partials/quote-section-state', { toneClass: 'text-maiz', text: changed === 1 ? '1 modificado' : `${String(changed)} modificados` })] : []),
          ...(failed ? [render('partials/quote-section-state', { toneClass: 'text-error', text: 'con errores' })] : []),
        ];
        return render('partials/quote-section', {
          id: `seccion-${section.id}`,
          title: section.title,
          open: changed > 0 || failed ? render('partials/attr-flag', { name: 'open' }) : empty(),
          state: join(state),
          intro: section.id === 'paquetes' ? render('partials/section-intro', { text: 'Cantidad por persona 0: el ítem no va en el paquete. Al menos un paquete debe quedar activo.' }) : empty(),
          groups: join(
            groups.map((group) =>
              render('partials/quote-group', {
                legend: group,
                fields: join(
                  fields
                    .filter((entry) => entry.group === group)
                    .map((entry) => field(entry, Object.hasOwn(values, entry.key) ? (values[entry.key] as string) : entry.defaultValue, modified.has(entry.key), errors[entry.key])),
                ),
              }),
            ),
          ),
        });
      }),
    );
  }

  function cartaText(pkg: QuotePackageResult): string {
    if (pkg.cartaDiff === null) return pkg.cartaPrice === null ? 'Sin comparación: algún ítem no tiene precio a la carta.' : '—';
    const carta = `carta: ${pesosShort(pkg.cartaPrice ?? 0)}`;
    if (pkg.cartaDiff > 0) return `Ahorro de ${pesosShort(pkg.cartaDiff)} frente a la carta (${carta}).`;
    if (pkg.cartaDiff < 0) return `${pesosShort(-pkg.cartaDiff)} más caro que la carta (${carta}).`;
    return `Igual que la carta (${carta}).`;
  }

  function packageCard(pkg: QuotePackageResult, minPersonas: number): SafeHtml {
    const priced = pkg.price !== null;
    const maybe = (value: number | null, format: (value: number) => string) => (value === null ? 'Sin precio' : format(value));
    const rows: [string, string][] = [
      ['Venta del evento', maybe(pkg.sale, (value) => pesos(value))],
      ['Costo del evento', pesos(pkg.eventCost)],
      ['Utilidad', maybe(pkg.profit, (value) => pesos(value))],
      ['Margen real', maybe(pkg.marginPct, percent)],
      ['Costo variable por persona', pesos(pkg.variableCost)],
      ['Costo fijo por persona', pesos(pkg.fixedCost)],
      ['Costo total por persona', pesos(pkg.totalCost)],
      ['Piezas por persona', number(pkg.pieces, 2, 0)],
      ['Precio por margen', maybe(pkg.marginPrice, (value) => pesos(value, 0))],
      ['Precio comercial (tarifa)', maybe(pkg.commercialPrice, (value) => pesos(value, 0))],
      ['Frente a la carta', cartaText(pkg)],
    ];
    const source =
      pkg.priceSource === 'margin'
        ? 'Mandó el margen objetivo: el precio por margen supera la tarifa.'
        : pkg.priceSource === 'commercial'
          ? 'Mandó la tarifa comercial.'
          : `Sin precio: el mínimo es ${String(minPersonas)} personas.`;
    return render('partials/quote-package', {
      id: `paquete-${pkg.id}`,
      name: pkg.name,
      price: priced ? pesos(pkg.price ?? 0, 0) : 'Sin precio',
      priceUnit: priced ? 'por persona' : '',
      source,
      rows: join(rows.map(([label, value]) => render('partials/quote-detail', { label, value }))),
    });
  }

  function matrix(result: QuoteResult): SafeHtml {
    const { rows, packages } = result.matrix;
    if (rows.length === 0 || packages.length === 0) return empty();
    return render('partials/quote-matrix', {
      heads: join(packages.map((pkg) => render('partials/quote-matrix-head', { name: pkg.name }))),
      rows: join(
        rows.map((personas, index) =>
          render('partials/quote-matrix-row', {
            personas: String(personas),
            cells: join(
              packages.map((pkg) => {
                const cell = pkg.cells[index];
                return cell ? render('partials/quote-matrix-cell', { price: pesos(cell.price, 0), margin: `margen ${percent(cell.marginPct)}` }) : render('partials/quote-matrix-empty');
              }),
            ),
          }),
        ),
      ),
    });
  }

  function results(result: QuoteResult): SafeHtml {
    const below = result.belowMinimum
      ? notice({ tone: 'warning', title: `El mínimo es ${String(result.minPersonas)} personas.`, paragraphs: ['Con menos personas no hay precio: los costos se muestran solo como referencia.'] })
      : empty();
    return render('partials/quote-results', {
      title: `Resultado para ${String(result.personas)} ${result.personas === 1 ? 'persona' : 'personas'}`,
      notice: below,
      packages: result.packages.length > 0 ? join(result.packages.map((pkg) => packageCard(pkg, result.minPersonas))) : render('partials/empty', { text: 'No hay paquetes activos.' }),
      matrix: result.belowMinimum ? empty() : matrix(result),
    });
  }

  /** Resumen de errores (RF-8): enlaces a cada campo, en el orden de la pantalla; sin campo, el texto. */
  function errorSummary(quote: QuoteDefaults, errors: Readonly<Record<string, string>>): SafeHtml | null {
    if (Object.keys(errors).length === 0) return null;
    const known = [{ key: QUOTE_PERSONAS_FIELD, label: PERSONAS_LABEL }, ...quote.fields.map((entry) => ({ key: entry.key, label: entry.group ? `${entry.group} · ${labelOf(entry)}` : labelOf(entry) }))];
    const knownKeys = new Set(known.map(({ key }) => key));
    const items = [
      ...Object.entries(errors)
        .filter(([key]) => !knownKeys.has(key))
        .map(([, message]) => render('partials/error-summary-text', { message })),
      ...known.filter(({ key }) => Object.hasOwn(errors, key)).map(({ key, label }) => render('partials/error-summary-item', { id: quoteFieldId(key), label, message: errors[key] as string })),
    ];
    return notice({ tone: 'error', title: 'No se calculó nada: revisa los campos marcados.', extra: render('partials/error-summary', { items: join(items) }) });
  }

  function personasField(value: string, error: string | undefined, quote: QuoteDefaults): SafeHtml {
    const id = quoteFieldId(QUOTE_PERSONAS_FIELD);
    return render('partials/field-input', {
      id,
      name: QUOTE_PERSONAS_FIELD,
      label: PERSONAS_LABEL,
      optional: '',
      span: 'quote-form__personas min-w-40 grow sm:grow-0',
      value,
      attrs: attrs([['inputmode', 'numeric'], ['autocomplete', 'off'], ['maxlength', 64], ...describedBy(id, true, error)]),
      help: render('partials/field-help', { id: `${id}-help`, text: `Número entero de ${String(quote.personas.min)} a ${String(quote.personas.max)}.` }),
      error: errorOf(id, error),
    });
  }

  return {
    quotePage(view: QuoteView): SafeHtml {
      const { context, quote, personas, resetHref, errors = {}, result = null, notices = [] } = view;
      const summary = errorSummary(quote, errors);
      const reset = render('partials/quote-reset', { href: resetHref });
      return page({
        title: TITLE,
        context,
        business: QUOTE_BUSINESS,
        section: 'quote',
        body: render('pages/quote', {
          businessName: businessNames[QUOTE_BUSINESS],
          notices: join([...(summary ? [summary] : []), ...notices]),
          action: QUOTE_PATH,
          submitField: QUOTE_SUBMIT_FIELD,
          personas: personasField(personas, errors[QUOTE_PERSONAS_FIELD], quote),
          reset,
          notes: render('partials/quote-notes', { items: join(quote.notes.map((note) => render('partials/quote-note', { text: note.text }))) }),
          results: result ? results(result) : empty(),
          sections: sections(view, errors),
        }),
      });
    },

    /** RF-10 y CA-21: el JSON del cotizador no es válido o no se pudo leer. Sin detalles internos. */
    quoteUnavailable(context: PageContext): SafeHtml {
      return page({
        title: TITLE,
        context,
        business: QUOTE_BUSINESS,
        section: 'quote',
        body: render('pages/message', {
          title: TITLE,
          notice: notice({ tone: 'error', title: 'Cotizador no disponible.', paragraphs: ['Inténtalo de nuevo más tarde; si sigue igual, avisa al administrador.'] }),
          backHref: '/',
          backLabel: 'Volver al inicio',
        }),
      });
    },
  };
}
