import { describe, expect, it } from 'vitest';

import {
  fieldDefinitions,
  isValidKind,
  slugify,
  toInput,
  uniqueSlug,
  validateProductInput,
  type Product,
  type ProductKind,
} from '@restaurante/core/catalog';

import { IMAGE, VALID_INPUTS } from '../support/products.ts';

/** Reglas del modelo común de producto (REQ-F-008, RF-1, RF-7, D-13, D-14 y D-18). */

const MOLOTES_PLATILLO: ProductKind = { business: 'molotes', category: 'platillo', detailsType: null };
const MOLOTES_BEBIDA: ProductKind = { business: 'molotes', category: 'bebida', detailsType: null };
const BIRRIA_CHIPS: ProductKind = { business: 'birria', category: 'platillo', detailsType: 'chips' };
const BIRRIA_PORTION: ProductKind = { business: 'birria', category: 'platillo', detailsType: 'portion' };
const BIRRIA_VARIANTS: ProductKind = { business: 'birria', category: 'platillo', detailsType: 'variants' };

const create = (kind: ProductKind, input: unknown) => validateProductInput(kind, input, { mode: 'create' });
const errorsOf = (kind: ProductKind, input: unknown) => {
  const result = create(kind, input);
  return result.ok ? {} : result.errors;
};

describe('combinaciones (RF-1.3)', () => {
  it('Molotes: platillo y bebida sin tipo; Birria: solo platillo con tipo de detalle', () => {
    expect(isValidKind(MOLOTES_PLATILLO)).toBe(true);
    expect(isValidKind(MOLOTES_BEBIDA)).toBe(true);
    expect(isValidKind({ business: 'molotes', category: 'platillo', detailsType: 'chips' })).toBe(false);
    expect(isValidKind(BIRRIA_VARIANTS)).toBe(true);
    expect(isValidKind({ business: 'birria', category: 'bebida', detailsType: 'variants' })).toBe(false);
    expect(isValidKind({ business: 'birria', category: 'platillo', detailsType: null })).toBe(false);
    expect(isValidKind({ business: 'tacos', category: 'platillo', detailsType: null })).toBe(false);
  });

  it('cada combinación admite solo sus campos', () => {
    expect(Object.keys(fieldDefinitions(MOLOTES_BEBIDA))).toEqual(['name', 'description', 'icon', 'tone', 'price']);
    expect(Object.keys(fieldDefinitions(BIRRIA_VARIANTS))).not.toContain('price');
  });
});

