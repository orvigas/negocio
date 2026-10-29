import { describe, expect, it } from 'vitest';

import {
  buildVisibleMenu,
  type BirriaItem,
  type BirriaVariantsItem,
  type VisibleBirriaItem,
} from '@restaurante/core/catalog';

import { seedData } from '../helpers.ts';

type VariantsItem = BirriaVariantsItem & { priceCents?: number; description?: string };

const names = (items: readonly { name: string }[]) => items.map((item) => item.name);
// Los slugs que usan estas pruebas son productos con variantes de la semilla (o no existen).
const findBirria = (data: { menu: { items: readonly (BirriaItem | VisibleBirriaItem)[] } }, slug: string) =>
  data.menu.items.find((item) => item.slug === slug) as VariantsItem;

describe('buildVisibleMenu (RF-4)', () => {
  it('CA-5: oculta un molote no disponible y conserva el orden del resto', () => {
    const data = seedData('molotes');
    const hidden = data.menu.items[7]!;
    hidden.available = false;
    const visible = buildVisibleMenu('molotes', data);
    expect(names(visible.menu.items)).toEqual(names(seedData('molotes').menu.items).filter((name) => name !== hidden.name));
  });

  it('CA-6: oculta una bebida no disponible', () => {
    const data = seedData('molotes');
    data.drinks.items[1]!.available = false;
    expect(names(buildVisibleMenu('molotes', data).drinks.items)).toEqual(['Aguas Frescas Naturales del Día']);
  });

  it('CA-7: la variante activa es la primera disponible y define precio y descripción', () => {
    const data = seedData('birria');
    findBirria(data, 'consome-chico').variants[0]!.available = false;
    const item = findBirria(buildVisibleMenu('birria', data), 'consome-chico');
    expect(item.variants.map((variant) => variant.label)).toEqual(['Sin Carne']);
    expect(item.priceCents).toBe(4500);
    expect(item.description).toMatch(/^Solo caldito/);
  });

  it('con todas las variantes disponibles, la activa es la primera', () => {
    const item = findBirria(buildVisibleMenu('birria', seedData('birria')), 'birriamen');
    expect(item.priceCents).toBe(15_500);
    expect(item.variants).toHaveLength(2);
  });

  it('CA-8: un platillo sin variantes disponibles se oculta', () => {
    const data = seedData('birria');
    for (const variant of findBirria(data, 'birriamen').variants) variant.available = false;
    const visible = buildVisibleMenu('birria', data);
    expect(findBirria(visible, 'birriamen')).toBeUndefined();
    expect(visible.menu.items).toHaveLength(5);
  });

  it('un platillo no disponible se oculta aunque tenga variantes disponibles', () => {
    const data = seedData('birria');
    findBirria(data, 'bebidas').available = false;
    expect(findBirria(buildVisibleMenu('birria', data), 'bebidas')).toBeUndefined();
  });

  it('CA-9: una sección sin productos disponibles queda vacía', () => {
    const data = seedData('molotes');
    for (const item of data.menu.items) item.available = false;
    expect(buildVisibleMenu('molotes', data).menu.items).toEqual([]);
  });

  it('no modifica los datos recibidos', () => {
    const data = seedData('birria');
    findBirria(data, 'consome-chico').variants[0]!.available = false;
    const before = structuredClone(data);
    buildVisibleMenu('birria', data);
    expect(data).toEqual(before);
  });

  it('falla rápido con un negocio desconocido', () => {
    // @ts-expect-error: negocio desconocido, a propósito.
    expect(() => buildVisibleMenu('tacos', {})).toThrow(/Negocio desconocido/);
  });
});
