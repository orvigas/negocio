import { BUSINESS_IDS, type BusinessId } from '../../config/businesses.ts';
import { getIconLinks } from '../../content/icons.ts';
import { getBusinessContent } from '../../content/index.ts';
import type { ConflictInfo, DamagedInfo } from '../../repositories/menu-repository.ts';
import {
  childOf,
  getMenuSchema,
  resolveUnion,
  type JsonObject,
  type LeafNode,
  type MenuDocument,
  type ObjectNode,
  type SchemaNode,
} from '../../services/menu-schema.ts';
import { centsToInput } from '../../services/price.ts';
import { formatDisplayDate } from '../../utils/datetime.ts';
import type { Renderer, SafeHtml } from '../render.ts';

/** Atributo HTML: `true` lo pinta sin valor; `false` o `undefined` lo omiten. */
type AttrEntry = [name: string, value: string | boolean | undefined];

interface SummaryItem {
  id: string;
  label: string;
  message: string;
}

/** Lo que escribió el usuario y sus errores, para volver a pintar el formulario. */
export interface AdminFormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  author?: string | undefined;
  authorError?: string | null | undefined;
}

export interface LastChange {
  at: string;
  by: string;
}

/**
 * Vistas de la administración (REQ-F-001). Sin diseño fuente (C-8): HTML semántico,
 * Tailwind y BEM, sin JavaScript. El formulario se genera a partir del esquema de
 * src/services/menu-schema.ts, así que siempre coincide con lo que valida el servidor.
 *
 * Las clases de Tailwind viven aquí y en src/views/admin/*.html (fuentes de
 * src/styles/admin/main.css).
 */

const CLASSES = Object.freeze({
  input:
    'mt-1 block w-full rounded-md border-slate-500 text-sm text-slate-900 shadow-xs focus:border-blue-700 focus:ring-2 focus:ring-blue-700 aria-invalid:border-red-700 aria-invalid:ring-1 aria-invalid:ring-red-700',
  primaryButton:
    'inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700',
  secondaryButton:
    'inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-500 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-700',
  navLink:
    'inline-flex rounded-md px-3 py-2 text-sm font-semibold text-blue-900 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-blue-700 aria-[current=page]:bg-blue-800 aria-[current=page]:text-white',
});

const NOTICE_TONES: Readonly<Record<'error' | 'warning' | 'success', string>> = Object.freeze({
  error: 'admin-notice--error border-red-700 bg-red-50 text-red-900',
  warning: 'admin-notice--warning border-amber-600 bg-amber-50 text-amber-950',
  success: 'admin-notice--success border-green-700 bg-green-50 text-green-900',
});

const SERVING_FROM_TEXT: Readonly<Record<string, string>> = Object.freeze({
  previous: 'la versión anterior',
  seed: 'la semilla original',
  memory: 'la última versión válida',
});

export const SUCCESS_MESSAGES = Object.freeze({
  save: 'Cambios guardados. La landing ya muestra los datos nuevos.',
  overwrite_after_conflict: 'Tus cambios se guardaron sobre la versión más reciente.',
  restore_previous: 'Se restauró la versión anterior.',
  restore_seed: 'Se restauró la semilla original.',
});

const MULTILINE_MIN_LENGTH = 400;

export const adminPath = (businessId: BusinessId): string => `/admin/${businessId}`;
export const restorePreviousPath = (businessId: BusinessId): string => `${adminPath(businessId)}/restaurar-anterior`;
export const restoreSeedPath = (businessId: BusinessId): string => `${adminPath(businessId)}/restaurar-semilla`;
export const businessName = (businessId: BusinessId): string => getBusinessContent(businessId).name;

const fieldId = (name: string): string => `f-${name.replaceAll('.', '-')}`;

function attrs(renderer: Renderer, entries: AttrEntry[]): SafeHtml {
  return renderer.join(
    entries
      .filter(([, value]) => value !== undefined && value !== false)
      .map(([name, value]) =>
        value === true ? renderer.render('admin/partials/attr-flag', { name }) : renderer.render('admin/partials/attr', { name, value }),
      ),
  );
}

