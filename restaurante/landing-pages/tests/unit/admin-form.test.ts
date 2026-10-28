import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import { createImageChecker, pickPageData, type ImageExists, type PageDataByBusiness } from '@restaurante/core/catalog';
import { createRenderer } from '@restaurante/web';

import { DEFAULT_PUBLIC_DIR, DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { parseAdminForm, type AdminFormResult } from '../../src/services/admin-form.ts';
import { renderAdminBusiness } from '../../src/views/admin/index.ts';
import { seedData, seedDocuments } from '../helpers.ts';
import { formFields, type FormFields } from '../support/admin.ts';

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });
const imageExists: ImageExists = async () => true;

/** Campos tal como los envía el navegador con la página de administración pintada (sin cambios). */
function pageFields(businessId: BusinessId): FormFields {
  const html = renderAdminBusiness(renderer, {
    businessId,
    timezone: 'America/Mexico_City',
    csrfToken: 'token',
    document: seedDocuments()[businessId],
    version: '0@seed',
    lastChange: null,
    damaged: null,
    viewer: { displayName: 'Ana', role: 'admin', businesses: [] },
    faviconBusinessId: businessId,
  }).toString();
  const fields = formFields(html);
  delete fields._csrf;
  delete fields.expectedVersion;
  return fields;
}

/** Los casos que leen `data` envían el formulario completo y válido: tiene la forma de los datos de página. */
type ParsedForm<Id extends BusinessId> = Omit<AdminFormResult, 'data'> & { data: PageDataByBusiness[Id] };

const parse = <Id extends BusinessId>(businessId: Id, fields: FormFields, options = { imageExists }) =>
  parseAdminForm(businessId, new Map(Object.entries(fields)), pickPageData(businessId, seedData(businessId)), options) as Promise<ParsedForm<Id>>;

/**
 * Formulario de página: hero, texto destacado y promociones (REQ-F-001; desde REQ-F-008 sin
 * productos). Las reglas de los campos de producto (precios, imagen, tonos, icono, cantidad por
 * orden, longitudes, unidad opcional, variantes y chips) se prueban en product-schema.test.ts y
 * product-form.test.ts.
 */
