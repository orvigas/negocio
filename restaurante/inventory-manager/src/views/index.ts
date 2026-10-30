import type { AdminProduct, AdminUser, ProductFormField, PublicBusinessId } from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import { ACCOUNT_PATH, USERS_PATH, createUserViews } from './users.ts';

/**
 * Vistas del admin nuevo (REQ-F-039, RF-16; sistema visual P-4). HTML semántico, BEM y Tailwind; todo
 * funciona sin JavaScript (formularios con POST/redirect/GET) y el JS de public/js solo mejora. Los
 * errores van junto a su campo (`aria-describedby`, `aria-invalid`) y en un resumen con enlaces, con
 * texto y no solo color. Los encabezados empiezan en un único h1 por página.
 */

export const BUSINESS_NAMES: Readonly<Record<PublicBusinessId, string>> = Object.freeze({ molotes: 'Molotes', birria: 'Birria El Muñeco' });
export const CATEGORY_TITLES: Readonly<Record<string, string>> = Object.freeze({ platillo: 'Platillos', bebida: 'Bebidas' });
const CATEGORY_SINGULAR: Readonly<Record<string, string>> = Object.freeze({ platillo: 'platillo', bebida: 'bebida' });
const NEW_TITLES: Readonly<Record<string, string>> = Object.freeze({ platillo: 'Nuevo platillo', bebida: 'Nueva bebida' });

export const DETAILS_TYPES: readonly { id: string; label: string; description: string }[] = Object.freeze([
  { id: 'chips', label: 'Chips', description: 'Precio propio y una lista de etiquetas (por ejemplo, lo que incluye).' },
  { id: 'portion', label: 'Porción', description: 'Precio propio, porción y un extra.' },
  { id: 'variants', label: 'Variantes', description: 'De 1 a 6 opciones con su propio precio y descripción (el cliente elige una).' },
]);

export const productsPath = (business: PublicBusinessId): string => `/${business}/productos`;
export const productPath = (business: PublicBusinessId, id: number): string => `${productsPath(business)}/${id}`;

type Tone = 'error' | 'success' | 'warning' | 'info';
const TONE_CLASSES: Readonly<Record<Tone, string>> = Object.freeze({
  error: 'border-l-error',
  success: 'border-l-maiz',
  warning: 'border-l-adobo',
  info: 'border-l-masa',
});

export interface PageContext {
  user: AdminUser;
  csrfToken: string;
}

export interface NoticeOptions {
  tone: Tone;
  title: string;
  paragraphs?: string[];
  links?: { href: string; label: string }[];
  extra?: SafeHtml;
  /** Un aviso que el usuario debe leer antes de seguir (p. ej. el conflicto 409): alerta con foco. */
  urgent?: boolean;
}

/** Sección de la cabecera fuera de un negocio (REQ-F-040): usuarios o "Mi cuenta". */
export type HeaderSection = 'users' | 'account';

export interface PageOptions {
  title: string;
  body: SafeHtml;
  context?: PageContext | undefined;
  business?: PublicBusinessId | undefined;
  section?: HeaderSection | undefined;
}

const fieldId = (name: string): string => `f-${name.replaceAll('.', '-')}`;

