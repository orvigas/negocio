import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import {
  getMenuSchema,
  imageSrcError,
  validateMenuData,
  validateMenuDocument,
  type ValidationError,
} from '@restaurante/core/catalog';

import { seedData, seedDocuments, type CorruptibleData } from '../helpers.ts';

const paths = (issues: ValidationError[]) => issues.map((issue) => issue.path);

function validate(businessId: BusinessId, mutate: (data: CorruptibleData) => unknown) {
  const data = seedData(businessId);
  mutate(data);
  return validateMenuData(businessId, data, seedData(businessId));
}

describe('validateMenuData', () => {
  it.each(BUSINESS_IDS)('%s: la semilla es válida', (businessId) => {
    expect(validateMenuData(businessId, seedData(businessId), seedData(businessId))).toEqual([]);
  });

  it('CA-37: un precio fuera de rango escrito a mano invalida el documento', () => {
    expect(paths(validate('molotes', (data: CorruptibleData) => (data.menu.items[0].unitPriceCents = 600_000)))).toEqual(['menu.items.0.unitPriceCents']);
    expect(paths(validate('molotes', (data: CorruptibleData) => (data.menu.items[0].unitPriceCents = 0)))).toEqual(['menu.items.0.unitPriceCents']);
    expect(paths(validate('birria', (data: CorruptibleData) => (data.menu.items[3].variants[0].priceCents = 45.5)))).toEqual([
      'menu.items.3.variants.0.priceCents',
    ]);
  });

  it.each([
    ['tono fuera de la lista', (data: CorruptibleData) => (data.menu.items[0].tone = 'pink'), 'menu.items.0.tone'],
    ['tono de bebida fuera de la lista', (data: CorruptibleData) => (data.drinks.items[0].tone = 'gold'), 'drinks.items.0.tone'],
    ['icono con caracteres no permitidos', (data: CorruptibleData) => (data.drinks.items[0].icon = 'Water-Full'), 'drinks.items.0.icon'],
    ['cantidad por orden 0', (data: CorruptibleData) => (data.menu.items[0].orderQuantity = 0), 'menu.items.0.orderQuantity'],
    ['cantidad por orden 21', (data: CorruptibleData) => (data.menu.items[0].orderQuantity = 21), 'menu.items.0.orderQuantity'],
    ['ancho no entero', (data: CorruptibleData) => (data.menu.items[0].image.width = 10.5), 'menu.items.0.image.width'],
    ['alto fuera de rango', (data: CorruptibleData) => (data.menu.items[0].image.height = 4001), 'menu.items.0.image.height'],
    ['alt vacío', (data: CorruptibleData) => (data.menu.items[0].image.alt = '  '), 'menu.items.0.image.alt'],
    ['nombre de 81 caracteres', (data: CorruptibleData) => (data.menu.items[0].name = 'a'.repeat(81)), 'menu.items.0.name'],
    ['ruta de imagen fuera de /img/', (data: CorruptibleData) => (data.menu.items[0].image.src = '/css/x.jpg'), 'menu.items.0.image.src'],
    ['disponible no booleano', (data: CorruptibleData) => (data.menu.items[0].available = 'true'), 'menu.items.0.available'],
    ['campo desconocido', (data: CorruptibleData) => (data.menu.items[0].extra = 1), 'menu.items.0.extra'],
    ['campo faltante', (data: CorruptibleData) => delete data.promo.badge, 'promo.badge'],
  ])('molotes: rechaza %s', (_label, mutate, path) => {
    expect(paths(validate('molotes', mutate))).toContain(path);
  });

  it('la longitud se cuenta en caracteres, no en unidades UTF-16', () => {
    expect(validate('molotes', (data: CorruptibleData) => (data.menu.items[0].name = '🌮'.repeat(80)))).toEqual([]);
  });

  it.each([
    ['cambiar el slug', (data: CorruptibleData) => (data.menu.items[0].slug = 'otro'), 'menu.items.0.slug'],
    ['cambiar el tipo de detalle', (data: CorruptibleData) => (data.menu.items[0].detailsType = 'portion'), 'menu.items.0'],
    ['agregar un producto', (data: CorruptibleData) => data.menu.items.push(structuredClone(data.menu.items[0])), 'menu.items'],
    ['quitar una variante', (data: CorruptibleData) => data.menu.items[3].variants.pop(), 'menu.items.3.variants'],
    ['agregar un chip', (data: CorruptibleData) => data.menu.items[0].chips.push({ text: 'x', highlight: false }), 'menu.items.0.chips'],
    [
      'reordenar productos',
      (data: CorruptibleData) => data.menu.items.reverse(),
      'menu.items.0',
    ],
    ['agregar precio propio a un platillo con variantes', (data: CorruptibleData) => (data.menu.items[3].priceCents = 100), 'menu.items.3.priceCents'],
  ])('birria: rechaza %s (estructura no editable)', (_label, mutate, path) => {
    expect(paths(validate('birria', mutate))).toContain(path);
  });

  it('molotes: rechaza un id distinto o productos reordenados', () => {
    expect(paths(validate('molotes', (data: CorruptibleData) => (data.menu.items[0].id = 'otro')))).toEqual(['menu.items.0.id']);
    expect(paths(validate('molotes', (data: CorruptibleData) => data.drinks.items.reverse()))).toEqual(['drinks.items.0.id', 'drinks.items.1.id']);
  });
});

