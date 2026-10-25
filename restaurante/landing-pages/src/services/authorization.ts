import { BUSINESS_IDS, type BusinessId } from '../config/businesses.ts';
import type { Role } from './user-schema.ts';

/**
 * Autorización de /admin por rol y por negocio (REQ-F-007, D-2 y R-7):
 * - administrador: todo, incluida la gestión de usuarios;
 * - editor: solo sus negocios asignados.
 */

export interface Principal {
  role: Role;
  businesses: readonly BusinessId[];
}

export const isAdmin = (user: Pick<Principal, 'role'>): boolean => user.role === 'admin';

/** Negocios que puede ver y editar (el administrador, todos; en el orden de BUSINESS_IDS). */
export const allowedBusinesses = (user: Principal): BusinessId[] =>
  user.role === 'admin' ? [...BUSINESS_IDS] : BUSINESS_IDS.filter((businessId) => user.businesses.includes(businessId));

export const canEditBusiness = (user: Principal, businessId: BusinessId): boolean => allowedBusinesses(user).includes(businessId);
