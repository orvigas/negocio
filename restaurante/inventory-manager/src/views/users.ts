import { USER_LIMITS, type AdminUser, type ManagedUser, type PublicBusinessId } from '@restaurante/contracts';
import type { Renderer, SafeHtml } from '@restaurante/web';

import type { NoticeOptions, PageContext, PageOptions } from './index.ts';

/**
 * Vistas de usuarios y "Mi cuenta" del admin nuevo (REQ-F-040, RF-3 a RF-10 y RF-17), con el sistema
 * visual P-4 de REQ-F-039. Sin JavaScript todo funciona (POST/redirect/GET); los errores van junto a su
 * campo (`aria-describedby`, `aria-invalid`) y en un resumen con enlaces, con texto y no solo color.
 * Las contraseñas nunca llevan `value`, y sin `minlength` ni `maxlength`: el navegador cuenta unidades
 * UTF-16, no caracteres (la regla la aplica la API).
 */

export const USERS_PATH = '/usuarios';
export const NEW_USER_PATH = `${USERS_PATH}/nuevo`;
export const ACCOUNT_PATH = '/cuenta';
export const userPath = (id: number): string => `${USERS_PATH}/${id}`;
export const userEditPath = (id: number): string => `${userPath(id)}/editar`;
export const userPasswordPath = (id: number): string => `${userPath(id)}/contrasena`;
export const userStatusPath = (id: number, active: boolean): string => `${userPath(id)}/${active ? 'desactivar' : 'reactivar'}`;

export const ROLE_LABELS: Readonly<Record<AdminUser['role'], string>> = Object.freeze({ admin: 'Administrador', editor: 'Editor' });
const BUSINESS_LABELS: Readonly<Record<PublicBusinessId, string>> = Object.freeze({ molotes: 'Molotes', birria: 'Birria El Muñeco' });
const BUSINESS_ORDER: readonly PublicBusinessId[] = ['molotes', 'birria'];

/** Nombre del campo de formulario de un negocio (casilla independiente; el cuerpo no admite repetidos). */
export const businessField = (business: PublicBusinessId): string => `business-${business}`;
export const BUSINESS_FIELDS: readonly string[] = BUSINESS_ORDER.map(businessField);

export interface UserFormValues {
  username: string;
  displayName: string;
  role: string;
  businesses: PublicBusinessId[];
}

export const EMPTY_USER_FORM: UserFormValues = Object.freeze({ username: '', displayName: '', role: 'editor', businesses: [] });

/** Lo escrito en el formulario (las contraseñas nunca se conservan). */
export function readUserForm(fields: Map<string, string>): UserFormValues {
  return {
    username: fields.get('username') ?? '',
    displayName: fields.get('displayName') ?? '',
    role: fields.get('role') ?? '',
    businesses: BUSINESS_ORDER.filter((business) => fields.get(businessField(business)) === 'on'),
  };
}

export const userFormValues = (user: ManagedUser): UserFormValues => ({ username: user.username, displayName: user.displayName, role: user.role, businesses: [...user.businesses] });

const businessesText = (role: string, businesses: readonly PublicBusinessId[]): string =>
  role === 'admin' ? 'Todos' : businesses.length > 0 ? businesses.map((business) => BUSINESS_LABELS[business]).join(', ') : 'Ninguno';

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  username: 'Usuario de acceso',
  displayName: 'Nombre visible',
  role: 'Rol',
  businesses: 'Negocios',
  password: 'Contraseña nueva',
  passwordConfirmation: 'Repite la contraseña nueva',
  currentPassword: 'Contraseña actual',
});
/** Ancla de cada campo (los negocios: su grupo). */
const FIELD_IDS: Readonly<Record<string, string>> = Object.freeze({
  username: 'f-username',
  displayName: 'f-displayName',
  role: 'f-role',
  businesses: 'f-businesses',
  password: 'f-password',
  passwordConfirmation: 'f-passwordConfirmation',
  currentPassword: 'f-currentPassword',
});

const PASSWORD_HELP = `Entre ${USER_LIMITS.passwordMin} y ${USER_LIMITS.passwordMax} caracteres. Una frase larga es más segura y fácil de recordar.`;

const statusButton = (active: boolean) =>
  active
    ? { label: 'Desactivar', busyText: 'Desactivando…', buttonModifier: 'button--danger', buttonClass: 'border-error text-error hover:bg-error/10' }
    : { label: 'Reactivar', busyText: 'Reactivando…', buttonModifier: 'button--secondary', buttonClass: 'border-adobo text-crema hover:bg-adobo/15' };

const stateOf = (active: boolean) =>
  active ? { state: 'Activo', stateModifier: 'active', stateClass: 'text-maiz' } : { state: 'Desactivado', stateModifier: 'inactive', stateClass: 'text-error' };

