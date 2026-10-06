import type { BusinessId } from '../../config/businesses.ts';
import { getIconLinks } from '../../content/icons.ts';
import { getBusinessContent } from '../../content/index.ts';
import type { ConflictInfo, DamagedInfo } from '../../repositories/menu-repository.ts';
import { allowedBusinesses, isAdmin } from '../../services/authorization.ts';
import {
  childOf,
  getPageSchema,
  pickPageData,
  resolveUnion,
  type JsonObject,
  type LeafNode,
  type MenuDocument,
  type ObjectNode,
  type SchemaNode,
} from '../../services/menu-schema.ts';
import { centsToInput } from '../../services/price.ts';
import { ROLE_LABELS, type Role } from '../../services/user-schema.ts';
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
}

/** Usuario de la sesión, tal como lo necesitan las vistas (cabecera y autor). */
export interface AdminViewer {
  displayName: string;
  role: Role;
  businesses: readonly BusinessId[];
}

/** Sección actual de la navegación. */
export type AdminSection = BusinessId | 'home' | 'users' | 'account';

/** Lo común a todas las páginas con sesión. */
export interface AdminPageContext {
  viewer: AdminViewer;
  csrfToken: string;
  /** Negocio activo del día (favicon de la pestaña; REQ-F-002, RF-7). */
  faviconBusinessId: BusinessId;
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
  product_created: 'Producto creado. Está al final y no disponible: edítalo y marca "Disponible" para mostrarlo en la landing.',
  product_saved: 'Producto guardado. La landing ya muestra los datos nuevos.',
  product_overwritten: 'Tus cambios del producto se guardaron sobre la versión más reciente.',
  product_deleted: 'Producto eliminado. Puedes recuperarlo desde "Productos eliminados".',
  product_restored: 'Producto recuperado. Quedó al final y no disponible.',
  product_moved: 'Orden actualizado.',
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

  const sections = visit(getPageSchema(businessId), data, [], [], 0);
  return { sections, summary };
}

export const ADMIN_HOME_PATH = '/admin';
export const USERS_PATH = '/admin/usuarios';
export const ACCOUNT_PATH = '/admin/cuenta';

/** Navegación según el usuario: solo enlaza a lo que tiene permitido (R-7). */
function renderHeader(
  renderer: Renderer,
  { viewer, csrfToken, current }: { viewer: AdminViewer; csrfToken: string; current: AdminSection | undefined },
): SafeHtml {
  const entries: { id: AdminSection; href: string; label: string }[] = [
    { id: 'home', href: ADMIN_HOME_PATH, label: 'Inicio' },
    ...allowedBusinesses(viewer).map((id) => ({ id, href: adminPath(id), label: businessName(id) })),
    ...(isAdmin(viewer) ? [{ id: 'users' as const, href: USERS_PATH, label: 'Usuarios' }] : []),
    { id: 'account', href: ACCOUNT_PATH, label: 'Mi cuenta' },
  ];
  return renderer.render('admin/partials/header', {
    csrfToken,
    displayName: viewer.displayName,
    roleLabel: ROLE_LABELS[viewer.role],
    secondaryButtonClass: CLASSES.secondaryButton,
    links: renderer.join(
      entries.map(({ id, href, label }) =>
        renderer.render('admin/partials/nav-link', {
          href,
          label,
          linkClass: CLASSES.navLink,
          current: attrs(renderer, [['aria-current', id === current ? 'page' : undefined]]),
        }),
      ),
    ),
  });
}

/** Página con sesión: layout + cabecera del usuario. */
export function adminPage(
  renderer: Renderer,
  {
    viewer,
    csrfToken,
    faviconBusinessId,
    current,
    title,
    body,
  }: AdminPageContext & {
    /** Sección de la URL actual; undefined si no corresponde a ningún enlace (p. ej. un 403). */
    current: AdminSection | undefined;
    title: string;
    body: SafeHtml;
  },
): SafeHtml {
  return layout(renderer, { title, faviconBusinessId, header: renderHeader(renderer, { viewer, csrfToken, current }), body });
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
  { businessId, damaged, csrfToken }: { businessId: BusinessId; damaged: DamagedInfo; csrfToken: string },
): SafeHtml {
  const option = (action: string, label: string) =>
    renderer.render('admin/partials/restore-form', {
      action,
      csrfToken,
      label,
      buttonClass: CLASSES.primaryButton,
    });
  return renderer.render('admin/partials/damaged', {
    toneClass: NOTICE_TONES.error,
    servingFrom: SERVING_FROM_TEXT[damaged.servingFrom],
    options: renderer.join([
      ...(damaged.previousValid ? [option(restorePreviousPath(businessId), 'Restaurar versión anterior')] : []),
      option(restoreSeedPath(businessId), 'Restaurar semilla original'),
    ]),
  });
}