function fieldError(renderer: Renderer, id: string, message: string | null | undefined): SafeHtml {
  return message ? renderer.render('admin/partials/field-error', { id: `${id}-error`, message }) : renderer.join([]);
}

function invalidAttrs(id: string, message: string | null | undefined, extraDescribedBy?: string): AttrEntry[] {
  const describedBy = [extraDescribedBy, message ? `${id}-error` : undefined].filter(Boolean).join(' ');
  return [
    ['aria-invalid', message ? 'true' : undefined],
    ['aria-describedby', describedBy || undefined],
  ];
}

function renderNotice(
  renderer: Renderer,
  {
    tone,
    title,
    paragraphs = [],
    role,
    extra,
  }: { tone: keyof typeof NOTICE_TONES; title: string; paragraphs?: string[]; role: string; extra?: SafeHtml },
): SafeHtml {
  return renderer.render('admin/partials/notice', {
    toneClass: NOTICE_TONES[tone],
    title,
    attrs: attrs(renderer, [
      ['role', role],
      // Sin JavaScript: el aviso de error recibe el foco al cargar para que se lea primero.
      ['tabindex', role === 'alert' ? '-1' : undefined],
      ['autofocus', role === 'alert'],
    ]),
    content: renderer.join([
      ...paragraphs.map((text) => renderer.render('admin/partials/paragraph', { text })),
      ...(extra ? [extra] : []),
    ]),
  });
}

/** Valor del campo para pintar el formulario a partir de los datos guardados. */
function displayValue(node: LeafNode, value: unknown): string {
  switch (node.kind) {
    case 'price':
      // Datos guardados ya validados: un precio siempre es un entero en centavos.
      return centsToInput(value as number);
    case 'bool':
      return value ? 'on' : '';
    default:
      return String(value);
  }
}

function renderLeaf(
  renderer: Renderer,
  node: LeafNode,
  { name, label, value, error }: { name: string; label: string; value: unknown; error: string | undefined },
): SafeHtml {
  const id = fieldId(name);
  switch (node.kind) {
    case 'key':
      return renderer.render('admin/partials/field-hidden', { name, value });
    case 'bool':
      return renderer.render('admin/partials/field-checkbox', {
        id,
        name,
        label,
        attrs: attrs(renderer, [['checked', value === 'on']]),
        error: fieldError(renderer, id, error),
      });
    case 'enum':
      return renderer.render('admin/partials/field-select', {
        id,
        name,
        label,
        inputClass: CLASSES.input,
        attrs: attrs(renderer, invalidAttrs(id, error)),
        options: renderer.join(
          node.options.map((option) =>
            renderer.render('admin/partials/option', { value: option, selected: attrs(renderer, [['selected', option === value]]) }),
          ),
        ),
        hint: renderer.join([]),
        error: fieldError(renderer, id, error),
      });
    default:
      break;
  }

  const hints: Partial<Record<LeafNode['kind'], string>> = {
    price: 'En pesos, mayor que $0 y hasta $5,000.00, con hasta 2 decimales (por ejemplo 45.50).',
    imageSrc: 'Ruta dentro de /img/ de un archivo existente (.jpg, .jpeg, .png o .webp).',
  };
  const hintText = hints[node.kind];
  const hintId = hintText ? `${id}-hint` : undefined;
  const maxLength = node.kind === 'text' ? node.max : undefined;
  const inputModes: Partial<Record<LeafNode['kind'], string>> = { price: 'decimal', int: 'numeric' };
  const inputMode = inputModes[node.kind];
  const common = {
    id,
    name,
    label,
    value,
    inputClass: CLASSES.input,
    hint: hintText ? renderer.render('admin/partials/field-hint', { id: hintId, text: hintText }) : renderer.join([]),
    error: fieldError(renderer, id, error),
    attrs: attrs(renderer, [
      ['maxlength', maxLength === undefined ? undefined : String(maxLength)],
      ['inputmode', inputMode],
      ['spellcheck', node.kind === 'text' ? undefined : 'false'],
      ...invalidAttrs(id, error, hintId),
    ]),
  };
  if (node.kind === 'text' && node.max >= MULTILINE_MIN_LENGTH) {
    return renderer.render('admin/partials/field-textarea', common);
  }
  return renderer.render('admin/partials/field-input', {
    ...common,
    widthClass: node.kind === 'text' && node.max > 80 ? 'sm:col-span-2' : '',
  });
}

