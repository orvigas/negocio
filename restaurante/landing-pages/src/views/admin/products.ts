import type { BusinessId } from '../../config/businesses.ts';
import type { ProductConflictInfo, ProductView } from '../../repositories/product-repository.ts';
import { productFormLeaves, type FormLeaf } from '../../services/product-form.ts';
import { categoriesOf, type DetailsType, type FieldErrors, type ProductCategory, type ProductKind } from '../../services/product-schema.ts';
import { formatDisplayDate, toZonedIsoString } from '../../utils/datetime.ts';
import { formatPesos } from '../landings/shared.ts';
import type { Renderer, SafeHtml } from '../render.ts';
import {
  ADMIN_CLASSES as CLASSES,
  ADMIN_NOTICE_TONES as NOTICE_TONES,
  adminAttrs as attrs,
  adminFieldError as fieldError,
  adminFieldId as fieldId,
  adminPage,
  adminPath,
  businessName,
  renderAdminLeaf,
  renderAdminNotice as renderNotice,
  type AdminPageContext,
} from './index.ts';

/**
 * Vistas de la administración de productos (REQ-F-008, RF-6 y DT-12). Sin diseño fuente (como
 * el resto de /admin): HTML semántico, Tailwind y BEM, y sin JavaScript. Todas las acciones son
 * formularios con POST-redirect-GET; los botones llevan el nombre del producto para los lectores
 * de pantalla.
 */

export const productsPath = (businessId: BusinessId): string => `${adminPath(businessId)}/productos`;
export const productPath = (businessId: BusinessId, id: number): string => `${productsPath(businessId)}/${id}`;
export const deletedProductsPath = (businessId: BusinessId): string => `${productsPath(businessId)}/eliminados`;
export const newProductPath = (businessId: BusinessId, category: ProductCategory, detailsType?: DetailsType): string =>
  `${productsPath(businessId)}/nuevo?categoria=${category}${detailsType ? `&tipo=${detailsType}` : ''}`;

const CATEGORY_TITLES: Readonly<Record<ProductCategory, string>> = Object.freeze({ platillo: 'Platillos', bebida: 'Bebidas' });
const CATEGORY_SINGULAR: Readonly<Record<ProductCategory, string>> = Object.freeze({ platillo: 'platillo', bebida: 'bebida' });
/** Título de la página de alta, con la concordancia de género de cada categoría. */
const NEW_TITLES: Readonly<Record<ProductCategory, string>> = Object.freeze({ platillo: 'Nuevo platillo', bebida: 'Nueva bebida' });

export const DETAILS_TYPE_TEXT: Readonly<Record<DetailsType, { label: string; description: string }>> = Object.freeze({
  chips: { label: 'Chips', description: 'precio propio y una lista de etiquetas (por ejemplo, lo que incluye).' },
  portion: { label: 'Porción', description: 'precio propio, porción y un extra.' },
  variants: { label: 'Variantes', description: 'de 1 a 6 opciones con su propio precio y descripción (el cliente elige una).' },
});

/** Precio legible en la lista. */
function priceText(product: ProductView): string {
  if (product.detailsType === 'variants') return product.variants.map((variant) => `${variant.label}: ${formatPesos(variant.priceCents)}`).join(' · ');
  const price = product.priceCents === null ? '' : formatPesos(product.priceCents);
  if (product.orderPriceCents !== null && product.orderQuantity !== null) {
    return `${price} c/u · ${formatPesos(product.orderPriceCents)} orden de ${product.orderQuantity}`;
  }
  return product.priceUnit ? `${price} ${product.priceUnit}` : price;
}

