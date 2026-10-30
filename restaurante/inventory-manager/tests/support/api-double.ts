import Koa from 'koa';

import {
  ADMIN_API_PREFIX,
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  type AdminProduct,
  type AdminUser,
  type ManagedUser,
  type ProductFormField,
  type PublicBusinessId,
} from '@restaurante/contracts';
import { readJsonBody } from '@restaurante/web';

import { listenLocal } from './http.ts';

/**
 * Doble de `/api/v1/admin` (REQ-F-039) para las pruebas del admin nuevo: cumple el contrato de
 * packages/contracts (las pruebas de la API real están en api/tests y, de extremo a extremo, en el
 * PR 3). Reglas mínimas: sesión Bearer, token CSRF, permiso por negocio, 422 por nombre vacío,
 * versión (409), máximo de un alta por Idempotency-Key, y modos de fallo (`down`: 503 en todo;
 * `writes-down`: la sesión responde y todo lo demás da 503).
 *
 * Usuarios y cuenta (REQ-F-040): solo administradores (403 `FORBIDDEN_ROLE`), 422 por usuario vacío o
 * repetido y por contraseñas que no coinciden, 409 `LAST_ADMIN`, cierre de las sesiones del usuario
 * (D-8) con `meta.ownSessionClosed`, y la sesión nueva al cambiar la propia contraseña.
 */