export interface UserViewHelpers {
  render: Renderer['render'];
  join: Renderer['join'];
  attrs: (entries: [string, string | number | boolean | undefined][]) => SafeHtml;
  page: (options: PageOptions) => SafeHtml;
  notice: (options: NoticeOptions) => SafeHtml;
  /** Fecha ISO de la API -> texto en la hora del negocio. */
  displayDate: (iso: string | null) => string;
}

export interface UserFormView {
  /** null cuando la API no responde y no se pudo comprobar la sesión: la página va sin cabecera. */
  context: PageContext | null;
  csrfToken: string;
  mode: 'create' | 'edit';
  /** Usuario editado (estado y enlace a la contraseña; solo al pintar la edición con sus datos). */
  user?: ManagedUser | undefined;
  id?: number | undefined;
  values: UserFormValues;
  errors?: Record<string, string>;
  notices?: SafeHtml[];
}

export function createUserViews({ render, join, attrs, page, notice, displayDate }: UserViewHelpers) {
  function summary(errors: Record<string, string>): SafeHtml[] {
    const entries = Object.entries(errors);
    if (entries.length === 0) return [];
    return [
      notice({
        tone: 'error',
        title: 'No se guardó nada: revisa los campos marcados.',
        extra: render('partials/error-summary', {
          items: join(
            entries.map(([name, message]) =>
              FIELD_IDS[name]
                ? render('partials/error-summary-item', { id: FIELD_IDS[name], label: FIELD_LABELS[name] ?? name, message })
                : render('partials/error-summary-text', { message }),
            ),
          ),
        }),
      }),
    ];
  }

  function describe(name: string, help: string | null, error: string | undefined) {
    const id = FIELD_IDS[name] ?? `f-${name}`;
    const describedBy = [help ? `${id}-help` : undefined, error ? `${id}-error` : undefined].filter(Boolean).join(' ');
    return {
      id,
      help: help ? render('partials/field-help', { id: `${id}-help`, text: help }) : join([]),
      error: error ? render('partials/field-error', { id: `${id}-error`, message: error }) : join([]),
      aria: [
        ['aria-invalid', error ? 'true' : undefined],
        ['aria-describedby', describedBy || undefined],
      ] as [string, string | undefined][],
    };
  }

  function textField(name: 'username' | 'displayName', value: string, error: string | undefined, max: number): SafeHtml {
    const field = describe(name, `Máximo ${max} caracteres.`, error);
    // `autocomplete="off"`: el navegador no debe rellenar aquí el usuario del administrador que crea la cuenta.
    return render('partials/field-input', { ...field, name, label: FIELD_LABELS[name] ?? name, optional: '', span: '', value, attrs: attrs([['autocomplete', 'off'], ['spellcheck', 'false'], ...field.aria]) });
  }

  function passwordField(name: 'password' | 'passwordConfirmation' | 'currentPassword', error: string | undefined): SafeHtml {
    const field = describe(name, name === 'password' ? PASSWORD_HELP : null, error);
    const autocomplete = name === 'currentPassword' ? 'current-password' : 'new-password';
    return render('partials/field-password', { ...field, name, label: FIELD_LABELS[name] ?? name, attrs: attrs([['autocomplete', autocomplete], ...field.aria]) });
  }

  function passwordSection(errors: Record<string, string>, { current = false, legend = 'Contraseña' }: { current?: boolean; legend?: string } = {}): SafeHtml {
    return render('partials/user-fieldset', {
      legend,
      attrs: join([]),
      intro: join([]),
      fields: join([...(current ? [passwordField('currentPassword', errors.currentPassword)] : []), passwordField('password', errors.password), passwordField('passwordConfirmation', errors.passwordConfirmation)]),
    });
  }

  function dataSection(values: UserFormValues, errors: Record<string, string>): SafeHtml {
    const role = describe('role', 'El administrador tiene todos los negocios y gestiona los usuarios.', errors.role);
    const roleSelect = render('partials/field-select', {
      ...role,
      name: 'role',
      label: FIELD_LABELS.role ?? 'Rol',
      span: '',
      attrs: attrs(role.aria),
      options: join(
        (['editor', 'admin'] as const).map((value) =>
          render('partials/option', { value, label: ROLE_LABELS[value], selected: values.role === value ? render('partials/selected') : join([]) }),
        ),
      ),
    });
    const businesses = describe('businesses', 'Solo para el editor: marca al menos uno.', errors.businesses);
    const checkboxes = BUSINESS_ORDER.map((business) =>
      render('partials/field-checkbox', {
        id: `f-${businessField(business)}`,
        name: businessField(business),
        label: BUSINESS_LABELS[business],
        span: '',
        help: join([]),
        error: join([]),
        checked: values.businesses.includes(business) ? render('partials/checked') : join([]),
        attrs: join([]),
      }),
    );
    return join([
      render('partials/user-fieldset', {
        legend: 'Datos del usuario',
        attrs: join([]),
        intro: join([]),
        fields: join([textField('username', values.username, errors.username, USER_LIMITS.usernameMax), textField('displayName', values.displayName, errors.displayName, USER_LIMITS.displayNameMax), roleSelect]),
      }),
      render('partials/user-fieldset', {
        legend: 'Negocios',
        attrs: attrs([['id', businesses.id], ['tabindex', '-1'], ...businesses.aria]),
        intro: join([businesses.help, businesses.error]),
        fields: join(checkboxes),
      }),
    ]);
  }

  function statusForm(user: ManagedUser, csrfToken: string): SafeHtml {
    return render('partials/status-form', { action: userStatusPath(user.id, user.active), csrfToken, displayName: user.displayName, ...statusButton(user.active) });
  }

  return {
    usersList(context: PageContext, users: ManagedUser[], notices: SafeHtml[] = []): SafeHtml {
      const rows = users.map((user) =>
        render('partials/user-row', {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: ROLE_LABELS[user.role],
          businesses: businessesText(user.role, user.businesses),
          lastLogin: user.lastLoginAt ? displayDate(user.lastLoginAt) : 'Nunca',
          editHref: userEditPath(user.id),
          passwordHref: userPasswordPath(user.id),
          statusForm: statusForm(user, context.csrfToken),
          ...stateOf(user.active),
        }),
      );
      return page({
        title: 'Usuarios',
        context,
        section: 'users',
        body: render('pages/users', {
          actions: render('partials/action-link', { href: NEW_USER_PATH, label: 'Nuevo usuario' }),
          notices: join(notices),
          rows: rows.length > 0 ? join(rows) : render('partials/empty', { text: 'No hay usuarios.' }),
        }),
      });
    },

    userForm({ context, csrfToken, mode, user, id, values, errors = {}, notices = [] }: UserFormView): SafeHtml {
      const title = mode === 'create' ? 'Nuevo usuario' : `Editar a ${user?.displayName ?? (values.displayName.trim() || 'usuario')}`;
      const sections = [dataSection(values, errors), ...(mode === 'create' ? [passwordSection(errors)] : [])];
      const extra = user
        ? render('partials/user-status-panel', {
            ...stateOf(user.active),
            hint: user.active ? 'Desactivarlo cierra sus sesiones y le impide entrar en los dos admins.' : 'Reactivarlo le permite volver a entrar.',
            statusForm: statusForm(user, csrfToken),
            passwordHref: userPasswordPath(user.id),
          })
        : join([]);
      return page({
        title,
        ...(context ? { context } : {}),
        section: 'users',
        body: render('pages/user-form', {
          title,
          notices: join([...summary(errors), ...notices]),
          action: mode === 'create' ? USERS_PATH : userPath(user?.id ?? id ?? 0),
          csrfToken,
          sections: join(sections),
          submit: render('partials/form-submit', { label: mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }),
          extra,
        }),
      });
    },

    userPassword({ context, csrfToken, id, name, errors = {}, notices = [] }: { context: PageContext | null; csrfToken: string; id: number; name: string | null; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const title = name ? `Restablecer la contraseña de ${name}` : 'Restablecer la contraseña';
      return page({
        title,
        ...(context ? { context } : {}),
        section: 'users',
        body: render('pages/user-password', {
          title,
          notices: join([...summary(errors), ...notices]),
          action: userPasswordPath(id),
          csrfToken,
          sections: passwordSection(errors, { legend: 'Contraseña nueva' }),
          submit: render('partials/form-submit', { label: 'Restablecer la contraseña' }),
        }),
      });
    },

    account({ context, csrfToken, errors = {}, notices = [] }: { context: PageContext | null; csrfToken: string; errors?: Record<string, string>; notices?: SafeHtml[] }): SafeHtml {
      const user = context?.user;
      return page({
        title: 'Mi cuenta',
        ...(context ? { context } : {}),
        section: 'account',
        body: render('pages/account', {
          name: user?.name ?? '',
          role: user ? ROLE_LABELS[user.role] : '',
          businesses: user ? businessesText(user.role, user.businesses) : '',
          notices: join([...summary(errors), ...notices]),
          csrfToken,
          sections: passwordSection(errors, { current: true, legend: 'Cambiar la contraseña' }),
          submit: render('partials/form-submit', { label: 'Cambiar la contraseña' }),
        }),
      });
    },
  };
}