/**
 * Pinta los campos del esquema. `form` (opcional) trae lo que escribió el usuario y los errores.
 * Devuelve también la lista de errores en orden, para el resumen.
 */
function renderSchemaFields(
  renderer: Renderer,
  businessId: BusinessId,
  data: unknown,
  form: AdminFormState | undefined,
): { sections: SafeHtml; summary: SummaryItem[] } {
  const summary: SummaryItem[] = [];

  function visit(node: SchemaNode, value: unknown, path: string[], context: string[], depth: number, index?: number): SafeHtml {
    if (node.kind === 'union') {
      // La unión aporta la leyenda del producto; el nodo concreto, sus campos.
      // Datos guardados ya validados: la unión siempre se resuelve.
      return visit({ ...(resolveUnion(node, value) as ObjectNode), legend: node.legend }, value, path, context, depth, index);
    }
    if (node.kind === 'list') {
      // Datos guardados ya validados: en un nodo lista el valor siempre es un array.
      return renderer.join((value as unknown[]).map((item, i) => visit(node.item, item, [...path, String(i)], context, depth, i)));
    }
    if (node.kind === 'object') {
      // Valor validado como objeto. Las leyendas que usan el índice solo están en elementos de lista.
      const legend = node.legend?.(value as JsonObject, index as number);
      const nextContext = legend ? [...context, legend] : context;
      const content = renderer.join(
        Object.entries(node.fields).map(([name, child]) => visit(child, childOf(value, name), [...path, name], nextContext, depth + 1)),
      );
      if (!legend) return content;
      return renderer.render(depth === 1 ? 'admin/partials/fieldset-section' : 'admin/partials/fieldset', { legend, content });
    }

    const name = path.join('.');
    const error = form?.errors[name];
    if (error) summary.push({ id: fieldId(name), label: [...context, node.label].join(' › '), message: error });
    const shown = form && Object.hasOwn(form.values, name) ? form.values[name] : displayValue(node, value);
    return renderLeaf(renderer, node, { name, label: node.label, value: shown, error });
  }

  const sections = visit(getMenuSchema(businessId), data, [], [], 0);
  return { sections, summary };
}

function renderAuthorField(
  renderer: Renderer,
  { id, value = '', error }: { id: string; value?: string | undefined; error?: string | null | undefined },
): SafeHtml {
  return renderer.render('admin/partials/author', {
    id,
    value,
    inputClass: CLASSES.input,
    error: fieldError(renderer, id, error),
    attrs: attrs(renderer, invalidAttrs(id, error)),
  });
}

function renderHeader(renderer: Renderer, { businessId, csrfToken }: { businessId: BusinessId; csrfToken: string }): SafeHtml {
  return renderer.render('admin/partials/header', {
    csrfToken,
    secondaryButtonClass: CLASSES.secondaryButton,
    links: renderer.join(
      BUSINESS_IDS.map((id) =>
        renderer.render('admin/partials/nav-link', {
          href: adminPath(id),
          label: businessName(id),
          linkClass: CLASSES.navLink,
          current: attrs(renderer, [['aria-current', id === businessId ? 'page' : undefined]]),
        }),
      ),
    ),
  });
}

/**
 * `faviconBusinessId`: negocio activo del día; admin muestra su favicon, sin manifest ni
 * theme-color (REQ-F-002, RF-7).
 */