describe('parseAdminForm', () => {
  it.each(BUSINESS_IDS)('%s: el formulario pintado sin cambios reproduce exactamente los datos de página de la semilla', async (businessId) => {
    const fields = pageFields(businessId);
    const result = await parse(businessId, fields);
    expect(result.structureError).toBe(false);
    expect(result.errors).toEqual({});
    expect(result.data).toEqual(pickPageData(businessId, seedData(businessId)));
    // REQ-F-008: el formulario de página ya no lleva productos.
    expect(Object.keys(fields).filter((name) => /items|drinks/.test(name))).toEqual([]);
  });

  // CA-14: CA-10 a CA-13 en el precio del hero de ambos negocios.
  const PRICE_CASES: [string, boolean][] = [
    ['0', false],
    ['0.00', false],
    ['0.01', true],
    ['5000', true],
    ['5000.00', true],
    ['5000.01', false],
    ['45.505', false],
    ['-10', false],
    ['abc', false],
    ['', false],
  ];

  for (const businessId of BUSINESS_IDS) {
    const priceFields = Object.keys(pageFields(businessId)).filter((name) => /priceCents$/i.test(name));

    it(`${businessId}: el formulario expone el precio del hero`, () => {
      expect(priceFields).toEqual(['hero.showcase.priceCents']);
    });

    it.each(PRICE_CASES)(`${businessId}: el precio con "%s" -> válido=%s`, async (value, valid) => {
      const base = pageFields(businessId);
      for (const field of priceFields) {
        const result = await parse(businessId, { ...base, [field]: value });
        expect(result.structureError, field).toBe(false);
        if (valid) {
          expect(result.errors, field).toEqual({});
        } else {
          expect(Object.keys(result.errors), field).toEqual([field]);
          expect(result.values[field], field).toBe(value); // CA-19: conserva lo escrito
        }
      }
    });
  }

  it('CA-10/CA-12: los mensajes de rango son específicos', async () => {
    const base = pageFields('molotes');
    const zero = await parse('molotes', { ...base, 'hero.showcase.priceCents': '0' });
    expect(zero.errors['hero.showcase.priceCents']).toMatch(/mayor que \$0/);
    const max = await parse('molotes', { ...base, 'hero.showcase.priceCents': '5000.01' });
    expect(max.errors['hero.showcase.priceCents']).toMatch(/\$5,000\.00/);
  });

  it('CA-15: 45.5 se guarda como 4550 centavos', async () => {
    const result = await parse('birria', { ...pageFields('birria'), 'hero.showcase.priceCents': '45.5' });
    expect(result.data.hero.showcase.priceCents).toBe(4550);
  });

  it.each([
    ['un campo desconocido', (fields: FormFields) => (fields['promo.secret'] = 'x')],
    ['un campo de producto (REQ-F-008: los productos tienen su propio formulario)', (fields: FormFields) => (fields['menu.items.0.name'] = 'Nuevo')],
    ['una bebida', (fields: FormFields) => (fields['drinks.items.0.priceCents'] = '10')],
    ['un campo de texto ausente', (fields: FormFields) => delete fields['promo.title']],
    ['el precio del hero ausente', (fields: FormFields) => delete fields['hero.showcase.priceCents']],
  ])('CA-18: marca error de estructura con %s', async (_label, mutate) => {
    const fields = pageFields('molotes');
    mutate(fields);
    expect((await parse('molotes', fields)).structureError).toBe(true);
  });

  it('ignora los campos de control del formulario', async () => {
    const result = await parse('molotes', { ...pageFields('molotes'), _csrf: 'x', expectedVersion: '1@x', action: 'save' });
    expect(result.structureError).toBe(false);
  });

  it('el campo "author" ya no existe: el autor sale de la sesión (REQ-F-007, D-11)', async () => {
    expect(pageFields('molotes')).not.toHaveProperty('author');
    const result = await parse('molotes', { ...pageFields('molotes'), author: 'Otra persona' });
    expect(result.structureError).toBe(true);
  });

  it.each([
    ['texto destacado de 121 caracteres', 'menu.highlight', 'a'.repeat(121)],
    ['descripción de promoción de 401 caracteres', 'promo.description', 'a'.repeat(401)],
    ['etiqueta del hero de 41 caracteres', 'hero.showcase.tag', 'a'.repeat(41)],
    ['título del hero de 121 caracteres', 'hero.showcase.title', 'a'.repeat(121)],
    ['unidad del hero de 41 caracteres', 'hero.showcase.unit', 'a'.repeat(41)],
    ['texto obligatorio con solo espacios', 'promo.title', '   '],
    ['badge de promoción vacío', 'promo.badge', ''],
  ])('CA-16/CA-17 (molotes): rechaza %s junto al campo', async (_label, field, value) => {
    const result = await parse('molotes', { ...pageFields('molotes'), [field]: value });
    expect(result.structureError).toBe(false);
    expect(Object.keys(result.errors)).toEqual([field]);
    expect(result.values[field]).toBe(value);
  });

  it('acepta textos en el límite y recorta espacios', async () => {
    const result = await parse('molotes', {
      ...pageFields('molotes'),
      'menu.highlight': `  ${'a'.repeat(120)}  `,
      'promo.description': `${'b'.repeat(400)}\r\n`,
    });
    expect(result.errors).toEqual({});
    expect(result.data.menu.highlight).toBe('a'.repeat(120));
    expect(result.data.promo.description).toBe('b'.repeat(400));
  });

  it('birria: rechaza la descripción del hero de 401 caracteres', async () => {
    const result = await parse('birria', { ...pageFields('birria'), 'hero.showcase.description': 'a'.repeat(401) });
    expect(Object.keys(result.errors)).toEqual(['hero.showcase.description']);
  });
});

describe('createImageChecker', () => {
  const imageExistsOnDisk = createImageChecker(DEFAULT_PUBLIC_DIR);

  it('encuentra imágenes reales de public/img', async () => {
    expect(await imageExistsOnDisk('/img/molotes/molotes-queso-oaxaca.jpg')).toBe(true);
  });

  it.each(['/img/molotes/no-existe.jpg', '/img/molotes', '/img/../css/.gitkeep', '/img/../../package.json'])('rechaza %s', async (src) => {
    expect(await imageExistsOnDisk(src)).toBe(false);
  });
});
