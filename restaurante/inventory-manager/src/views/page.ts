import type { AdminPage, PageFormField, ProductFormField, PublicBusinessId } from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { NoticeOptions, PageContext, PageOptions } from './index.ts';

/**
 * Sección "Página" del admin nuevo (REQ-F-044, RF-6): hero, texto destacado y promoción de un negocio.
 * El formulario se pinta con los campos que describe la API, sin conocer el esquema. Todo funciona sin
 * JavaScript. "No disponible" (RF-4) es un estado, no un error: sin formulario ni acciones.
 */

export const pagePath = (business: PublicBusinessId): string => `/${business}/pagina`;
export const pageRestorePath = (business: PublicBusinessId): string => `${pagePath(business)}/restaurar`;

/** Grupo de los campos sin grupo y de lo escrito cuando no se conocen los campos (ver `postedFields`). */
export const DEFAULT_GROUP = 'Contenido';

const fieldId = (name: string): string => `f-${name.replaceAll('.', '-')}`;

export interface PageFormView {
  /** null cuando la API no responde y no se pudo comprobar la sesión: la página va sin cabecera. */
  context: PageContext | null;
  csrfToken: string;
  business: PublicBusinessId;
  fields: readonly PageFormField[];
  values: Record<string, string>;
  version: string;
  /** Versión leída de la API; sin ella, no hay "Último cambio" ni "Restaurar" (lo escrito se volvió a pintar). */
  current?: AdminPage | undefined;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
  /** Tras un 409: "Guardar mis cambios de todos modos" y "Descartar". */
  conflict?: boolean;
}

interface PageViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  renderField: (field: ProductFormField, value: string, error: string | undefined) => SafeHtml;
  errorSummary: (errors: Record<string, string>, fields: readonly { name: string; label: string }[]) => SafeHtml | null;
  displayDate: (iso: string | null) => string;
  businessNames: Readonly<Record<PublicBusinessId, string>>;
}

export function createPageViews({ render, join, page, notice, renderField, errorSummary, displayDate, businessNames }: PageViewHelpers) {
  /** "Ana, el 05/11/2026 10:00"; `who`, si la versión no tiene autor. */
  function changeText({ updatedBy, updatedAt }: Pick<AdminPage, 'updatedBy' | 'updatedAt'>, who: string): string {
    const date = displayDate(updatedAt);
    return `${updatedBy ?? who}${date ? `, el ${date}` : ''}`;
  }

  function lastChange(current: AdminPage | undefined): SafeHtml {
    if (!current) return join([]);
    const text = current.updatedBy === null && current.updatedAt === null ? 'sin registrar.' : `${changeText(current, 'el sistema')}.`;
    return render('partials/page-last-change', { text });
  }

  function field(entry: PageFormField, value: string, error: string | undefined): SafeHtml {
    if (entry.kind === 'text' && entry.max === undefined) {
      // Sin descriptor (ver `postedFields`): caja de texto, para no perder saltos de línea.
      return render('partials/field-textarea', { id: fieldId(entry.name), name: entry.name, label: entry.label, optional: '', value, attrs: join([]), help: join([]), error: join([]) });
    }
    return renderField({ ...entry, group: 'main' }, value, error);
  }

  function sections(fields: readonly PageFormField[], values: Record<string, string>, errors: Record<string, string>): SafeHtml {
    const groups = [...new Set(fields.map((entry) => entry.group))];
    return join(
      groups.map((group) =>
        render('partials/fieldset', {
          legend: group || DEFAULT_GROUP,
          intro: join([]),
          fields: join(fields.filter((entry) => entry.group === group).map((entry) => field(entry, values[entry.name] ?? '', errors[entry.name]))),
        }),
      ),
    );
  }

  return {
    changeText,

    pageForm({ context, csrfToken, business, fields, values, version, current, errors = {}, notices = [], conflict = false }: PageFormView): SafeHtml {
      const summary = errorSummary(errors, fields);
      const hasRestore = current?.hasPrevious === true;
      return page({
        title: `Página de ${businessNames[business]}`,
        ...(context ? { context } : {}),
        business,
        section: 'page',
        body: render('pages/page-form', {
          businessName: businessNames[business],
          lastChange: lastChange(current),
          notices: join([...(summary ? [summary] : []), ...notices]),
          action: pagePath(business),
          csrfToken,
          version,
          sections: sections(fields, values, errors),
          buttons: conflict
            ? join([render('partials/submit', { value: 'overwrite', label: 'Guardar mis cambios de todos modos' }), render('partials/page-discard', { href: pagePath(business) })])
            : render('partials/submit', { value: 'save', label: 'Guardar cambios' }),
          restore: hasRestore ? render('partials/page-restore-link', { href: pageRestorePath(business) }) : join([]),
        }),
      });
    },

    /** Aviso de RF-4 y CA-18: la edición sigue en `/admin`. Sin formulario ni acciones. */
    pageClosed(context: PageContext, business: PublicBusinessId): SafeHtml {
      return page({
        title: `Página de ${businessNames[business]}`,
        context,
        business,
        section: 'page',
        body: render('pages/page-closed', {
          businessName: businessNames[business],
          notice: notice({
            tone: 'info',
            title: 'La edición de esta pantalla aún no está activa.',
            paragraphs: ['Por ahora, los cambios de la página se hacen en el /admin actual. Los datos no se han perdido.'],
          }),
        }),
      });
    },

    /** Confirmación de restaurar (CA-12); sin versión anterior, solo lo explica. */
    pageRestore(context: PageContext, business: PublicBusinessId, current: AdminPage, notices: SafeHtml[] = []): SafeHtml {
      return page({
        title: `Restaurar la página de ${businessNames[business]}`,
        context,
        business,
        section: 'page',
        body: render('pages/page-restore', {
          backHref: pagePath(business),
          lastChange: lastChange(current),
          notices: join(notices),
          content: current.hasPrevious
            ? render('partials/page-restore-form', { action: pageRestorePath(business), csrfToken: context.csrfToken, version: current.version, backHref: pagePath(business) })
            : render('partials/empty', { text: 'No hay una versión anterior que restaurar.' }),
        }),
      });
    },
  };
}