/** Lista de productos de la página de un negocio. */
export function renderProductsSection(
  renderer: Renderer,
  { businessId, products, csrfToken }: { businessId: BusinessId; products: ProductView[]; csrfToken: string },
): SafeHtml {
  const categories = categoriesOf(businessId);
  const tables = categories.map((category) => {
    const items = products.filter((product) => product.category === category);
    const id = `products-${category}`;
    const moveForm = (product: ProductView, direction: 'subir' | 'bajar', label: string) =>
      renderer.render('admin/partials/product-move-form', {
        action: `${productPath(businessId, product.id)}/${direction}`,
        csrfToken,
        version: product.version,
        label,
        name: product.name,
        buttonClass: CLASSES.secondaryButton,
      });
    const rows = items.map((product, index) =>
      renderer.render('admin/partials/product-row', {
        position: index + 1,
        name: product.name,
        price: priceText(product),
        available: product.available ? 'Sí' : 'No',
        editHref: productPath(businessId, product.id),
        deleteHref: `${productPath(businessId, product.id)}/eliminar`,
        moves: renderer.join([
          ...(index > 0 ? [moveForm(product, 'subir', 'Subir')] : []),
          ...(index < items.length - 1 ? [moveForm(product, 'bajar', 'Bajar')] : []),
        ]),
      }),
    );
    return renderer.render('admin/partials/product-table', {
      id,
      title: CATEGORY_TITLES[category],
      content:
        rows.length > 0
          ? renderer.render('admin/partials/product-table-rows', { labelledBy: id, rows: renderer.join(rows) })
          : renderer.render('admin/partials/product-empty', { text: `No hay ${CATEGORY_TITLES[category].toLowerCase()} activos.` }),
    });
  });
  const link = (href: string, label: string) => renderer.render('admin/partials/product-action-link', { href, label, buttonClass: CLASSES.secondaryButton });
  return renderer.render('admin/partials/products-section', {
    actions: renderer.join([
      ...categories.map((category) =>
        link(businessId === 'birria' ? `${productsPath(businessId)}/nuevo` : newProductPath(businessId, category), `Agregar ${CATEGORY_SINGULAR[category]}`),
      ),
      link(deletedProductsPath(businessId), 'Ver productos eliminados'),
    ]),
    tables: renderer.join(tables),
  });
}

// --- Formulario de producto ----------------------------------------------------------

export interface ProductFormOptions extends AdminPageContext {
  businessId: BusinessId;
  timezone: string;
  mode: 'create' | 'edit';
  kind: ProductKind;
  /** Producto vigente (edición). */
  product?: ProductView | undefined;
  values: Record<string, string>;
  errors?: FieldErrors | undefined;
  conflict?: ProductConflictInfo | undefined;
}

interface SummaryItem {
  id: string;
  label: string;
  message: string;
}

const ROW_TITLES = Object.freeze({ chips: 'Chip', variants: 'Variante' });

function conflictDetail(conflict: ProductConflictInfo, timezone: string): string {
  const who = conflict.updatedBy ?? 'Alguien';
  return `${who} lo cambió el ${formatDisplayDate(toZonedIsoString(conflict.updatedAt, timezone), timezone)}.`;
}

