import type { Context } from 'koa';

import { PAGE_CONFLICT_CODE, PAGE_NO_PREVIOUS_CODE, PAGE_UNAVAILABLE_CODE, type AdminPage, type AdminUser, type Freshness, type PageFormField, type PublicBusinessId } from '@restaurante/contracts';

import { failWith, type BotFailure } from './api-double-bot.ts';

/**
 * Doble de `/api/v1/admin/:negocio/pagina` (REQ-F-044). Mismo orden que la API real: sesión, negocio,
 * permiso y CSRF (en `api-double.ts`) -> disponibilidad -> fallo simulado -> cuerpo -> versión. Los
 * campos y los mensajes son los de `pageFormFields` y `parsePageForm` de core.
 *
 * Empieza cerrado (`open: false`), como la API con `PAGE_CUTOVER = false`: responde 503
 * `PAGE_UNAVAILABLE` y no escribe. Solo las pruebas abren la puerta.
 */

export type PageFailure = BotFailure | '413';

interface PageVersion {
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  values: Record<string, string>;
}

export interface PageWrite {
  business: PublicBusinessId;
  action: 'save' | 'overwrite_after_conflict' | 'restore_previous';
  authorId: number;
}

export interface PageDouble {
  open: boolean;
  pages: Record<PublicBusinessId, { current: PageVersion; previous: PageVersion | null }>;
  /** Escrituras aplicadas: lo que comprueba "nada se escribió". */
  writes: PageWrite[];
  readFailure: PageFailure | null;
  writeFailure: PageFailure | null;
  /** La escritura se aplica y, aun así, la respuesta falla: el caso de RF-9. */
  applyBeforeFailure: boolean;
  /** Guarda "desde otra sesión" (para el 409). */
  touch(business: PublicBusinessId, by: string | null): void;
}

const text = (name: string, group: string, label: string, max: number): PageFormField => ({ name, group, kind: 'text', label, max, optional: false });
const HERO = 'Showcase del hero';
const PROMO = 'Promoción';
const PRICE: PageFormField = { name: 'hero.showcase.priceCents', group: HERO, kind: 'price', label: 'Precio' };
const FIELDS: Record<PublicBusinessId, PageFormField[]> = {
  molotes: [
    text('hero.showcase.tag', HERO, 'Etiqueta', 40),
    text('hero.showcase.title', HERO, 'Título', 120),
    text('hero.showcase.description', HERO, 'Descripción', 400),
    PRICE,
    text('hero.showcase.unit', HERO, 'Texto de unidad', 40),
    text('menu.highlight', 'Menú de molotes', 'Texto destacado del menú', 120),
    text('promo.badge', PROMO, 'Badge de la promoción', 120),
    text('promo.title', PROMO, 'Título de la promoción', 120),
    text('promo.description', PROMO, 'Descripción de la promoción', 400),
  ],
  birria: [
    text('hero.showcase.title', HERO, 'Título', 120),
    text('hero.showcase.description', HERO, 'Descripción', 400),
    PRICE,
    text('promo.badge', PROMO, 'Badge de la promoción', 120),
    text('promo.title', PROMO, 'Título de la promoción', 120),
    text('promo.description', PROMO, 'Descripción de la promoción', 400),
  ],
};

const MOLOTES: Record<string, string> = {
  'hero.showcase.tag': 'Recién salidos',
  'hero.showcase.title': 'Trilogía poblana',
  'hero.showcase.description': 'Con crema de Chipilo.',
  'hero.showcase.priceCents': '145.00',
  'hero.showcase.unit': '/ orden de 3',
  'menu.highlight': '8 sabores de barrio',
  'promo.badge': 'Promociones',
  'promo.title': 'Promociones de Molotes',
  'promo.description': 'Pregunta por la promoción vigente.',
};
const BIRRIA: Record<string, string> = {
  'hero.showcase.title': 'Tostado de comal',
  'hero.showcase.description': 'Con costra de queso.',
  'hero.showcase.priceCents': '195.00',
  'promo.badge': 'Club El Muñeco',
  'promo.title': 'Domingos de birria',
  'promo.description': 'Litros al 2x1.',
};

const version = (revision: number, values: Record<string, string>, updatedBy: string | null = 'Ana Admin'): PageVersion => ({ revision, updatedAt: `2026-11-0${revision}T10:00:00-06:00`, updatedBy, values: { ...values } });

