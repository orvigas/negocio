import { BUSINESS_IDS, type BusinessId } from '../shared/index.ts';
import type { Role } from './user-schema.ts';

/**
 * Autorización de /admin por rol y por negocio (REQ-F-007, D-2 y R-7):
 * - administrador: todo, incluida la gestión de usuarios;
 * - editor: solo sus negocios asignados;
 * - gerente (REQ-F-049, RF-9): solo el inventario; ningún negocio, ni usuarios, bot ni cotizador.
 */

export interface Principal {
  role: Role;
  businesses: readonly BusinessId[];
}

export const isAdmin = (user: Pick<Principal, 'role'>): boolean => user.role === 'admin';

/** Inventario (REQ-F-049, PV-1): administradores y gerentes leen y escriben; el resto, nada. */
export const canManageInventory = (user: Pick<Principal, 'role'>): boolean => user.role === 'admin' || user.role === 'gerente';

/** Negocios que puede ver y editar, en el orden de BUSINESS_IDS (explícito por rol). */
export function allowedBusinesses(user: Principal): BusinessId[] {
  switch (user.role) {
    case 'admin':
      return [...BUSINESS_IDS];
    case 'editor':
      return BUSINESS_IDS.filter((businessId) => user.businesses.includes(businessId));
    case 'gerente':
      return [];
  }
}

export const canEditBusiness = (user: Principal, businessId: BusinessId): boolean => allowedBusinesses(user).includes(businessId);