export interface AdminBusinessOptions extends AdminPageContext {
  businessId: BusinessId;
  timezone: string;
  document: MenuDocument;
  version: string;
  lastChange: LastChange | null;
  damaged: DamagedInfo | null;
  form?: AdminFormState | undefined;
  conflict?: ConflictInfo | undefined;
  success?: string | undefined;
  problem?: string | undefined;
  /** Lista de productos (REQ-F-008; src/views/admin/products.ts). */
  products?: SafeHtml | undefined;
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
    viewer,
    faviconBusinessId,
    products,
  } = options;
  const { sections, summary } = renderSchemaFields(renderer, businessId, pickPageData(businessId, document.data), form);

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
    notices.push(renderDamaged(renderer, { businessId, damaged, csrfToken }));
  }

  let conflictNotice = renderer.join([]);
  let submit = renderer.render('admin/partials/submit', { authorName: viewer.displayName, primaryButtonClass: CLASSES.primaryButton });
  if (conflict && !damaged) {
    const who = conflict.updatedBy ?? 'alguien';
    const when = conflict.updatedAt ? ` el ${formatDisplayDate(conflict.updatedAt, timezone)}` : '';
    conflictNotice = renderer.render('admin/partials/conflict', {
      toneClass: NOTICE_TONES.warning,
      detail: `${who} guardó otra versión${when}.`,
      discardHref: adminPath(businessId),
      primaryButtonClass: CLASSES.primaryButton,
      secondaryButtonClass: CLASSES.secondaryButton,
    });
    submit = renderer.join([]);
  }
  if (damaged) submit = renderer.join([]);

  const title = `Menú de ${businessName(businessId)}`;
  return adminPage(renderer, {
    title,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/business', {
      title,
      lastChange: lastChangeText(lastChange, timezone),
      notices: renderer.join(notices),
      products: products ?? renderer.join([]),
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
    problem,
    viewer,
    faviconBusinessId,
  }: AdminPageContext & {
    businessId: BusinessId;
    timezone: string;
    lastChange: LastChange | null;
    problem?: string | undefined;
  },
): SafeHtml {
  const title = `Menú de ${businessName(businessId)}`;
  const notices = problem ? [renderNotice(renderer, { tone: 'error', role: 'alert', title: problem })] : [];
  return adminPage(renderer, {
    title: `Restaurar versión anterior · ${title}`,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/confirm-restore', {
      title,
      lastChange: lastChangeText(lastChange, timezone),
      notices: renderer.join(notices),
      action: restorePreviousPath(businessId),
      csrfToken,
      cancelHref: adminPath(businessId),
      primaryButtonClass: CLASSES.primaryButton,
      secondaryButtonClass: CLASSES.secondaryButton,
    }),
  });
}

/**
 * Página 503 cuando la base de datos no responde (REQ-F-007, R-3 y DT-9). No muestra detalles
 * técnicos: solo un aviso accesible.
 */
export function renderAdminUnavailable(renderer: Renderer, { faviconBusinessId }: { faviconBusinessId: BusinessId }): SafeHtml {
  return layout(renderer, {
    title: 'No disponible',
    faviconBusinessId,
    body: renderer.render('admin/unavailable', {
      notice: renderNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: 'No se pudo acceder a los datos de la administración.',
        paragraphs: ['No se guardó ningún cambio. Las páginas de los negocios siguen funcionando. Inténtalo de nuevo en unos minutos.'],
      }),
    }),
  });
}

/** Inicio de /admin: solo lo que el usuario tiene permitido (REQ-F-007, R-7). */
export function renderAdminHome(renderer: Renderer, context: AdminPageContext): SafeHtml {
  const { viewer } = context;
  const items = [
    ...allowedBusinesses(viewer).map((businessId) => ({
      href: adminPath(businessId),
      label: `Menú de ${businessName(businessId)}`,
      description: 'Hero, promociones, productos y precios.',
    })),
    ...(isAdmin(viewer) ? [{ href: USERS_PATH, label: 'Usuarios', description: 'Crear, editar, desactivar y restablecer contraseñas.' }] : []),
    { href: ACCOUNT_PATH, label: 'Mi cuenta', description: 'Cambiar tu contraseña.' },
  ];
  return adminPage(renderer, {
    ...context,
    title: 'Inicio',
    current: 'home',
    body: renderer.render('admin/home', {
      displayName: viewer.displayName,
      notices: renderer.join([]),
      items: renderer.renderEach('admin/partials/home-item', items),
    }),
  });
}

/** 403 por permiso (REQ-F-007, R-7 y DT-12): aviso accesible; no se escribió nada. */
export function renderAdminForbidden(renderer: Renderer, context: AdminPageContext & { message: string }): SafeHtml {
  return adminPage(renderer, {
    ...context,
    title: 'Sin permiso',
    // La URL pedida no es ninguna sección permitida: ningún enlace es la página actual.
    current: undefined,
    body: renderer.render('admin/forbidden', {
      notice: renderNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: context.message,
        paragraphs: ['No se cambió nada. Si necesitas acceso, pídeselo a un administrador.'],
      }),
    }),
  });
}

/** Avisos reutilizables por las páginas de usuarios y cuenta. */
export {
  fieldId as adminFieldId,
  lastChangeText as adminLastChangeText,
  renderLeaf as renderAdminLeaf,
};
export { CLASSES as ADMIN_CLASSES, NOTICE_TONES as ADMIN_NOTICE_TONES, attrs as adminAttrs, fieldError as adminFieldError, invalidAttrs as adminInvalidAttrs, renderNotice as renderAdminNotice };
