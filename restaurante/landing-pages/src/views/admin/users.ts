import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLES,
  ROLE_LABELS,
  USERNAME_MAX_LENGTH,
  businessField,
  type UserFormErrors,
  type UserFormValues,
  type UserRecord,
} from '@restaurante/core/identity';

import { formatDisplayDate } from '../../utils/datetime.ts';
import type { Renderer, SafeHtml } from '../render.ts';
import {
  ACCOUNT_PATH,
  ADMIN_CLASSES,
  USERS_PATH,
  adminAttrs,
  adminFieldError,
  adminInvalidAttrs,
  adminPage,
  businessName,
  renderAdminNotice,
  type AdminPageContext,
} from './index.ts';

/**
 * Vistas de la gestión de usuarios y de "Mi cuenta" (REQ-F-007, R-8 y R-9). Sin diseño fuente
 * (C-8 de REQ-F-001): mismos patrones que el resto de /admin. Formularios HTML nativos, sin
 * JavaScript; los errores aparecen junto a cada campo y en un resumen con role="alert".
 * Las contraseñas nunca se vuelven a pintar.
 */

export const userPath = (id: number): string => `${USERS_PATH}/${id}`;
export const userPasswordPath = (id: number): string => `${userPath(id)}/contrasena`;
export const userStatusPath = (id: number, active: boolean): string => `${userPath(id)}/${active ? 'desactivar' : 'reactivar'}`;
export const NEW_USER_PATH = `${USERS_PATH}/nuevo`;

export const USER_SUCCESS_MESSAGES = Object.freeze({
  created: 'Usuario creado. Ya puede entrar con su contraseña.',
  updated: 'Cambios guardados. Si cambió el rol o los negocios, su sesión se cerró.',
  deactivated: 'Usuario desactivado. Sus sesiones abiertas se cerraron.',
  reactivated: 'Usuario reactivado. Ya puede volver a entrar.',
  password_reset: 'Contraseña restablecida. Sus sesiones abiertas se cerraron.',
});

export const ACCOUNT_SUCCESS_MESSAGES = Object.freeze({
  password_change: 'Contraseña cambiada. Se cerraron tus otras sesiones.',
});

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  username: 'Usuario de acceso',
  displayName: 'Nombre visible',
  role: 'Rol',
  businesses: 'Negocios del editor',
  password: 'Contraseña nueva',
  passwordConfirmation: 'Repite la contraseña nueva',
  currentPassword: 'Contraseña actual',
});

const fieldIdOf = (name: string): string => `u-${name}`;

/** Errores por campo (los ausentes no tienen error). */
export type FieldErrors = Readonly<Partial<Record<string, string>>>;

interface FieldSpec {
  name: string;
  type: 'text' | 'password';
  value?: string;
  autocomplete: string;
  maxLength: number;
  minLength?: number;
  hint?: string;
}

function renderTextField(renderer: Renderer, spec: FieldSpec, errors: FieldErrors): SafeHtml {
  const id = fieldIdOf(spec.name);
  const error = errors[spec.name];
  const hintId = spec.hint ? `${id}-hint` : undefined;
  return renderer.render('admin/partials/field-text', {
    id,
    name: spec.name,
    type: spec.type,
    label: FIELD_LABELS[spec.name] ?? spec.name,
    // Las contraseñas nunca se vuelven a pintar.
    value: spec.type === 'password' ? '' : (spec.value ?? ''),
    inputClass: ADMIN_CLASSES.input,
    hint: spec.hint ? renderer.render('admin/partials/field-hint', { id: hintId, text: spec.hint }) : renderer.join([]),
    error: adminFieldError(renderer, id, error),
    attrs: adminAttrs(renderer, [
      ['autocomplete', spec.autocomplete],
      ['maxlength', String(spec.maxLength)],
      ['minlength', spec.minLength === undefined ? undefined : String(spec.minLength)],
      ['spellcheck', 'false'],
      ['required', true],
      ...adminInvalidAttrs(id, error, hintId),
    ]),
  });
}

const PASSWORD_HINT = `Al menos ${PASSWORD_MIN_LENGTH} caracteres.`;

function passwordFields(renderer: Renderer, errors: FieldErrors, withCurrent = false): SafeHtml[] {
  const common = { type: 'password' as const, maxLength: PASSWORD_MAX_LENGTH };
  return [
    ...(withCurrent ? [renderTextField(renderer, { ...common, name: 'currentPassword', autocomplete: 'current-password' }, errors)] : []),
    renderTextField(renderer, { ...common, name: 'password', autocomplete: 'new-password', minLength: PASSWORD_MIN_LENGTH, hint: PASSWORD_HINT }, errors),
    renderTextField(renderer, { ...common, name: 'passwordConfirmation', autocomplete: 'new-password', minLength: PASSWORD_MIN_LENGTH }, errors),
  ];
}