function layout(
  renderer: Renderer,
  {
    title,
    header,
    body,
    faviconBusinessId,
  }: { title: string; header?: SafeHtml; body: SafeHtml; faviconBusinessId: BusinessId },
): SafeHtml {
  return renderer.render('admin/layout', {
    title: `${title} | Administración`,
    faviconLinks: renderer.render('partials/favicon-links', getIconLinks(faviconBusinessId)),
    header: header ?? renderer.join([]),
    body,
  });
}

function lastChangeText(lastChange: LastChange | null, timezone: string): string {
  if (!lastChange) return 'Último cambio: ninguno (datos originales).';
  return `Último cambio: ${formatDisplayDate(lastChange.at, timezone)} por ${lastChange.by}`;
}

export function renderAdminLogin(
  renderer: Renderer,
  {
    next,
    error,
    expired = false,
    faviconBusinessId,
  }: { next: string; error?: 'invalid' | 'locked' | undefined; expired?: boolean; faviconBusinessId: BusinessId },
): SafeHtml {
  let notice = renderer.join([]);
  if (error === 'invalid') {
    notice = renderNotice(renderer, { tone: 'error', role: 'alert', title: 'Usuario o contraseña incorrectos.' });
  } else if (error === 'locked') {
    notice = renderNotice(renderer, {
      tone: 'error',
      role: 'alert',
      title: 'Acceso bloqueado temporalmente.',
      paragraphs: ['Hubo demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.'],
    });
  } else if (expired) {
    notice = renderNotice(renderer, {
      tone: 'warning',
      role: 'alert',
      title: 'Tu sesión caducó.',
      paragraphs: ['Vuelve a entrar. No se guardó ningún cambio.'],
    });
  }
  return layout(renderer, {
    title: 'Acceso',
    faviconBusinessId,
    body: renderer.render('admin/login', {
      next,
      notice,
      inputClass: CLASSES.input,
      primaryButtonClass: CLASSES.primaryButton,
    }),
  });
}

function renderDamaged(
  renderer: Renderer,
  {
    businessId,
    damaged,
    csrfToken,
    author,
  }: { businessId: BusinessId; damaged: DamagedInfo; csrfToken: string; author: RestoreAuthor | undefined },
): SafeHtml {
  const option = (action: string, label: string, idSuffix: string) =>
    renderer.render('admin/partials/restore-form', {
      action,
      csrfToken,
      label,
      buttonClass: CLASSES.primaryButton,
      author: renderAuthorField(renderer, { id: `author-${idSuffix}`, value: author?.value, error: author?.error }),
    });
  return renderer.render('admin/partials/damaged', {
    toneClass: NOTICE_TONES.error,
    servingFrom: SERVING_FROM_TEXT[damaged.servingFrom],
    options: renderer.join([
      ...(damaged.previousValid ? [option(restorePreviousPath(businessId), 'Restaurar versión anterior', 'previous')] : []),
      option(restoreSeedPath(businessId), 'Restaurar semilla original', 'seed'),
    ]),
  });
}

interface RestoreAuthor {
  value?: string | undefined;
  error?: string | null | undefined;
}

export interface AdminBusinessOptions {
  businessId: BusinessId;
  timezone: string;
  csrfToken: string;
  document: MenuDocument;
  version: string;
  lastChange: LastChange | null;
  damaged: DamagedInfo | null;
  form?: AdminFormState | undefined;
  conflict?: ConflictInfo | undefined;
  success?: string | undefined;
  problem?: string | undefined;
  restoreAuthor?: RestoreAuthor | undefined;
  /** Negocio activo del día (favicon de la pestaña). */
  faviconBusinessId: BusinessId;
}

