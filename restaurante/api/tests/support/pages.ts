import type { MemoryPageStore, PageDataByBusiness, StoredPage } from '@restaurante/core/catalog';

/** Datos de página de prueba (REQ-F-044): lo que dejará la importación del PR 3. */

const PROMO = { badge: 'Hoy', title: 'Dos por uno', description: 'Solo en el local.' };

export const MOLOTES_PAGE: PageDataByBusiness['molotes'] = {
  hero: { showcase: { tag: 'Clásico', title: 'Molote de papa', description: 'Crujiente y dorado.', priceCents: 14500, unit: 'orden' } },
  menu: { highlight: '8 Sabores de Barrio' },
  promo: PROMO,
};

export const BIRRIA_PAGE: PageDataByBusiness['birria'] = {
  hero: { showcase: { title: 'Birria de res', description: 'Con consomé.', priceCents: 19500 } },
  promo: PROMO,
};

export const AT_1 = '2026-10-01T10:00:00.000-06:00';
export const AT_2 = '2026-10-02T11:30:00.000-06:00';

export const stored = (revision: number, updatedAt: string | null, updatedBy: string | null, data: unknown): StoredPage => ({
  revision,
  updatedAt,
  updatedBy,
  updatedById: null,
  data: JSON.stringify(data),
});

/** Vigente y anterior de los dos negocios, con textos distintos para distinguirlas. */
export function seedPages(store: MemoryPageStore): void {
  store.seed('molotes', {
    current: stored(2, AT_2, 'Ana Admin', MOLOTES_PAGE),
    previous: stored(1, AT_1, 'Eli Molotes', { ...MOLOTES_PAGE, promo: { ...PROMO, title: 'Promo anterior' } }),
  });
  store.seed('birria', { current: stored(2, AT_2, 'Ana Admin', BIRRIA_PAGE), previous: stored(1, AT_1, null, { ...BIRRIA_PAGE, promo: { ...PROMO, title: 'Promo anterior' } }) });
}

/** Campos del formulario de Molotes con sus valores vigentes, como los envía el admin. */
export const molotesFields = (overrides: Record<string, string> = {}): Record<string, string> => ({
  'hero.showcase.tag': 'Clásico',
  'hero.showcase.title': 'Molote de papa',
  'hero.showcase.description': 'Crujiente y dorado.',
  'hero.showcase.priceCents': '145.00',
  'hero.showcase.unit': 'orden',
  'menu.highlight': '8 Sabores de Barrio',
  'promo.badge': 'Hoy',
  'promo.title': 'Dos por uno',
  'promo.description': 'Solo en el local.',
  ...overrides,
});