/** Avisos de la página: éxito, problema y resumen de errores con enlaces a los campos. */
function renderNotices(
  renderer: Renderer,
  { success, problem, errors = {} }: { success?: string | undefined; problem?: string | undefined; errors?: FieldErrors },
): SafeHtml {
  const notices: SafeHtml[] = [];
  if (success) notices.push(renderAdminNotice(renderer, { tone: 'success', role: 'status', title: success }));
  if (problem) notices.push(renderAdminNotice(renderer, { tone: 'error', role: 'alert', title: problem }));
  const summary = Object.entries(errors)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, message]) => ({ id: fieldIdOf(name), label: FIELD_LABELS[name] ?? name, message }));
  if (summary.length > 0) {
    notices.push(
      renderAdminNotice(renderer, {
        tone: 'error',
        role: 'alert',
        title: `No se guardó nada: revisa ${summary.length === 1 ? 'el campo marcado' : `los ${summary.length} campos marcados`}.`,
        extra: renderer.render('admin/partials/error-list', { items: renderer.renderEach('admin/partials/error-summary-item', summary) }),
      }),
    );
  }
  return renderer.join(notices);
}

const businessesText = (user: UserRecord): string =>
  user.role === 'admin' ? 'Todos' : user.businesses.map((businessId) => businessName(businessId)).join(', ');

/** Lista de usuarios (R-8). */
export function renderUsersList(
  renderer: Renderer,
  context: AdminPageContext & { users: UserRecord[]; timezone: string; success?: string | undefined; problem?: string | undefined },
): SafeHtml {
  const { users, timezone, csrfToken } = context;
  const rows = users.map((user) => ({
    username: user.username,
    displayName: user.displayName,
    role: ROLE_LABELS[user.role],
    businesses: businessesText(user),
    status: user.active ? 'Activo' : 'Desactivado',
    lastLogin: user.lastLoginAt ? formatDisplayDate(user.lastLoginAt.toISOString(), timezone) : 'Nunca',
    editHref: userPath(user.id),
    passwordHref: userPasswordPath(user.id),
    statusAction: userStatusPath(user.id, user.active),
    statusLabel: user.active ? 'Desactivar' : 'Reactivar',
    csrfToken,
    secondaryButtonClass: ADMIN_CLASSES.secondaryButton,
  }));
  return adminPage(renderer, {
    ...context,
    title: 'Usuarios',
    current: 'users',
    body: renderer.render('admin/users-list', {
      notices: renderNotices(renderer, { success: context.success, problem: context.problem }),
      primaryButtonClass: ADMIN_CLASSES.primaryButton,
      rows: renderer.renderEach('admin/partials/user-row', rows),
    }),
  });
}

/** Valores del formulario a partir de un usuario guardado. */
export const userFormValues = (user: UserRecord): UserFormValues => ({
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  businesses: [...user.businesses],
});

export const EMPTY_USER_FORM: UserFormValues = Object.freeze({ username: '', displayName: '', role: 'editor', businesses: [] });

function renderBusinesses(renderer: Renderer, values: UserFormValues, error: string | undefined): SafeHtml {
  const id = fieldIdOf('businesses');
  const options = BUSINESS_IDS.map((businessId: BusinessId) =>
    renderer.render('admin/partials/field-checkbox', {
      id: `${id}-${businessId}`,
      name: businessField(businessId),
      label: businessName(businessId),
      attrs: adminAttrs(renderer, [['checked', values.businesses.includes(businessId)]]),
      error: renderer.join([]),
    }),
  );
  return renderer.render('admin/partials/businesses-fieldset', {
    // El resumen de errores enlaza al fieldset.
    attrs: adminAttrs(renderer, [
      ['id', id],
      ['tabindex', '-1'],
      ['aria-describedby', [`${id}-hint`, error ? `${id}-error` : undefined].filter(Boolean).join(' ')],
    ]),
    hint: renderer.render('admin/partials/field-hint', {
      id: `${id}-hint`,
      text: 'Obligatorio para un editor: solo podrá ver y editar estos negocios. El administrador tiene todos.',
    }),
    options: renderer.join(options),
    error: adminFieldError(renderer, id, error),
  });
}