const versionOf = ({ revision, updatedAt }: PageVersion): string => `${revision}@${updatedAt ?? ''}`;

export function createPageDouble(): PageDouble {
  const double: PageDouble = {
    open: false,
    pages: {
      molotes: { current: version(2, MOLOTES), previous: version(1, { ...MOLOTES, 'hero.showcase.title': 'Título anterior' }) },
      birria: { current: version(1, BIRRIA), previous: null },
    },
    writes: [],
    readFailure: null,
    writeFailure: null,
    applyBeforeFailure: false,
    touch(business, by) {
      const page = double.pages[business];
      page.previous = page.current;
      page.current = version(page.current.revision + 1, { ...page.current.values, 'promo.title': 'Cambio de otra persona' }, by);
    },
  };
  return double;
}

const send = (ctx: Context, status: number, body: unknown): void => {
  ctx.status = status;
  ctx.body = body;
};

const fail = (ctx: Context, status: number, code: string, message: string, more: Record<string, unknown> = {}): void => send(ctx, status, { error: { code, message, ...more } });

const dto = ({ current, previous }: PageDouble['pages'][PublicBusinessId]): AdminPage => ({
  version: versionOf(current),
  updatedAt: current.updatedAt,
  updatedBy: current.updatedBy,
  hasPrevious: previous !== null,
  values: current.values,
});

function validate(business: PublicBusinessId, fields: Record<string, string>): Record<string, string> | null {
  const errors: Record<string, string> = {};
  for (const field of FIELDS[business]) {
    const value = fields[field.name] ?? '';
    if (field.kind === 'price' && !/^\d+(\.\d{1,2})?$/.test(value)) errors[field.name] = 'Usa un número con hasta 2 decimales (por ejemplo 45 o 45.50).';
    if (field.kind === 'text' && value.trim() === '') errors[field.name] = 'Este campo es obligatorio.';
    if (field.kind === 'text' && field.max !== undefined && [...value].length > field.max) errors[field.name] = `Máximo ${field.max} caracteres.`;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

async function failed(ctx: Context, failure: PageFailure): Promise<void> {
  if (failure === '413') return fail(ctx, 413, 'PAYLOAD_TOO_LARGE', 'El cuerpo es demasiado grande.');
  return failWith(ctx, failure);
}

export async function handlePage(
  ctx: Context,
  double: PageDouble,
  { business, actor, restoring, record, freshness }: { business: PublicBusinessId; actor: AdminUser; restoring: boolean; record: Record<string, unknown>; freshness: Freshness },
): Promise<void> {
  if (!double.open) return fail(ctx, 503, PAGE_UNAVAILABLE_CODE, 'La página todavía no está disponible.');
  const read = ctx.method === 'GET';
  const failure = read ? double.readFailure : double.writeFailure;
  if (failure && !double.applyBeforeFailure) return failed(ctx, failure);

  const page = double.pages[business];
  if (read) return send(ctx, 200, { page: dto(page), fields: FIELDS[business] });

  const { expectedVersion } = record;
  if (typeof expectedVersion !== 'string' || expectedVersion === '') {
    const field = restoring ? { expectedVersion: 'Falta la versión.' } : { '': 'El formulario no coincide con los campos de la página. Recarga la página.' };
    return fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields: field });
  }

  if (restoring) {
    if (!page.previous) return fail(ctx, 409, PAGE_NO_PREVIOUS_CODE, 'No hay una versión anterior que restaurar: no se cambió nada.');
  } else {
    const errors = validate(business, record.fields as Record<string, string>);
    if (errors) return fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields: errors });
  }
  if (expectedVersion !== versionOf(page.current)) {
    const { current } = page;
    return fail(ctx, 409, PAGE_CONFLICT_CODE, 'La página cambió mientras la editabas: no se guardó nada.', { currentPage: { version: versionOf(current), updatedAt: current.updatedAt, updatedBy: current.updatedBy } });
  }

  const revision = page.current.revision + 1;
  const applied = version(revision, restoring ? (page.previous as PageVersion).values : (record.fields as Record<string, string>), actor.name);
  page.previous = page.current;
  page.current = applied;
  double.writes.push({ business, action: restoring ? 'restore_previous' : record.overwrite === true ? 'overwrite_after_conflict' : 'save', authorId: actor.id });
  if (failure) return failed(ctx, failure);
  return send(ctx, 200, { page: dto(page), meta: { freshness } });
}
