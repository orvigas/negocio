import { BUSINESS_IDS, type BusinessId } from '../shared/index.ts';

/**
 * Datos de un usuario de /admin (REQ-F-007, D-10 y DT-15): reglas y normalización compartidas
 * por los formularios, el arranque (ADMIN_USER) y el comando de recuperación.
 */

export const ROLES = Object.freeze(['admin', 'editor'] as const);
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = Object.freeze({ admin: 'Administrador', editor: 'Editor' });

export const USERNAME_MAX_LENGTH = 60;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const PASSWORD_MIN_LENGTH = 12;
/** Máximo defensivo: scrypt procesa todo el texto. */
export const PASSWORD_MAX_LENGTH = 256;

// Caracteres de control (C0, DEL y C1).
// eslint-disable-next-line no-control-regex -- se buscan justamente los caracteres de control.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Longitud en caracteres (puntos de código), no en unidades UTF-16. */
const length = (text: string): number => [...text].length;

export const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as readonly string[]).includes(value);

/** Usuario de acceso tal como se guarda: recortado y en NFC. */
export const normalizeUsername = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().normalize('NFC') : '');

/** Clave única del usuario: sin distinguir mayúsculas de minúsculas. */
export const usernameKey = (raw: unknown): string => normalizeUsername(raw).toLowerCase();

/** Error del usuario de acceso o null si es válido. */
export function usernameError(username: string): string | null {
  if (username === '') return 'Escribe el usuario de acceso.';
  if (length(username) > USERNAME_MAX_LENGTH) return `Máximo ${USERNAME_MAX_LENGTH} caracteres.`;
  if (CONTROL_CHARS.test(username)) return 'El usuario no puede tener caracteres de control.';
  return null;
}

function displayNameError(displayName: string): string | null {
  if (displayName === '') return 'Escribe el nombre visible.';
  if (length(displayName) > DISPLAY_NAME_MAX_LENGTH) return `Máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
  if (CONTROL_CHARS.test(displayName)) return 'El nombre no puede tener caracteres de control.';
  return null;
}

/** Error de una contraseña nueva o null si es válida. */
export function passwordError(password: unknown): string | null {
  const text = typeof password === 'string' ? password : '';
  if (length(text) < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (length(text) > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`;
  return null;
}

// Alias (no interfaz): así es asignable a un registro de errores por campo.
export type PasswordPairErrors = { password?: string; passwordConfirmation?: string };

/** Contraseña nueva escrita dos veces. */
export function validatePasswordPair(password: unknown, confirmation: unknown): PasswordPairErrors {
  const error = passwordError(password);
  if (error) return { password: error };
  if (password !== confirmation) return { passwordConfirmation: 'Las contraseñas no coinciden.' };
  return {};
}

/** Nombre del campo de formulario de un negocio (casilla independiente: el body no admite campos repetidos). */
export const businessField = (businessId: BusinessId): string => `business-${businessId}`;

export interface UserFormValues {
  username: string;
  displayName: string;
  role: string;
  businesses: BusinessId[];
}

export interface UserData {
  username: string;
  displayName: string;
  role: Role;
  /** Negocios del editor; vacío para el administrador (los tiene todos de forma implícita). */
  businesses: BusinessId[];
}

export type UserFormErrors = Partial<Record<'username' | 'displayName' | 'role' | 'businesses', string>>;

/** Lee los campos del formulario de usuario (sin validar). */
export function readUserForm(fields: Map<string, string>): UserFormValues {
  return {
    username: fields.get('username') ?? '',
    displayName: fields.get('displayName') ?? '',
    role: fields.get('role') ?? '',
    businesses: BUSINESS_IDS.filter((businessId) => fields.get(businessField(businessId)) === 'on'),
  };
}

/** Valida y normaliza los datos de un usuario (D-10). */
export function validateUserData(values: UserFormValues): { data: UserData | null; errors: UserFormErrors } {
  const username = normalizeUsername(values.username);
  const displayName = values.displayName.trim().normalize('NFC');
  const errors: UserFormErrors = {};

  const userError = usernameError(username);
  if (userError) errors.username = userError;
  const nameError = displayNameError(displayName);
  if (nameError) errors.displayName = nameError;
  if (!isRole(values.role)) errors.role = 'Elige un rol.';
  else if (values.role === 'editor' && values.businesses.length === 0) errors.businesses = 'Asigna al menos un negocio al editor.';

  if (Object.keys(errors).length > 0 || !isRole(values.role)) return { data: null, errors };
  const businesses = values.role === 'admin' ? [] : BUSINESS_IDS.filter((businessId) => values.businesses.includes(businessId));
  return { data: { username, displayName, role: values.role, businesses }, errors };
}