export interface DoubleUser {
  username: string;
  password: string;
  user: AdminUser;
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

const ROW_SLOTS = 6;
const POSITIONS = Array.from({ length: ROW_SLOTS }, (_, index) => String(index + 1));

const text = (name: string, label: string, max: number, optional = false): ProductFormField => ({ name, group: 'main', kind: 'text', label, max, optional });
const image: ProductFormField[] = [
  { name: 'image.src', group: 'image', kind: 'imageSrc', label: 'Ruta de la imagen' },
  { name: 'image.alt', group: 'image', kind: 'text', label: 'Texto alternativo (alt)', max: 150, optional: false },
  { name: 'image.width', group: 'image', kind: 'int', label: 'Ancho (px)', min: 1, max: 4000 },
  { name: 'image.height', group: 'image', kind: 'int', label: 'Alto (px)', min: 1, max: 4000 },
];
const variants: ProductFormField[] = Array.from({ length: ROW_SLOTS }, (_, slot) => [
  { name: `variants.${slot}.label`, group: 'variants' as const, slot, kind: 'text' as const, label: 'Etiqueta de la variante', max: 40, optional: true },
  { name: `variants.${slot}.price`, group: 'variants' as const, slot, kind: 'price' as const, label: 'Precio' },
  { name: `variants.${slot}.description`, group: 'variants' as const, slot, kind: 'text' as const, label: 'Descripción', max: 400, optional: true },
  { name: `variants.${slot}.available`, group: 'variants' as const, slot, kind: 'bool' as const, label: 'Disponible' },
  { name: `variants.${slot}.position`, group: 'variants' as const, slot, kind: 'enum' as const, label: 'Posición', options: POSITIONS },
  { name: `variants.${slot}.remove`, group: 'variants' as const, slot, kind: 'bool' as const, label: 'Quitar esta fila' },
]).flat();

const DESCRIPTORS: Record<string, ProductFormField[]> = {
  'molotes:platillo:': [
    text('name', 'Nombre', 80),
    text('description', 'Descripción', 400),
    text('label', 'Badge', 40),
    { name: 'tone', group: 'main', kind: 'enum', label: 'Tono del badge', options: ['secondary', 'primary', 'sky'] },
    { name: 'price', group: 'main', kind: 'price', label: 'Precio unitario' },
    { name: 'orderPrice', group: 'main', kind: 'price', label: 'Precio por orden' },
    { name: 'orderQuantity', group: 'main', kind: 'int', label: 'Cantidad por orden', min: 1, max: 20 },
    ...image,
  ],
  'molotes:bebida:': [
    text('name', 'Nombre', 80),
    text('description', 'Descripción', 400),
    { name: 'icon', group: 'main', kind: 'icon', label: 'Icono (Material Symbols)' },
    { name: 'tone', group: 'main', kind: 'enum', label: 'Tono del icono', options: ['amber', 'red'] },
    { name: 'price', group: 'main', kind: 'price', label: 'Precio' },
  ],
  'birria:platillo:variants': [text('name', 'Nombre', 80), text('label', 'Etiqueta (tag)', 40), ...image, text('detailsLabel', 'Título del bloque de detalle', 40), ...variants],
};

const AVAILABLE: ProductFormField = { name: 'available', group: 'main', kind: 'bool', label: 'Disponible (visible en la landing)' };

function withAvailable(fields: ProductFormField[]): ProductFormField[] {
  const index = fields.findIndex((field) => field.group !== 'main');
  const at = index === -1 ? fields.length : index;
  return [...fields.slice(0, at), AVAILABLE, ...fields.slice(at)];
}

export function product(id: number, business: PublicBusinessId, name: string, position: number, extra: Partial<AdminProduct> = {}): AdminProduct {
  const molotes = business === 'molotes';
  return {
    id,
    business,
    category: 'platillo',
    detailsType: molotes ? null : 'variants',
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    ...(molotes
      ? { description: 'Masa rellena.', label: 'Clásico', tone: 'sky', price: '25.00', priceCents: 2500, orderPrice: '70.00', orderPriceCents: 7000, orderQuantity: 3 }
      : { label: 'Frío', detailsLabel: 'Elige:', variants: [{ label: 'Chico', price: '35.00', priceCents: 3500, description: 'Vaso', available: true }] }),
    image: { src: '/img/x.jpg', alt: name, width: 800, height: 600 },
    available: true,
    position,
    version: 1,
    deleted: false,
    deletedAt: null,
    createdAt: '2026-10-28T10:00:00-06:00',
    updatedAt: '2026-10-28T10:00:00-06:00',
    updatedBy: { id: 1, name: 'Ana Admin' },
    ...extra,
  };
}

export interface ApiDouble {
  url: string;
  requests: RecordedRequest[];
  products: AdminProduct[];
  sessions: Map<string, { userId: number; csrfToken: string }>;
  mode: 'ok' | 'down' | 'writes-down';
  /** Usuarios gestionados (REQ-F-040). */
  managed: ManagedUser[];
  /** Contraseña vigente de cada usuario (para comprobar los cambios). */
  passwords: Map<number, string>;
  freshness: 'confirmed' | 'pending';
  /** Cambia un producto "desde otra sesión" (para el 409). */
  touch(id: number, by: string): void;
}

export async function startApiDouble(initialUsers: DoubleUser[], products: AdminProduct[]): Promise<ApiDouble> {
  let sequence = 1000;
  // Copias: las pruebas cambian roles y contraseñas sin tocar las constantes compartidas.
  const users: DoubleUser[] = initialUsers.map((entry) => ({ ...entry, user: { ...entry.user, businesses: [...entry.user.businesses] } }));
  const managed: ManagedUser[] = users.map(({ username, user }) => ({
    id: user.id,
    username,
    displayName: user.name,
    role: user.role,
    businesses: user.role === 'admin' ? [] : [...user.businesses],
    active: true,
    lastLoginAt: null,
    createdAt: '2026-10-28T10:00:00-06:00',
    updatedAt: '2026-10-28T10:00:00-06:00',
  }));
  const idempotency = new Map<string, number>();
  const state: Omit<ApiDouble, 'url'> = {
    requests: [],
    products,
    sessions: new Map(),
    mode: 'ok',
    managed,
    passwords: new Map(users.map((entry) => [entry.user.id, entry.password])),
    freshness: 'confirmed',
    touch(id, by) {
      const found = state.products.find((candidate) => candidate.id === id);
      if (found) Object.assign(found, { version: found.version + 1, updatedAt: '2026-10-28T12:30:00-06:00', updatedBy: { id: 9, name: by } });
    },
  };

  const app = new Koa();
  let currentCtx: Ctx;
  app.use(async (ctx) => {
    currentCtx = ctx;
    const body = ctx.method === 'GET' || ctx.method === 'DELETE' ? undefined : await readJsonBody(ctx).catch(() => undefined);
    state.requests.push({ method: ctx.method, path: ctx.path, headers: { ...ctx.headers } as Record<string, string | undefined>, body });
    const fail = (status: number, code: string, message: string, more: Record<string, unknown> = {}) => {
      ctx.status = status;
      ctx.body = { error: { code, message, ...more } };
    };
    if (state.mode === 'down') return fail(503, 'DATABASE_UNAVAILABLE', 'Servicio no disponible temporalmente.');
    const path = ctx.path.slice(ADMIN_API_PREFIX.length);
    const record = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};

    if (path === '/sesion' && ctx.method === 'POST') {
      const found = users.find(
        (candidate) =>
          candidate.username === record.username &&
          state.passwords.get(candidate.user.id) === record.password &&
          state.managed.find((entry) => entry.id === candidate.user.id)?.active !== false,
      );
      if (!found) return fail(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
      const id = `sesion-${++sequence}-abcdefghijklmnop`;
      const csrfToken = `csrf-${sequence}-abcdefghijklmnop`;
      state.sessions.set(id, { userId: found.user.id, csrfToken });
      ctx.status = 201;
      ctx.body = { session: { id, csrfToken }, user: found.user };
      return undefined;
    }

    const bearer = /^Bearer (.+)$/.exec(ctx.get('Authorization'))?.[1];
    const session = bearer ? state.sessions.get(bearer) : undefined;
    const user = users.find((candidate) => candidate.user.id === session?.userId)?.user;
    if (!session || !user) return fail(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    const write = ctx.method !== 'GET';
    if (write && ctx.get(CSRF_HEADER) !== session.csrfToken) return fail(403, 'CSRF_INVALID', 'La petición no es válida. Recarga la página e inténtalo de nuevo.');

    if (path === '/sesion') {
      if (ctx.method === 'DELETE') {
        state.sessions.delete(bearer as string);
        ctx.status = 204;
        return undefined;
      }
      ctx.body = { user, csrfToken: session.csrfToken };
      return undefined;
    }

    if (state.mode === 'writes-down') return fail(503, 'DATABASE_UNAVAILABLE', 'Servicio no disponible temporalmente.');

    if (path === '/cuenta/contrasena' && ctx.method === 'POST') return changeOwnPassword(user, record, fail);
    const userMatch = /^\/usuarios(?:\/([^/]+))?(?:\/(desactivar|reactivar|contrasena))?$/.exec(path);
    if (userMatch) {
      if (user.role !== 'admin') return fail(403, 'FORBIDDEN_ROLE', 'No tienes permiso para gestionar usuarios.');
      return handleUsers(user, userMatch[1], userMatch[2], record, fail);
    }

    const match = /^\/([^/]+)\/productos(?:\/(campos|orden|\d+))?(?:\/(recuperar|mover))?$/.exec(path);
    if (!match) return fail(404, 'NOT_FOUND', 'Recurso no encontrado.');
    const business = match[1] as PublicBusinessId;
    if (business !== 'molotes' && business !== 'birria') return fail(404, 'BUSINESS_NOT_FOUND', 'Negocio desconocido.');
    if (!user.businesses.includes(business)) return fail(403, 'FORBIDDEN_BUSINESS', 'No tienes permiso sobre este negocio.');
    const of = state.products.filter((candidate) => candidate.business === business);
    const meta = { freshness: state.freshness };

    if (match[2] === 'campos') {
      const fields = DESCRIPTORS[`${business}:${String(ctx.query.categoria)}:${String(ctx.query.tipo ?? '')}`];
      if (!fields) return fail(400, 'INVALID_KIND', 'Categoría o tipo de detalle no válidos para este negocio.');
      ctx.body = { category: ctx.query.categoria, detailsType: ctx.query.tipo ?? null, create: fields, update: withAvailable(fields) };
      return undefined;
    }
    if (match[2] === undefined) {
      if (ctx.method === 'GET') {
        ctx.body = { products: ctx.query.eliminados === '1' ? of : of.filter((candidate) => !candidate.deleted) };
        return undefined;
      }
      // Alta.
      if (typeof record.name !== 'string' || record.name.trim() === '') return fail(422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields: { name: 'Escribe el nombre.' } });
      const key = ctx.get(IDEMPOTENCY_HEADER);
      const replay = key ? idempotency.get(`${user.id}:${business}:${key}`) : undefined;
      const existing = replay === undefined ? undefined : state.products.find((candidate) => candidate.id === replay);
      const created = existing ?? product(++sequence, business, record.name, Math.max(0, ...of.map((candidate) => candidate.position)) + 1, { available: false, category: record.category === 'bebida' ? 'bebida' : 'platillo' });
      if (!existing) {
        state.products.push(created);
        if (key) idempotency.set(`${user.id}:${business}:${key}`, created.id);
      }
      ctx.status = 201;
      ctx.body = { product: created, meta };
      return undefined;
    }
    const target = of.find((candidate) => candidate.id === Number(match[2]));
    if (!target) return fail(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado.');
    const conflict = () => fail(409, 'VERSION_CONFLICT', 'El producto cambió mientras lo editabas: no se guardó nada.', { current: { id: target.id, version: target.version, updatedAt: target.updatedAt, updatedBy: target.updatedBy?.name ?? null } });
    const version = ctx.method === 'DELETE' ? Number(ctx.query.version) : Number(record.version);

    if (ctx.method === 'GET') {
      ctx.body = { product: target };
      return undefined;
    }
    if (ctx.method === 'PUT') {
      if (typeof record.name !== 'string' || record.name.trim() === '') return fail(422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields: { name: 'Escribe el nombre.', 'variants.0.price': 'Precio inválido.' } });
      if (version !== target.version) return conflict();
      Object.assign(target, { name: record.name, available: record.available === true, version: target.version + 1, updatedBy: { id: user.id, name: user.name } });
      ctx.body = { product: target, meta };
      return undefined;
    }
    if (ctx.method === 'DELETE') {
      if (version !== target.version) return conflict();
      Object.assign(target, { deleted: true, deletedAt: '2026-10-28T13:00:00-06:00', version: target.version + 1 });
      ctx.body = { product: target, meta };
      return undefined;
    }
    if (match[3] === 'recuperar') {
      if (version !== target.version) return conflict();
      Object.assign(target, { deleted: false, deletedAt: null, available: false, version: target.version + 1 });
      ctx.body = { product: target, meta };
      return undefined;
    }
    if (match[3] === 'mover') {
      if (version !== target.version) return conflict();
      const siblings = of.filter((candidate) => !candidate.deleted && candidate.category === target.category).sort((a, b) => a.position - b.position);
      const index = siblings.indexOf(target);
      const other = siblings[record.direction === 'up' ? index - 1 : index + 1];
      if (other) {
        [target.position, other.position] = [other.position, target.position];
        target.version += 1;
        other.version += 1;
      }
      ctx.body = { products: of, meta };
      return undefined;
    }
    return fail(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
  });
  const { url } = await listenLocal(app);
  return Object.assign(state, { url });

  type Fail = (status: number, code: string, message: string, more?: Record<string, unknown>) => void;
  type Ctx = Parameters<Parameters<typeof app.use>[0]>[0];

  function invalid(fail: Fail, fields: Record<string, string>): void {
    fail(422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields });
  }

  /** D-8: cierra las sesiones del usuario; true si era el de la sesión actual. */
  function closeSessions(targetId: number, actorId: number): boolean {
    for (const [id, entry] of state.sessions) if (entry.userId === targetId) state.sessions.delete(id);
    return targetId === actorId;
  }

  /** D-7: tras el cambio queda al menos un administrador activo. */
  function leavesAdmin(target: ManagedUser, next: Partial<ManagedUser>): boolean {
    return state.managed.some((entry) => {
      const merged = entry.id === target.id ? { ...entry, ...next } : entry;
      return merged.role === 'admin' && merged.active;
    });
  }

  /** Sincroniza el usuario de la sesión (rol, nombre y negocios vigentes) con el gestionado. */
  function syncSessionUser(target: ManagedUser): void {
    const entry = users.find((candidate) => candidate.user.id === target.id);
    if (!entry) return;
    entry.username = target.username;
    entry.user = { id: target.id, name: target.displayName, role: target.role, businesses: target.role === 'admin' ? ['molotes', 'birria'] : [...target.businesses] };
  }

  function respond(status: number, body: unknown): void {
    currentCtx.status = status;
    currentCtx.body = body;
  }

  function handleUsers(actor: AdminUser, rawId: string | undefined, action: string | undefined, record: Record<string, unknown>, fail: Fail): void {
    const ctx = currentCtx;
    if (rawId === undefined) {
      if (ctx.method === 'GET') return respond(200, { users: state.managed });
      const username = typeof record.username === 'string' ? record.username.trim() : '';
      if (username === '') return invalid(fail, { username: 'Escribe el usuario de acceso.' });
      if (state.managed.some((entry) => entry.username.toLowerCase() === username.toLowerCase())) return invalid(fail, { username: 'Ya existe un usuario con ese nombre de acceso (sin distinguir mayúsculas).' });
      if (record.password !== record.passwordConfirmation) return invalid(fail, { passwordConfirmation: 'Las contraseñas no coinciden.' });
      const role = record.role === 'admin' ? 'admin' : 'editor';
      const created: ManagedUser = {
        id: ++sequence,
        username,
        displayName: (typeof record.displayName === 'string' ? record.displayName : ''),
        role,
        businesses: role === 'admin' ? [] : ((record.businesses ?? []) as PublicBusinessId[]),
        active: true,
        lastLoginAt: null,
        createdAt: '2026-10-28T11:00:00-06:00',
        updatedAt: '2026-10-28T11:00:00-06:00',
      };
      state.managed.push(created);
      state.passwords.set(created.id, String(record.password));
      users.push({ username, password: String(record.password), user: { id: created.id, name: created.displayName, role, businesses: role === 'admin' ? ['molotes', 'birria'] : created.businesses } });
      return respond(201, { user: created });
    }
    const target = /^[1-9]\d{0,9}$/.test(rawId) ? state.managed.find((entry) => entry.id === Number(rawId)) : undefined;
    if (!target) return fail(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
    if (ctx.method === 'GET' && action === undefined) return respond(200, { user: target });
    if (action === 'desactivar' || action === 'reactivar') {
      const active = action === 'reactivar';
      if (target.active === active) return respond(200, { user: target, meta: { ownSessionClosed: false } });
      if (!leavesAdmin(target, { active })) return fail(409, 'LAST_ADMIN', 'Debe quedar al menos un administrador activo: no se guardó nada. Crea o reactiva otro administrador antes.');
      target.active = active;
      return respond(200, { user: target, meta: { ownSessionClosed: closeSessions(target.id, actor.id) } });
    }
    if (action === 'contrasena') {
      if (record.password !== record.passwordConfirmation) return invalid(fail, { passwordConfirmation: 'Las contraseñas no coinciden.' });
      state.passwords.set(target.id, String(record.password));
      return respond(200, { user: target, meta: { ownSessionClosed: closeSessions(target.id, actor.id) } });
    }
    // Edición.
    const username = typeof record.username === 'string' ? record.username.trim() : '';
    if (username === '') return invalid(fail, { username: 'Escribe el usuario de acceso.' });
    const role = record.role === 'admin' ? 'admin' : 'editor';
    const businesses = role === 'admin' ? [] : ((record.businesses ?? []) as PublicBusinessId[]);
    if (role === 'editor' && businesses.length === 0) return invalid(fail, { businesses: 'Asigna al menos un negocio al editor.' });
    if (!leavesAdmin(target, { role })) return fail(409, 'LAST_ADMIN', 'Debe quedar al menos un administrador activo: no se guardó nada. Crea o reactiva otro administrador antes.');
    const closes = role !== target.role || businesses.join() !== target.businesses.join();
    Object.assign(target, { username, displayName: (typeof record.displayName === 'string' ? record.displayName : ''), role, businesses });
    syncSessionUser(target);
    return respond(200, { user: target, meta: { ownSessionClosed: closes ? closeSessions(target.id, actor.id) : false } });
  }

  function changeOwnPassword(actor: AdminUser, record: Record<string, unknown>, fail: Fail): void {
    if (record.currentPassword !== state.passwords.get(actor.id)) return invalid(fail, { currentPassword: 'La contraseña actual no es correcta.' });
    if (record.password !== record.passwordConfirmation) return invalid(fail, { passwordConfirmation: 'Las contraseñas no coinciden.' });
    state.passwords.set(actor.id, String(record.password));
    closeSessions(actor.id, actor.id);
    const id = `sesion-${++sequence}-abcdefghijklmnop`;
    const csrfToken = `csrf-${sequence}-abcdefghijklmnop`;
    state.sessions.set(id, { userId: actor.id, csrfToken });
    return respond(200, { session: { id, csrfToken }, user: actor });
  }
}