describe('validateProductInput', () => {
  it.each([
    ['Molotes platillo', MOLOTES_PLATILLO, VALID_INPUTS.molotesPlatillo],
    ['Molotes bebida', MOLOTES_BEBIDA, VALID_INPUTS.molotesBebida],
    ['Birria chips', BIRRIA_CHIPS, VALID_INPUTS.birriaChips],
    ['Birria portion', BIRRIA_PORTION, VALID_INPUTS.birriaPortion],
    ['Birria variants', BIRRIA_VARIANTS, VALID_INPUTS.birriaVariants],
  ])('%s válido', (_name, kind, input) => {
    expect(create(kind, input)).toMatchObject({ ok: true });
  });

  it('convierte precios en pesos a centavos y recorta textos', () => {
    const result = create(MOLOTES_PLATILLO, { ...VALID_INPUTS.molotesPlatillo, name: '  Molote  ' });
    expect(result.ok && result.value.fields).toMatchObject({ name: 'Molote', priceCents: 4500, orderPriceCents: 13000, orderQuantity: 3 });
  });

  it.each([0, 5000.01, 45.505, -10, 'abc', '', null, Number.NaN])('rechaza el precio %s (CA-19)', (price) => {
    expect(errorsOf(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, price })).toHaveProperty('price');
  });

  it.each([0.01, 5000, '5000.00', '0.01'])('acepta el precio %s (CA-19)', (price) => {
    expect(create(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, price })).toMatchObject({ ok: true });
  });

  it('valida el precio de cada variante', () => {
    const variants = [{ label: 'A', price: 0, description: 'd', available: true }];
    expect(errorsOf(BIRRIA_VARIANTS, { ...VALID_INPUTS.birriaVariants, variants })).toHaveProperty(['variants.0.price']);
  });

  it.each([
    ['ruta con ..', { ...IMAGE, src: '/img/../server.ts' }, 'image.src'],
    ['extensión no permitida', { ...IMAGE, src: '/img/a.gif' }, 'image.src'],
    ['fuera de /img/', { ...IMAGE, src: '/css/a.jpg' }, 'image.src'],
    ['sin alt', { ...IMAGE, alt: '  ' }, 'image.alt'],
    ['ancho 0', { ...IMAGE, width: 0 }, 'image.width'],
    ['alto 4001', { ...IMAGE, height: 4001 }, 'image.height'],
  ])('imagen: %s (CA-20)', (_name, image, path) => {
    expect(errorsOf(MOLOTES_PLATILLO, { ...VALID_INPUTS.molotesPlatillo, image })).toHaveProperty([path]);
  });

  it('rechaza campos desconocidos, de otra combinación y `author` (RF-1.4, D-18)', () => {
    const errors = errorsOf(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, author: 'Ana', image: IMAGE, foo: 1 });
    expect(errors).toMatchObject({ author: 'Campo desconocido.', image: 'Campo desconocido.', foo: 'Campo desconocido.' });
  });

  it('rechaza un slug elegido al crear (RF-7.2)', () => {
    expect(errorsOf(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, slug: 'cafe' })).toHaveProperty('slug');
  });

  it('en update rechaza slug, categoría o tipo distintos y acepta los mismos (CA-18)', () => {
    const current = { slug: 'refresco', category: 'platillo' as const, detailsType: 'variants' as const };
    const update = (extra: object) =>
      validateProductInput(BIRRIA_VARIANTS, { ...VALID_INPUTS.birriaVariants, available: true, ...extra }, { mode: 'update', current });
    expect(update({ slug: 'refresco', category: 'platillo', detailsType: 'variants' })).toMatchObject({ ok: true });
    for (const extra of [{ slug: 'otro' }, { category: 'bebida' }, { detailsType: 'chips' }]) {
      expect(update(extra)).toMatchObject({ ok: false, errors: { [Object.keys(extra)[0] as string]: 'Este campo no se puede modificar.' } });
    }
  });

  it('en update exige `available`; en create lo ignora (D-17)', () => {
    const current = { slug: 'x', category: 'bebida' as const, detailsType: null };
    expect(validateProductInput(MOLOTES_BEBIDA, VALID_INPUTS.molotesBebida, { mode: 'update', current })).toMatchObject({
      ok: false,
      errors: { available: 'Falta el campo.' },
    });
    expect(create(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, available: true })).toMatchObject({ ok: true, value: { available: null } });
  });

  it.each([0, 7])('rechaza %i variantes o chips (D-13, CA-21)', (count) => {
    const variants = Array.from({ length: count }, () => ({ label: 'A', price: 10, description: 'd', available: true }));
    const chips = Array.from({ length: count }, () => ({ text: 'x', highlight: false }));
    expect(errorsOf(BIRRIA_VARIANTS, { ...VALID_INPUTS.birriaVariants, variants })).toHaveProperty('variants');
    expect(errorsOf(BIRRIA_CHIPS, { ...VALID_INPUTS.birriaChips, chips })).toHaveProperty('chips');
  });

  it('acepta 6 variantes', () => {
    const variants = Array.from({ length: 6 }, (_, index) => ({ label: `V${index}`, price: 10, description: 'd', available: index > 0 }));
    expect(create(BIRRIA_VARIANTS, { ...VALID_INPUTS.birriaVariants, variants })).toMatchObject({ ok: true });
  });

  it('valida longitudes, listas cerradas, icono y cantidad por orden', () => {
    const errors = errorsOf(MOLOTES_PLATILLO, {
      ...VALID_INPUTS.molotesPlatillo,
      name: 'x'.repeat(81),
      tone: 'verde',
      orderQuantity: 21,
    });
    expect(Object.keys(errors).sort()).toEqual(['name', 'orderQuantity', 'tone']);
    expect(errorsOf(MOLOTES_BEBIDA, { ...VALID_INPUTS.molotesBebida, icon: 'Café', tone: 'sky' })).toMatchObject({ icon: expect.any(String), tone: expect.any(String) });
  });

  it('el cuerpo debe ser un objeto', () => {
    expect(create(MOLOTES_BEBIDA, [])).toEqual({ ok: false, errors: { '': 'El cuerpo debe ser un objeto.' } });
  });
});

describe('toInput', () => {
  it('devuelve los precios en pesos con dos decimales', () => {
    const product = {
      business: 'birria',
      category: 'platillo',
      detailsType: 'variants',
      name: 'R',
      label: 'F',
      image: IMAGE,
      detailsLabel: 'E',
      variants: [{ label: 'A', priceCents: 3550, description: 'd', available: true }],
    } as unknown as Product;
    expect(toInput(product)).toMatchObject({ variants: [{ price: '35.50' }] });
  });
});

describe('slug (RF-7.2, D-16)', () => {
  it('genera minúsculas, sin acentos y con guiones', () => {
    expect(slugify('Molotes de Champiñones con Epazote')).toBe('molotes-de-champinones-con-epazote');
    expect(slugify('  ¡Ñandú & Café!  ')).toBe('nandu-cafe');
    expect(slugify('¡!')).toBe('producto');
    expect(slugify('a'.repeat(80))).toHaveLength(54);
  });

  it('agrega sufijos si ya existe (aunque el original esté eliminado)', () => {
    expect(uniqueSlug('Molotes de Queso Oaxaca', new Set(['molotes-de-queso-oaxaca']))).toBe('molotes-de-queso-oaxaca-2');
    expect(uniqueSlug('A', new Set(['a', 'a-2']))).toBe('a-3');
    expect(uniqueSlug('B', new Set(['a']))).toBe('b');
  });
});
