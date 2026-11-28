import type { FieldErrors } from './errors.ts';
import { codePoints, nameKey, readName } from './text.ts';

/**
 * Proveedor del inventario (REQ-F-051, RF-1). Se inactiva, no se borra. Del proveedor solo se guardan
 * el nombre comercial y un contacto mínimo: un teléfono o un correo (PV-7).
 */

export const SUPPLIER_NAME_MAX = 80;
export const SUPPLIER_CONTACT_MAX = 120;

export interface Supplier {
  id: number;
  name: string;
  nameKey: string;
  contact: string | null;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  updatedById: number | null;
  updatedByName: string | null;
}

export interface SupplierFieldsInput {
  name?: unknown;
  contact?: unknown;
}

export interface SupplierFields {
  name: string;
  nameKey: string;
  contact: string | null;
}

export type SupplierFieldsResult = { ok: true; value: SupplierFields } | { ok: false; errors: FieldErrors };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^\+?[\d\s()-]+$/;

/** Contacto opcional: un correo o un teléfono (de 7 a 20 dígitos), nada más (PV-7). */
function readContact(raw: unknown): { value: string | null } | { error: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') return { error: 'Debe ser texto.' };
  const value = raw.trim().normalize('NFC');
  if (value === '') return { value: null };
  if (codePoints(value) > SUPPLIER_CONTACT_MAX) return { error: `Máximo ${SUPPLIER_CONTACT_MAX} caracteres.` };
  if (EMAIL.test(value)) return { value };
  const digits = value.replace(/\D/g, '').length;
  if (PHONE_CHARS.test(value) && digits >= 7 && digits <= 20) return { value };
  return { error: 'Escribe un teléfono (de 7 a 20 dígitos) o un correo, solo uno.' };
}

export function validateSupplierFields(input: SupplierFieldsInput): SupplierFieldsResult {
  const errors: FieldErrors = {};
  const name = readName(input.name, SUPPLIER_NAME_MAX);
  if ('error' in name) errors.name = name.error;
  const contact = readContact(input.contact);
  if ('error' in contact) errors.contact = contact.error;
  if ('error' in name || 'error' in contact) return { ok: false, errors };
  return { ok: true, value: { name: name.value, nameKey: nameKey(name.value), contact: contact.value } };
}