describe('imageSrcError', () => {
  it.each(['/img/molotes/a.jpg', '/img/birria/b-c_d.webp', '/img/x.jpeg', '/img/x.png'])('acepta %s', (src) => {
    expect(imageSrcError(src)).toBeNull();
  });

  it.each(['img/x.jpg', '/img/../x.jpg', '/img/a/../../b.jpg', '/img/x.gif', '/img/x.jpg?x=1', '/img/x .jpg', '/img//x.jpg', '/css/x.jpg', 42])(
    'rechaza %s',
    (src) => {
      expect(imageSrcError(src)).not.toBeNull();
    },
  );

  it('acepta hasta 255 caracteres y rechaza más (REQ-F-014, P-3: cabe en la columna image_src)', () => {
    const path = (length: number) => `/img/${'a'.repeat(length - '/img/'.length - '.jpg'.length)}.jpg`;
    expect(imageSrcError(path(255))).toBeNull();
    expect(imageSrcError(path(256))).toBe('La ruta es demasiado larga (máximo 255 caracteres).');
  });
});

describe('validateMenuDocument', () => {
  it.each(BUSINESS_IDS)('%s: valida el sobre de la semilla', (businessId) => {
    const seed = seedDocuments()[businessId];
    expect(validateMenuDocument(businessId, seed, seed.data)).toEqual([]);
  });

  it('rechaza otro negocio, otra versión de esquema, revisión inválida o autor vacío', () => {
    const seed = seedDocuments().molotes;
    const issues = validateMenuDocument(
      'molotes',
      { ...seed, business: 'birria', schemaVersion: 2, revision: -1, updatedAt: 'ayer', updatedBy: ' ', extra: true },
      seed.data,
    );
    expect(paths(issues).sort()).toEqual(['business', 'extra', 'revision', 'schemaVersion', 'updatedAt', 'updatedBy']);
  });

  it('rechaza algo que no es un objeto', () => {
    expect(validateMenuDocument('molotes', [], seedData('molotes'))).toHaveLength(1);
    expect(validateMenuDocument('molotes', null, seedData('molotes'))).toHaveLength(1);
  });
});

describe('getMenuSchema', () => {
  it('falla rápido con un negocio desconocido', () => {
    // @ts-expect-error: negocio desconocido, a propósito.
    expect(() => getMenuSchema('tacos')).toThrow(/No hay esquema/);
  });
});