export function renderProductForm(renderer: Renderer, options: ProductFormOptions): SafeHtml {
  const { businessId, mode, kind, product, values, errors = {}, conflict, viewer, csrfToken, faviconBusinessId, timezone } = options;
  const leaves = productFormLeaves(kind, { withAvailable: mode === 'edit' });
  const summary: SummaryItem[] = [];

  const leafHtml = (leaf: FormLeaf, context: string): SafeHtml => {
    const error = errors[leaf.name];
    if (error) summary.push({ id: fieldId(leaf.name), label: `${context} › ${leaf.node.label}`, message: error });
    return renderAdminLeaf(renderer, leaf.node, { name: leaf.name, label: leaf.node.label, value: values[leaf.name] ?? '', error });
  };

  const sections: SafeHtml[] = [];
  const section = (legend: string, group: FormLeaf['group']) =>
    renderer.render('admin/partials/fieldset-section', {
      legend,
      content: renderer.join(leaves.filter((leaf) => leaf.group === group).map((leaf) => leafHtml(leaf, legend))),
    });
  sections.push(section('Datos del producto', 'main'));
  if (leaves.some((leaf) => leaf.group === 'image')) sections.push(section('Imagen', 'image'));

  for (const rows of ['chips', 'variants'] as const) {
    const rowLeaves = leaves.filter((leaf) => leaf.group === rows);
    if (rowLeaves.length === 0) continue;
    const legend = rows === 'chips' ? 'Chips' : 'Variantes';
    const groupError = errors[rows];
    if (groupError) summary.push({ id: fieldId(rows), label: legend, message: groupError });
    const slots = [...new Set(rowLeaves.map((leaf) => leaf.slot ?? 0))];
    const hintId = `${fieldId(rows)}-hint`;
    sections.push(
      renderer.render('admin/partials/product-rows', {
        legend,
        hintId,
        hint: `De 1 a 6. Las filas vacías se ignoran; usa "Posición" para ordenarlas y "Quitar esta fila" para eliminar una.`,
        attrs: attrs(renderer, [
          ['id', fieldId(rows)],
          ['tabindex', '-1'],
          ['aria-describedby', [hintId, groupError ? `${fieldId(rows)}-error` : undefined].filter(Boolean).join(' ')],
        ]),
        error: fieldError(renderer, fieldId(rows), groupError),
        content: renderer.join(
          slots.map((slot) => {
            const title = `${ROW_TITLES[rows]} ${slot + 1}`;
            return renderer.render('admin/partials/fieldset', {
              legend: title,
              content: renderer.join(rowLeaves.filter((leaf) => leaf.slot === slot).map((leaf) => leafHtml(leaf, title))),
            });
          }),
        ),
      }),
    );
  }

  const notices: SafeHtml[] = [];
  const general = errors[''];
  if (general) notices.push(renderNotice(renderer, { tone: 'error', role: 'alert', title: general }));
  const others = Object.keys(errors).filter((key) => key !== '').length;
  if (others > 0) {
    notices.push(
      renderNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: `No se guardó nada: revisa ${others === 1 ? 'el campo marcado' : `los ${others} campos marcados`}.`,
        extra: renderer.render('admin/partials/error-list', { items: renderer.renderEach('admin/partials/error-summary-item', summary) }),
      }),
    );
  }

  const hidden =
    mode === 'create'
      ? [
          renderer.render('admin/partials/field-hidden', { name: 'category', value: kind.category }),
          ...(kind.detailsType ? [renderer.render('admin/partials/field-hidden', { name: 'detailsType', value: kind.detailsType })] : []),
        ]
      : [renderer.render('admin/partials/field-hidden', { name: 'version', value: conflict ? conflict.version : (product?.version ?? 0) })];

  const backHref = adminPath(businessId);
  const editHref = product ? productPath(businessId, product.id) : backHref;
  const submit = conflict
    ? renderer.join([])
    : renderer.render('admin/partials/product-submit', {
        authorName: viewer.displayName,
        action: mode === 'create' ? 'create' : 'update',
        label: mode === 'create' ? 'Crear producto' : 'Guardar producto',
        cancelHref: backHref,
        primaryButtonClass: CLASSES.primaryButton,
        secondaryButtonClass: CLASSES.secondaryButton,
      });
  const conflictNotice = conflict
    ? renderer.render('admin/partials/product-conflict', {
        toneClass: NOTICE_TONES.warning,
        detail: conflictDetail(conflict, timezone),
        keep: 'Tus cambios siguen en el formulario.',
        action: 'overwrite_after_conflict',
        confirmLabel: 'Guardar mis cambios de todos modos',
        discardHref: editHref,
        discardLabel: 'Descartar y cargar la versión actual',
        primaryButtonClass: CLASSES.primaryButton,
        secondaryButtonClass: CLASSES.secondaryButton,
      })
    : renderer.join([]);

  const kindText = kind.detailsType ? ` con ${DETAILS_TYPE_TEXT[kind.detailsType].label.toLowerCase()}` : '';
  const title = mode === 'create' ? `${NEW_TITLES[kind.category]}${kindText}` : `Editar «${product?.name ?? ''}»`;
  const subtitle =
    mode === 'create'
      ? 'Se crea al final de su lista y no disponible; el identificador se genera a partir del nombre.'
      : `Identificador: ${product?.slug ?? ''}. La categoría y el tipo de detalle no se pueden cambiar.`;
  return adminPage(renderer, {
    title,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/product-form', {
      title,
      subtitle,
      backHref,
      businessName: businessName(businessId),
      notices: renderer.join(notices),
      action: mode === 'create' ? productsPath(businessId) : editHref,
      csrfToken,
      hidden: renderer.join(hidden),
      conflict: conflictNotice,
      sections: renderer.join(sections),
      submit,
    }),
  });
}