/** Crear (sin `user`) o editar un usuario (R-8). */
export function renderUserForm(
  renderer: Renderer,
  context: AdminPageContext & {
    user?: UserRecord | undefined;
    values: UserFormValues;
    errors?: UserFormErrors & { password?: string; passwordConfirmation?: string };
    problem?: string | undefined;
  },
): SafeHtml {
  const { user, values, errors = {} } = context;
  const creating = !user;
  const title = creating ? 'Crear usuario' : `Editar a ${user.username}`;
  const roleId = fieldIdOf('role');
  const fields = [
    renderTextField(renderer, { name: 'username', type: 'text', value: values.username, autocomplete: 'off', maxLength: USERNAME_MAX_LENGTH, hint: 'Con este nombre entra; no distingue mayúsculas.' }, errors),
    renderTextField(renderer, { name: 'displayName', type: 'text', value: values.displayName, autocomplete: 'off', maxLength: DISPLAY_NAME_MAX_LENGTH, hint: 'Aparece como autor de los cambios.' }, errors),
    renderer.render('admin/partials/field-select', {
      id: roleId,
      name: 'role',
      label: FIELD_LABELS.role,
      inputClass: ADMIN_CLASSES.input,
      attrs: adminAttrs(renderer, adminInvalidAttrs(roleId, errors.role)),
      options: renderer.join(
        ROLES.map((role) =>
          renderer.render('admin/partials/option-labeled', {
            value: role,
            label: ROLE_LABELS[role],
            selected: adminAttrs(renderer, [['selected', role === values.role]]),
          }),
        ),
      ),
      hint: renderer.join([]),
      error: adminFieldError(renderer, roleId, errors.role),
    }),
  ];
  return adminPage(renderer, {
    ...context,
    title,
    current: 'users',
    body: renderer.render('admin/user-form', {
      title,
      notices: renderNotices(renderer, { problem: context.problem, errors }),
      action: creating ? USERS_PATH : userPath(user.id),
      csrfToken: context.csrfToken,
      fields: renderer.join(fields),
      businesses: renderBusinesses(renderer, values, errors.businesses),
      passwords: creating ? renderer.join(passwordFields(renderer, errors)) : renderer.join([]),
      submitLabel: creating ? 'Crear usuario' : 'Guardar cambios',
      primaryButtonClass: ADMIN_CLASSES.primaryButton,
    }),
  });
}

/** Restablecer la contraseña de otro usuario (R-8). */
export function renderUserPasswordForm(
  renderer: Renderer,
  context: AdminPageContext & { user: UserRecord; errors?: FieldErrors },
): SafeHtml {
  const { user, errors = {} } = context;
  const title = `Restablecer la contraseña de ${user.username}`;
  return adminPage(renderer, {
    ...context,
    title,
    current: 'users',
    body: renderer.render('admin/password-form', {
      title,
      intro: 'Escribe la contraseña nueva dos veces. No se envía por ningún canal: comunícasela en persona. Sus sesiones abiertas se cerrarán.',
      notices: renderNotices(renderer, { errors }),
      action: userPasswordPath(user.id),
      csrfToken: context.csrfToken,
      fields: renderer.join(passwordFields(renderer, errors)),
      submitLabel: 'Restablecer contraseña',
      primaryButtonClass: ADMIN_CLASSES.primaryButton,
      cancel: renderer.render('admin/partials/cancel-link', {
        href: USERS_PATH,
        label: 'Cancelar',
        secondaryButtonClass: ADMIN_CLASSES.secondaryButton,
      }),
    }),
  });
}

/** Mi cuenta: cambiar la propia contraseña (R-9). */
export function renderAccount(
  renderer: Renderer,
  context: AdminPageContext & { errors?: FieldErrors; success?: string | undefined },
): SafeHtml {
  const { errors = {} } = context;
  return adminPage(renderer, {
    ...context,
    title: 'Mi cuenta',
    current: 'account',
    body: renderer.render('admin/password-form', {
      title: 'Mi cuenta: cambiar contraseña',
      intro: 'Escribe tu contraseña actual y dos veces la nueva. Tus otras sesiones abiertas se cerrarán.',
      notices: renderNotices(renderer, { success: context.success, errors }),
      action: ACCOUNT_PATH,
      csrfToken: context.csrfToken,
      fields: renderer.join(passwordFields(renderer, errors, true)),
      submitLabel: 'Cambiar contraseña',
      primaryButtonClass: ADMIN_CLASSES.primaryButton,
      cancel: renderer.join([]),
    }),
  });
}
