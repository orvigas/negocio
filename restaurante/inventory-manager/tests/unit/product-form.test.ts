import { describe, expect, it } from 'vitest';

import { CHECKBOX_VALUE, emptyProductFormValues, formErrors, parseProductForm, productFormValues, type AdminProduct, type ProductFormField } from '@restaurante/contracts';

/**
 * Formulario de producto <-> entrada de la API, guiado por el descriptor (packages/contracts,
 * REQ-F-039): misma forma que el /admin actual (filas fijas con posición y "Quitar").
 */

const POSITIONS = ['1', '2', '3'];
const row = (slot: number): ProductFormField[] => [
  { name: `variants.${slot}.label`, group: 'variants', slot, kind: 'text', label: 'Etiqueta', max: 40, optional: true },
  { name: `variants.${slot}.price`, group: 'variants', slot, kind: 'price', label: 'Precio' },
  { name: `variants.${slot}.description`, group: 'variants', slot, kind: 'text', label: 'Descripción', max: 400, optional: true },
  { name: `variants.${slot}.available`, group: 'variants', slot, kind: 'bool', label: 'Disponible' },
  { name: `variants.${slot}.position`, group: 'variants', slot, kind: 'enum', label: 'Posición', options: POSITIONS },
  { name: `variants.${slot}.remove`, group: 'variants', slot, kind: 'bool', label: 'Quitar' },
];
const FIELDS: ProductFormField[] = [
  { name: 'name', group: 'main', kind: 'text', label: 'Nombre', max: 80, optional: false },
  { name: 'available', group: 'main', kind: 'bool', label: 'Disponible' },
  { name: 'image.src', group: 'image', kind: 'imageSrc', label: 'Ruta' },
  { name: 'image.width', group: 'image', kind: 'int', label: 'Ancho', min: 1, max: 4000 },
  ...row(0),
  ...row(1),
  ...row(2),
];

describe('parseProductForm', () => {
  it('lee los campos, la imagen y las filas no vacías en el orden de su posición', () => {
    const form = new Map([
      ['name', 'Refresco'],
      ['available', CHECKBOX_VALUE],
      ['image.src', '/img/a.jpg'],
      ['image.width', '800'],
      ['variants.0.label', 'Chico'],
      ['variants.0.price', '30'],
      ['variants.0.position', '2'],
      ['variants.1.label', 'Grande'],
      ['variants.1.price', '45'],
      ['variants.1.position', '1'],
      ['variants.1.available', CHECKBOX_VALUE],
      ['variants.2.position', '3'],
    ]);
    const result = parseProductForm(FIELDS, form);
    expect(result.structureError).toBe(false);
    expect(result.input).toEqual({
      name: 'Refresco',
      available: true,
      image: { src: '/img/a.jpg', width: '800' },
      variants: [
        { label: 'Grande', price: '45', description: '', available: true },
        { label: 'Chico', price: '30', description: '', available: false },
      ],
    });
    expect(result.slots.variants).toEqual([1, 0]);
    expect(result.values['variants.1.available']).toBe(CHECKBOX_VALUE);
  });

  it('ignora las filas marcadas para quitar; una casilla con otro valor es un formulario manipulado', () => {
    const removed = parseProductForm(FIELDS, new Map([['variants.0.label', 'X'], ['variants.0.remove', CHECKBOX_VALUE]]));
    expect(removed.input.variants).toEqual([]);
    expect(parseProductForm(FIELDS, new Map([['available', 'yes']])).structureError).toBe(true);
  });

  it('una posición que no es de la lista vale la de su fila', () => {
    const result = parseProductForm(FIELDS, new Map([['variants.2.label', 'Z'], ['variants.2.position', '99']]));
    expect(result.slots.variants).toEqual([2]);
  });
});

describe('formErrors, productFormValues y emptyProductFormValues', () => {
  it('devuelve los errores de las filas a la fila donde se escribieron', () => {
    expect(formErrors({ 'variants.0.price': 'Mal', name: 'Falta', variants: 'Al menos una' }, { chips: [], variants: [2] })).toEqual({
      'variants.2.price': 'Mal',
      name: 'Falta',
      variants: 'Al menos una',
    });
  });

  it('pinta un producto guardado y un formulario nuevo', () => {
    const product = {
      id: 1, business: 'birria', category: 'platillo', detailsType: 'variants', slug: 'r', name: 'Refresco', available: true, position: 1, version: 3,
      deleted: false, deletedAt: null, createdAt: 'x', updatedAt: 'x', updatedBy: null,
      image: { src: '/img/a.jpg', alt: 'a', width: 800, height: 600 },
      variants: [{ label: 'Chico', price: '30.00', priceCents: 3000, description: 'Vaso', available: false }],
    } satisfies AdminProduct;
    const values = productFormValues(FIELDS, product);
    expect(values).toMatchObject({ name: 'Refresco', available: CHECKBOX_VALUE, 'image.width': '800', 'variants.0.price': '30.00', 'variants.0.available': '', 'variants.0.position': '1', 'variants.1.label': '' });
    const empty = emptyProductFormValues(FIELDS);
    expect(empty).toMatchObject({ name: '', 'variants.2.position': '3', 'variants.1.available': CHECKBOX_VALUE, 'variants.1.remove': '' });
  });
});