/** Birria: elegir el tipo de detalle antes de crear el platillo (D-14). */
export function renderProductTypeChoice(renderer: Renderer, options: AdminPageContext & { businessId: BusinessId }): SafeHtml {
  const { businessId, viewer, csrfToken, faviconBusinessId } = options;
  const title = 'Nuevo platillo';
  return adminPage(renderer, {
    title,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/product-type', {
      title,
      backHref: adminPath(businessId),
      businessName: businessName(businessId),
      action: `${productsPath(businessId)}/nuevo`,
      primaryButtonClass: CLASSES.primaryButton,
      options: renderer.join(
        (Object.entries(DETAILS_TYPE_TEXT) as [DetailsType, { label: string; description: string }][]).map(([value, text], index) =>
          renderer.render('admin/partials/product-type-option', {
            id: `tipo-${value}`,
            value,
            label: text.label,
            description: text.description,
            checked: attrs(renderer, [['checked', index === 0]]),
          }),
        ),
      ),
    }),
  });
}

/** Confirmación de "Eliminar" (con el aviso de conflicto si la versión cambió). */
export function renderProductDelete(
  renderer: Renderer,
  options: AdminPageContext & { businessId: BusinessId; timezone: string; product: ProductView; conflict?: ProductConflictInfo | undefined },
): SafeHtml {
  const { businessId, product, conflict, timezone, viewer, csrfToken, faviconBusinessId } = options;
  const title = 'Eliminar producto';
  const notices = conflict
    ? renderNotice(renderer, {
        tone: 'warning',
        role: 'alert',
        title: 'El producto cambió mientras lo revisabas',
        paragraphs: [`${conflictDetail(conflict, timezone)} No se eliminó nada. Puedes eliminarlo de todos modos o ver la versión actual.`],
      })
    : renderer.join([]);
  return adminPage(renderer, {
    title,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/product-delete', {
      title,
      backHref: adminPath(businessId),
      businessName: businessName(businessId),
      notices,
      name: product.name,
      action: `${productPath(businessId, product.id)}/eliminar`,
      csrfToken,
      version: conflict ? conflict.version : product.version,
      confirmLabel: conflict ? 'Eliminar de todos modos' : 'Sí, eliminar',
      cancelHref: conflict ? productPath(businessId, product.id) : adminPath(businessId),
      cancelLabel: conflict ? 'Cancelar y ver la versión actual' : 'Cancelar',
      primaryButtonClass: CLASSES.primaryButton,
      secondaryButtonClass: CLASSES.secondaryButton,
    }),
  });
}

/** Lista "Productos eliminados" con la acción "Recuperar" (D-12). */
export function renderProductsDeleted(
  renderer: Renderer,
  options: AdminPageContext & { businessId: BusinessId; timezone: string; products: ProductView[]; problem?: string | undefined },
): SafeHtml {
  const { businessId, products, timezone, problem, viewer, csrfToken, faviconBusinessId } = options;
  const title = `Productos eliminados de ${businessName(businessId)}`;
  const rows = products.map((product) =>
    renderer.render('admin/partials/product-deleted-row', {
      name: product.name,
      category: CATEGORY_SINGULAR[product.category],
      deletedAt: product.deletedAt ? formatDisplayDate(toZonedIsoString(product.deletedAt, timezone), timezone) : '',
      action: `${productPath(businessId, product.id)}/recuperar`,
      csrfToken,
      version: product.version,
      buttonClass: CLASSES.secondaryButton,
    }),
  );
  return adminPage(renderer, {
    title,
    viewer,
    csrfToken,
    faviconBusinessId,
    current: businessId,
    body: renderer.render('admin/products-deleted', {
      title,
      backHref: adminPath(businessId),
      businessName: businessName(businessId),
      notices: problem ? renderNotice(renderer, { tone: 'error', role: 'alert', title: problem }) : renderer.join([]),
      content:
        rows.length > 0
          ? renderer.render('admin/partials/product-deleted-table', { rows: renderer.join(rows) })
          : renderer.render('admin/partials/product-empty', { text: 'No hay productos eliminados.' }),
    }),
  });
}