/** Página de configuración de un negocio. */
export function renderAdminBusiness(renderer: Renderer, options: AdminBusinessOptions): SafeHtml {
  const {
    businessId,
    timezone,
    csrfToken,
    document,
    version,
    lastChange,
    damaged,
    form,
    conflict,
    success,
    problem,
    restoreAuthor,
    faviconBusinessId,
  } = options;
  const { sections, summary } = renderSchemaFields(renderer, businessId, document.data, form);

  const authorError = form?.authorError;
  if (authorError) summary.push({ id: 'author', label: 'Nombre de quien hace el cambio', message: authorError });

  const notices: SafeHtml[] = [];
  if (success) notices.push(renderNotice(renderer, { tone: 'success', role: 'status', title: success }));
  if (problem) notices.push(renderNotice(renderer, { tone: 'error', role: 'alert', title: problem }));
  if (summary.length > 0) {
    notices.push(
      renderNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: `No se guardó nada: revisa ${summary.length === 1 ? 'el campo marcado' : `los ${summary.length} campos marcados`}.`,
        extra: renderer.render('admin/partials/error-list', {
          items: renderer.renderEach('admin/partials/error-summary-item', summary),
        }),
      }),
    );
  }
  if (damaged) {
    notices.push(renderDamaged(renderer, { businessId, damaged, csrfToken, author: restoreAuthor }));
  }

  const authorField = renderAuthorField(renderer, { id: 'author', value: form?.author, error: authorError });
  let conflictNotice = renderer.join([]);
  let submit = renderer.render('admin/partials/submit', { author: authorField, primaryButtonClass: CLASSES.primaryButton });
  if (conflict && !damaged) {
    const who = conflict.updatedBy ?? 'alguien';
    const when = conflict.updatedAt ? ` el ${formatDisplayDate(conflict.updatedAt, timezone)}` : '';
    conflictNotice = renderer.render('admin/partials/conflict', {
      toneClass: NOTICE_TONES.warning,
      detail: `${who} guardó otra versión${when}.`,
      author: authorField,
      discardHref: adminPath(businessId),
      primaryButtonClass: CLASSES.primaryButton,
      secondaryButtonClass: CLASSES.secondaryButton,
    });
    submit = renderer.join([]);
  }
  if (damaged) submit = renderer.join([]);

  const title = `Menú de ${businessName(businessId)}`;
  return layout(renderer, {
    title,
    faviconBusinessId,
    header: renderHeader(renderer, { businessId, csrfToken }),
    body: renderer.render('admin/business', {
      title,
      lastChange: lastChangeText(lastChange, timezone),
      notices: renderer.join(notices),
      action: adminPath(businessId),
      csrfToken,
      expectedVersion: conflict ? conflict.version : version,
      conflict: conflictNotice,
      dataAttrs: attrs(renderer, [['disabled', Boolean(damaged)]]),
      sections,
      submit,
      restore: damaged
        ? renderer.join([])
        : renderer.render('admin/partials/restore-link', {
            href: restorePreviousPath(businessId),
            secondaryButtonClass: CLASSES.secondaryButton,
          }),
    }),
  });
}

/**
 * Página de confirmación de "Restaurar versión anterior" (funciona sin JavaScript).
 */
export function renderAdminConfirmRestore(
  renderer: Renderer,
  {
    businessId,
    timezone,
    csrfToken,
    lastChange,
    author,
    authorError,
    problem,
    faviconBusinessId,
  }: {
    businessId: BusinessId;
    timezone: string;
    csrfToken: string;
    lastChange: LastChange | null;
    author?: string | undefined;
    authorError?: string | null | undefined;
    problem?: string | undefined;
    faviconBusinessId: BusinessId;
  },
): SafeHtml {
  const title = `Menú de ${businessName(businessId)}`;
  const notices = problem ? [renderNotice(renderer, { tone: 'error', role: 'alert', title: problem })] : [];
  return layout(renderer, {
    title: `Restaurar versión anterior · ${title}`,
    faviconBusinessId,
    header: renderHeader(renderer, { businessId, csrfToken }),
    body: renderer.render('admin/confirm-restore', {
      title,
      lastChange: lastChangeText(lastChange, timezone),
      notices: renderer.join(notices),
      action: restorePreviousPath(businessId),
      csrfToken,
      author: renderAuthorField(renderer, { id: 'author', value: author, error: authorError }),
      cancelHref: adminPath(businessId),
      primaryButtonClass: CLASSES.primaryButton,
      secondaryButtonClass: CLASSES.secondaryButton,
    }),
  });
}
