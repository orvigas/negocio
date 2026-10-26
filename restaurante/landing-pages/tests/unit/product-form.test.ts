import { describe, expect, it } from 'vitest';

import { validateProductInput, type Product, type ProductKind } from '@restaurante/core/catalog';

import {
  emptyProductFormValues,
  formErrors,
  parseProductForm,
  productFormFieldNames,
  productFormValues,
} from '../../src/services/product-form.ts';
import { IMAGE } from '../support/products.ts';

/** Formulario HTML de producto (REQ-F-008, DT-12): filas fijas, posición y "Quitar". */

const VARIANTS: ProductKind = { business: 'birria', category: 'platillo', detailsType: 'variants' };
const DRINK: ProductKind = { business: 'molotes', category: 'bebida', detailsType: null };

const product: Product = {
  ...VARIANTS,
  id: 7,
  slug: 'bebidas',
  name: 'Bebidas',
  description: null,
  label: 'Frías',
  priceCents: null,
  priceUnit: null,
  image: IMAGE,
  tone: null,
  orderPriceCents: null,
  orderQuantity: null,
  icon: null,
  detailsLabel: 'Elige:',
  portion: null,
  portionExtra: null,
  chips: [],
  variants: [
    { label: 'A', priceCents: 3550, description: 'a', available: true },
    { label: 'B', priceCents: 1000, description: 'b', available: false },
  ],
  available: true,
  position: 1,
  version: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  deleted: false,
  deletedAt: null,
};

const parse = (values: Record<string, string>, kind = VARIANTS) => parseProductForm(kind, new Map(Object.entries(values)), { withAvailable: true });

/** Como el navegador: las casillas sin marcar no se envían. */
const submitted = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).filter(([name, value]) => !(/\.(available|highlight|remove)$|^available$/.test(name) && value === '')));

describe('productFormValues / parseProductForm', () => {
  it('ida y vuelta: el formulario pintado sin cambios reproduce el producto', () => {
    const values = productFormValues(product, { withAvailable: true });
    expect(values).toMatchObject({ 'variants.0.price': '35.50', 'variants.1.available': '', 'variants.2.label': '', 'variants.5.position': '6', 'image.width': '800' });
    const parsed = parse(submitted(values));
    expect(parsed.structureError).toBe(false);
    const result = validateProductInput(VARIANTS, parsed.input, { mode: 'update', current: product });
    expect(result).toMatchObject({ ok: true, value: { available: true, fields: { variants: product.variants, image: IMAGE, name: 'Bebidas' } } });
  });

  it('ignora filas vacías y las marcadas para quitar; ordena por posición', () => {
    const values = submitted({
      ...productFormValues(product, { withAvailable: true }),
      'variants.0.remove': 'on',
      'variants.4.label': 'C',
      'variants.4.price': '20',
      'variants.4.description': 'c',
      'variants.4.position': '1',
    });
    const parsed = parse(values);
    expect((parsed.input.variants as { label: string }[]).map((variant) => variant.label)).toEqual(['C', 'B']);
    expect(parsed.slots.variants).toEqual([4, 1]);
  });

  it('devuelve los errores de una variante a su fila y los de la lista al grupo', () => {
    expect(formErrors({ 'variants.0.price': 'x', variants: 'y', name: 'z' }, { chips: [], variants: [4, 1] })).toEqual({
      'variants.4.price': 'x',
      variants: 'y',
      name: 'z',
    });
  });

  it('una casilla con un valor distinto de "on" es un error de estructura', () => {
    expect(parse({ ...submitted(productFormValues(product, { withAvailable: true })), available: 'yes' }).structureError).toBe(true);
  });

  it('los nombres de campo son una lista cerrada por combinación', () => {
    const names = productFormFieldNames(DRINK, { withAvailable: false });
    expect(names).toEqual(['name', 'description', 'icon', 'tone', 'price', 'version', 'action', 'category', 'detailsType']);
    expect(productFormFieldNames(VARIANTS, { withAvailable: true })).toContain('variants.5.remove');
  });

  it('un formulario nuevo trae las filas vacías con su posición', () => {
    expect(emptyProductFormValues(VARIANTS)).toMatchObject({ name: '', 'variants.0.position': '1', 'variants.0.available': 'on', 'variants.5.position': '6' });
  });
});