export function createViews(renderer: Renderer) {
  const { render, join } = renderer;
  const attrs = (entries: [string, string | number | boolean | undefined][]): SafeHtml =>
    join(
      entries
        .filter(([, value]) => value !== undefined && value !== false)
        .map(([name, value]) => (value === true ? render('partials/attr-flag', { name }) : render('partials/attr', { name, value: String(value) }))),
    );

  function notice({ tone, title, paragraphs = [], links = [], extra, urgent = false }: NoticeOptions): SafeHtml {
    // Un error o un aviso urgente (409, DEF-008 de QA) es una alerta y recibe el foco al cargar (se lee
    // primero); el resto es un estado.
    const role: [string, string | boolean | undefined][] =
      tone === 'error' || urgent ? [['role', 'alert'], ['tabindex', '-1'], ['autofocus', true]] : [['role', 'status']];
    return render('partials/notice', {
      tone,
      toneClass: TONE_CLASSES[tone],
      title,
      attrs: attrs(role),
      content: join([
        ...paragraphs.map((text) => render('partials/paragraph', { text })),
        ...links.map((link) => render('partials/link-paragraph', link)),
        ...(extra ? [extra] : []),
      ]),
    });
  }

  function header(context: PageContext, current: PublicBusinessId | undefined, section: HeaderSection | undefined): SafeHtml {
    const ariaCurrent = (active: boolean) => (active ? render('partials/aria-current') : join([]));
    return render('partials/header', {
      userName: context.user.name,
      csrfToken: context.csrfToken,
      accountCurrent: ariaCurrent(section === 'account'),
      links: join([
        ...context.user.businesses.map((business) =>
          render('partials/nav-link', { href: productsPath(business), label: BUSINESS_NAMES[business], current: ariaCurrent(business === current) }),
        ),
        // "Usuarios" solo para administradores (REQ-F-040, RF-1).
        ...(context.user.role === 'admin' ? [render('partials/nav-link', { href: USERS_PATH, label: 'Usuarios', current: ariaCurrent(section === 'users') })] : []),
      ]),
    });
  }

  function page({ title, body, context, business, section }: PageOptions): SafeHtml {
    return render('layout', {
      title,
      theme: business ?? 'neutral',
      // Favicon del negocio que se edita; fuera de un negocio, el de la marca de inicio (Birria).
      favicon: business ?? 'birria',
      header: context ? header(context, business, section) : join([]),
      body,
    });
  }

  return {
    notice,
    page,
    ...createUserViews({ render, join, attrs, page, notice, displayDate }),

    login({ next, problem }: { next: string; problem?: 'invalid' | 'locked' | 'expired' | 'unavailable' | 'closed' | undefined }): SafeHtml {
      const notices: Record<string, NoticeOptions> = {
        invalid: { tone: 'error', title: 'Usuario o contraseña incorrectos.' },
        locked: { tone: 'error', title: 'Acceso bloqueado temporalmente.', paragraphs: ['Hubo demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.'] },
        expired: { tone: 'warning', title: 'Tu sesión caducó.', paragraphs: ['Vuelve a entrar. Si estabas guardando algo, no se guardó.'] },
        unavailable: { tone: 'error', title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema. Inténtalo de nuevo en unos minutos.'] },
        // REQ-F-040: el propio usuario cambió su rol, su estado o su contraseña desde "Usuarios".
        closed: { tone: 'info', title: 'Tu sesión se cerró.', paragraphs: ['Cambiaste tu propio rol, estado o contraseña. Si tu cuenta sigue activa, vuelve a entrar.'] },
      };
      const chosen = problem ? notices[problem] : undefined;
      return page({ title: 'Acceso', body: render('pages/login', { next, notice: chosen ? notice(chosen) : join([]) }) });
    },

    businesses(context: PageContext): SafeHtml {
      const items = context.user.businesses.map((business) =>
        render('partials/business-item', { id: business, href: productsPath(business), name: BUSINESS_NAMES[business] }),
      );
      return page({ title: 'Negocios', context, body: render('pages/businesses', { items: join(items) }) });
    },

    /** Lista de productos por categoría (también el fragmento que reemplaza el JS de reordenar). */
    productList(context: PageContext, business: PublicBusinessId, products: AdminProduct[]): SafeHtml {
      const categories = business === 'molotes' ? ['platillo', 'bebida'] : ['platillo'];
      return join(
        categories.map((category) => {
          const items = products.filter((product) => product.category === category && !product.deleted).sort((a, b) => a.position - b.position);
          const rows = items.map((product, index) => {
            const move = (direction: 'up' | 'down', path: 'subir' | 'bajar', label: string) =>
              render('partials/move-form', {
                action: `${productPath(business, product.id)}/${path}`,
                csrfToken: context.csrfToken,
                version: product.version,
                direction,
                id: product.id,
                label,
                name: product.name,
              });
            return render('partials/product-row', {
              id: product.id,
              position: index + 1,
              name: product.name,
              price: priceText(product),
              state: product.available ? 'Disponible' : 'No disponible',
              stateModifier: product.available ? 'available' : 'unavailable',
              stateClass: product.available ? 'text-maiz' : 'text-error',
              editHref: `${productPath(business, product.id)}/editar`,
              deleteHref: `${productPath(business, product.id)}/eliminar`,
              moves: join([...(index > 0 ? [move('up', 'subir', 'Subir')] : []), ...(index < items.length - 1 ? [move('down', 'bajar', 'Bajar')] : [])]),
            });
          });
          const title = CATEGORY_TITLES[category] ?? category;
          return render('partials/product-group', {
            id: `categoria-${category}`,
            title,
            content: rows.length > 0 ? render('partials/product-items', { rows: join(rows) }) : render('partials/empty', { text: `No hay ${title.toLowerCase()} activos.` }),
          });
        }),
      );
    },

    products(context: PageContext, business: PublicBusinessId, list: SafeHtml, notices: SafeHtml[]): SafeHtml {
      const add =
        business === 'molotes'
          ? [
              { href: `${productsPath(business)}/nuevo?categoria=platillo`, label: 'Agregar platillo' },
              { href: `${productsPath(business)}/nuevo?categoria=bebida`, label: 'Agregar bebida' },
            ]
          : [{ href: `${productsPath(business)}/nuevo`, label: 'Agregar platillo' }];
      const actions = [...add, { href: `${productsPath(business)}/eliminados`, label: 'Ver eliminados' }].map((link) => render('partials/action-link', link));
      return page({
        title: `Productos de ${BUSINESS_NAMES[business]}`,
        context,
        business,
        body: render('pages/products', { businessName: BUSINESS_NAMES[business], actions: join(actions), notices: join(notices), list }),
      });
    },

    kindChoice(context: PageContext, business: PublicBusinessId, step: 'category' | 'detailsType'): SafeHtml {
      const options =
        step === 'category'
          ? [
              { href: `${productsPath(business)}/nuevo?categoria=platillo`, label: 'Platillo', description: 'Molote con precio unitario y por orden.' },
              { href: `${productsPath(business)}/nuevo?categoria=bebida`, label: 'Bebida', description: 'Bebida con icono y precio.' },
            ]
          : DETAILS_TYPES.map((type) => ({ href: `${productsPath(business)}/nuevo?categoria=platillo&tipo=${type.id}`, label: type.label, description: type.description }));
      return page({
        title: step === 'category' ? 'Nuevo producto' : 'Nuevo platillo',
        context,
        business,
        body: render('pages/kind-choice', {
          backHref: productsPath(business),
          title: step === 'category' ? 'Nuevo producto' : 'Nuevo platillo',
          intro: step === 'category' ? 'Elige qué vas a agregar.' : 'Elige cómo se muestra el detalle del platillo.',
          options: join(options.map((option) => render('partials/kind-option', option))),
        }),
      });
    },

    productForm(options: ProductFormView): SafeHtml {
      const { context, business, mode, fields, values, errors = {}, hidden, notices = [], conflict = false } = options;
      const known = new Set(fields.map((field) => field.name));
      const labelOf = new Map(fields.map((field) => [field.name, field.label]));
      // Resumen de errores (RF-16): enlaces a cada campo con error y, sin campo, el texto.
      const errorEntries = Object.entries(errors);
      const summary =
        errorEntries.length > 0
          ? notice({
              tone: 'error',
              title: 'No se guardó nada: revisa los campos marcados.',
              extra: render('partials/error-summary', {
                items: join(
                  errorEntries.map(([name, message]) =>
                    known.has(name)
                      ? render('partials/error-summary-item', { id: fieldId(name), label: labelOf.get(name) ?? name, message })
                      : render('partials/error-summary-text', { message }),
                  ),
                ),
              }),
            })
          : null;

      const fieldHtml = (field: ProductFormField): SafeHtml => renderField(field, values[field.name] ?? '', errors[field.name]);
      const sections: SafeHtml[] = [];
      const main = fields.filter((field) => field.group === 'main');
      sections.push(render('partials/fieldset', { legend: 'Datos del producto', intro: join([]), fields: join(main.map(fieldHtml)) }));
      const image = fields.filter((field) => field.group === 'image');
      if (image.length > 0) {
        sections.push(
          render('partials/fieldset', {
            legend: 'Imagen',
            intro: render('partials/section-intro', { text: 'La imagen debe existir en las imágenes publicadas de la landing (por ejemplo, /img/molotes/molotes-queso-oaxaca.jpg).' }),
            fields: join(image.map(fieldHtml)),
          }),
        );
      }
      for (const group of ['chips', 'variants'] as const) {
        const rows = fields.filter((field) => field.group === group);
        if (rows.length === 0) continue;
        const slots = [...new Set(rows.map((field) => field.slot ?? 0))].sort((a, b) => a - b);
        const singular = group === 'chips' ? 'Chip' : 'Variante';
        sections.push(
          render('partials/fieldset', {
            legend: group === 'chips' ? 'Chips' : 'Variantes',
            intro: render('partials/section-intro', {
              text: 'Deja vacías las filas que no uses. Cambia la posición para reordenar y marca «Quitar esta fila» para borrarla.',
            }),
            fields: join(
              slots.map((slot) =>
                render('partials/row-fieldset', { legend: `${singular} ${slot + 1}`, fields: join(rows.filter((field) => field.slot === slot).map(fieldHtml)) }),
              ),
            ),
          }),
        );
      }

      const buttons = conflict
        ? render('partials/overwrite')
        : render('partials/submit', { value: mode === 'create' ? 'create' : 'update', label: mode === 'create' ? 'Crear producto' : 'Guardar cambios' });
      const title = options.title;
      return page({
        title,
        ...(context ? { context } : {}),
        business,
        body: render('pages/product-form', {
          backHref: productsPath(business),
          title,
          notices: join([...(summary ? [summary] : []), ...notices]),
          action: options.action,
          csrfToken: options.csrfToken,
          hidden: join(Object.entries(hidden).map(([name, value]) => render('partials/hidden', { name, value }))),
          sections: join(sections),
          buttons,
        }),
      });
    },

    productDelete(context: PageContext, business: PublicBusinessId, product: AdminProduct, notices: SafeHtml[] = []): SafeHtml {
      return page({
        title: `Eliminar ${product.name}`,
        context,
        business,
        body: render('pages/product-delete', {
          backHref: productsPath(business),
          name: product.name,
          notices: join(notices),
          action: `${productPath(business, product.id)}/eliminar`,
          csrfToken: context.csrfToken,
          version: product.version,
        }),
      });
    },

    productsDeleted(context: PageContext, business: PublicBusinessId, products: AdminProduct[], notices: SafeHtml[] = []): SafeHtml {
      const rows = products.map((product) =>
        render('partials/deleted-row', {
          name: product.name,
          category: CATEGORY_SINGULAR[product.category] ?? product.category,
          deletedAt: displayDate(product.deletedAt),
          action: `${productPath(business, product.id)}/recuperar`,
          csrfToken: context.csrfToken,
          version: product.version,
        }),
      );
      return page({
        title: `Eliminados de ${BUSINESS_NAMES[business]}`,
        context,
        business,
        body: render('pages/products-deleted', {
          backHref: productsPath(business),
          businessName: BUSINESS_NAMES[business],
          notices: join(notices),
          content: rows.length > 0 ? render('partials/product-items', { rows: join(rows) }) : render('partials/empty', { text: 'No hay productos eliminados.' }),
        }),
      });
    },

    message({ title, notice: options, context, business, section, backHref = '/', backLabel = 'Volver al inicio' }: MessageView): SafeHtml {
      return page({ title, context, business, section, body: render('pages/message', { title, notice: notice(options), backHref, backLabel }) });
    },
  };

  function renderField(field: ProductFormField, value: string, error: string | undefined): SafeHtml {
    const id = fieldId(field.name);
    const helpText = helpFor(field);
    const describedBy = [helpText ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
    const common = {
      id,
      name: field.name,
      label: field.label,
      optional: field.optional ? ' (opcional)' : '',
      span: field.group === 'main' && (field.kind === 'imageSrc' || (field.max ?? 0) >= 200) ? 'md:col-span-2' : '',
      help: helpText ? render('partials/field-help', { id: `${id}-help`, text: helpText }) : join([]),
      error: error ? render('partials/field-error', { id: `${id}-error`, message: error }) : join([]),
    };
    const aria: [string, string | boolean | undefined][] = [
      ['aria-invalid', error ? 'true' : undefined],
      ['aria-describedby', describedBy || undefined],
    ];
    switch (field.kind) {
      case 'bool':
        return render('partials/field-checkbox', { ...common, checked: value === 'on' ? render('partials/checked') : join([]), attrs: attrs(aria) });
      case 'enum':
        return render('partials/field-select', {
          ...common,
          attrs: attrs(aria),
          options: join(
            [...(field.options ?? [])].map((option) => render('partials/option', { value: option, label: option, selected: option === value ? render('partials/selected') : join([]) })),
          ),
        });
      case 'text':
        if ((field.max ?? 0) >= 200) return render('partials/field-textarea', { ...common, value, attrs: attrs([['maxlength', field.max], ...aria]) });
        return render('partials/field-input', { ...common, value, attrs: attrs([['maxlength', field.max], ...aria]) });
      case 'price':
      case 'int':
        return render('partials/field-input', { ...common, value, attrs: attrs([['inputmode', field.kind === 'price' ? 'decimal' : 'numeric'], ...aria]) });
      default:
        return render('partials/field-input', { ...common, value, attrs: attrs([['autocomplete', 'off'], ...aria]) });
    }
  }
}

function helpFor(field: ProductFormField): string | null {
  switch (field.kind) {
    case 'price':
      return 'En pesos, por ejemplo 45 o 45.50.';
    case 'int':
      return field.min !== undefined && field.max !== undefined ? `Número entero de ${field.min} a ${field.max}.` : null;
    case 'text':
      return field.max ? `Máximo ${field.max} caracteres.` : null;
    case 'icon':
      return 'Nombre de un icono de Material Symbols (minúsculas, dígitos y "_").';
    case 'imageSrc':
      return 'Ruta que empieza por /img/.';
    default:
      return null;
  }
}

/** "$45" o "$45.50" a partir del precio en pesos de la API ("45.00"). */
export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function priceText(product: AdminProduct): string {
  if (product.detailsType === 'variants') return (product.variants ?? []).map((variant) => `${variant.label}: ${formatMoney(variant.price)}`).join(' · ');
  const price = formatMoney(product.price);
  if (product.orderPrice && product.orderQuantity) return `${price} c/u · ${formatMoney(product.orderPrice)} orden de ${product.orderQuantity}`;
  return product.priceUnit ? `${price} ${product.priceUnit}` : price;
}

/** Fecha ISO con desfase de la API -> "28/10/2026 13:45" (hora del negocio, la del propio texto). */
export function displayDate(iso: string | null): string {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso) : null;
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : '';
}

export interface ProductFormView {
  /** null cuando la API no responde y no se pudo comprobar la sesión: la página va sin cabecera. */
  context: PageContext | null;
  csrfToken: string;
  business: PublicBusinessId;
  mode: 'create' | 'edit';
  title: string;
  action: string;
  fields: readonly ProductFormField[];
  values: Record<string, string>;
  errors?: Record<string, string>;
  hidden: Record<string, string>;
  notices?: SafeHtml[];
  conflict?: boolean;
}

export interface MessageView {
  title: string;
  notice: NoticeOptions;
  context?: PageContext | undefined;
  business?: PublicBusinessId | undefined;
  section?: HeaderSection | undefined;
  backHref?: string;
  backLabel?: string;
}

export type Views = ReturnType<typeof createViews>;
export { NEW_TITLES, CATEGORY_SINGULAR, ACCOUNT_PATH, USERS_PATH };
