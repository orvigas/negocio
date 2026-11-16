import { describe, expect, it } from 'vitest';

import { pageFormFields, pageFormValues, parsePageForm } from '@restaurante/core/catalog';

import { BIRRIA_PAGE, MOLOTES_PAGE, molotesFields } from '../support/pages.ts';

/** Formulario de página en core (REQ-F-044, RF-6): las mismas reglas para `/admin` y la API (CA-11). */

const parse = (fields: Record<string, string>) => parsePageForm('molotes', new Map(Object.entries(fields)), MOLOTES_PAGE);

describe('pageFormFields y pageFormValues', () => {
  it('describe cada campo de Molotes en orden, con grupo, tipo y límite', () => {
    const fields = pageFormFields('molotes');
    expect(fields.map((field) => field.name)).toEqual(Object.keys(molotesFields()));
    expect(fields[0]).toEqual({ name: 'hero.showcase.tag', group: 'Showcase del hero', kind: 'text', label: 'Etiqueta', max: 40, optional: false });
    expect(fields.find((field) => field.name === 'hero.showcase.priceCents')).toEqual({ name: 'hero.showcase.priceCents', group: 'Showcase del hero', kind: 'price', label: 'Precio' });
    expect(fields.find((field) => field.name === 'promo.title')?.group).toBe('Promoción');
  });

  it('Birria no tiene etiqueta, unidad ni texto destacado', () => {
    expect(pageFormFields('birria').map((field) => field.name)).toEqual(['hero.showcase.title', 'hero.showcase.description', 'hero.showcase.priceCents', 'promo.badge', 'promo.title', 'promo.description']);
  });

  it('da los valores como texto del formulario, con el precio en pesos', () => {
    expect(pageFormValues('molotes', MOLOTES_PAGE)).toEqual(molotesFields());
    expect(pageFormValues('birria', BIRRIA_PAGE)['hero.showcase.priceCents']).toBe('195.00');
  });
});

describe('parsePageForm', () => {
  it('reconstruye los datos, con el precio en centavos y sin espacios sobrantes', async () => {
    const result = await parse(molotesFields({ 'promo.title': '  Nueva\r\npromo  ', 'hero.showcase.priceCents': '150.5' }));
    expect(result).toMatchObject({ errors: {}, structureError: false });
    expect(result.data).toEqual({ ...MOLOTES_PAGE, hero: { showcase: { ...MOLOTES_PAGE.hero.showcase, priceCents: 15050 } }, promo: { ...MOLOTES_PAGE.promo, title: 'Nueva\npromo' } });
  });

  it('un precio inválido y un texto demasiado largo son errores por campo, con lo escrito conservado', async () => {
    const long = 'x'.repeat(121);
    const result = await parse(molotesFields({ 'hero.showcase.priceCents': 'gratis', 'promo.title': long }));
    expect(Object.keys(result.errors).sort()).toEqual(['hero.showcase.priceCents', 'promo.title']);
    expect(result.errors['promo.title']).toBe('Máximo 120 caracteres.');
    expect(result.values['hero.showcase.priceCents']).toBe('gratis');
  });

  it('cuenta caracteres, no unidades UTF-16', async () => {
    await expect(parse(molotesFields({ 'promo.title': '🌮'.repeat(120) }))).resolves.toMatchObject({ errors: {} });
  });

  it('un campo desconocido o uno que falta es un error de estructura', async () => {
    await expect(parse(molotesFields({ otro: 'x' }))).resolves.toMatchObject({ structureError: true });
    const incompleto = Object.fromEntries(Object.entries(molotesFields()).filter(([name]) => name !== 'promo.badge'));
    await expect(parse(incompleto)).resolves.toMatchObject({ structureError: true });
  });

  it('nunca construye objetos a partir de los nombres recibidos', async () => {
    const result = await parse(molotesFields({ '__proto__.polluted': 'x' }));
    expect(result.structureError).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
