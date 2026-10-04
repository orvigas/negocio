import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR, DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { BUSINESS_IDS, type BusinessId } from '../../src/config/businesses.ts';
import { createImageChecker, parseAdminForm, type AdminFormResult, type ImageExists } from '../../src/services/admin-form.ts';
import type { BirriaChipsItem, BirriaVariantsItem, MenuDataByBusiness } from '../../src/services/menu-schema.ts';
import { renderAdminBusiness } from '../../src/views/admin/index.ts';
import { createRenderer } from '../../src/views/render.ts';
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
    faviconBusinessId: businessId,
  }).toString();
  const fields = formFields(html);
  delete fields._csrf;
  delete fields.expectedVersion;
  return fields;
}

/** Los casos que leen `data` envían el formulario completo y válido: tiene la forma de los datos del negocio. */
type ParsedForm<Id extends BusinessId> = Omit<AdminFormResult, 'data'> & { data: MenuDataByBusiness[Id] };

const parse = <Id extends BusinessId>(businessId: Id, fields: FormFields, options = { imageExists }) =>
  parseAdminForm(businessId, new Map(Object.entries(fields)), seedData(businessId), options) as Promise<ParsedForm<Id>>;

describe('parseAdminForm', () => {
  it.each(BUSINESS_IDS)('%s: el formulario pintado sin cambios reproduce exactamente la semilla', async (businessId) => {
    const result = await parse(businessId, pageFields(businessId));
    expect(result.structureError).toBe(false);
    expect(result.errors).toEqual({});
    expect(result.data).toEqual(seedData(businessId));
  });

  // CA-14: CA-10 a CA-13 en todos los precios de ambos negocios.
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

    it(`${businessId}: el formulario expone todos los precios editables`, () => {
      const expected = businessId === 'molotes' ? 1 + 8 * 2 + 2 : 1 + 3 + 3 * 2;
      expect(priceFields).toHaveLength(expected);
    });

    it.each(PRICE_CASES)(`${businessId}: cada precio con "%s" -> válido=%s`, async (value, valid) => {
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
    const zero = await parse('molotes', { ...base, 'menu.items.0.unitPriceCents': '0' });
    expect(zero.errors['menu.items.0.unitPriceCents']).toMatch(/mayor que \$0/);
    const max = await parse('molotes', { ...base, 'menu.items.0.unitPriceCents': '5000.01' });
    expect(max.errors['menu.items.0.unitPriceCents']).toMatch(/\$5,000\.00/);
  });

  it('CA-15: 45.5 se guarda como 4550 centavos', async () => {
    const result = await parse('birria', { ...pageFields('birria'), 'hero.showcase.priceCents': '45.5' });
    expect(result.data.hero.showcase.priceCents).toBe(4550);
  });

  it('una casilla ausente es "no disponible"; un valor distinto de "on" es un error de estructura', async () => {
    const base = pageFields('birria');
    delete base['menu.items.3.variants.0.available'];
    const hidden = await parse('birria', base);
    expect((hidden.data.menu.items[3] as BirriaVariantsItem).variants[0]!.available).toBe(false);
    const tampered = await parse('birria', { ...pageFields('birria'), 'menu.items.0.available': 'yes' });
    expect(tampered.structureError).toBe(true);
  });

  it.each([
    ['un campo desconocido', (fields: FormFields) => (fields['menu.items.0.secret'] = 'x')],
    ['un producto de más', (fields: FormFields) => (fields['menu.items.6.name'] = 'Nuevo')],
    ['un slug distinto', (fields: FormFields) => (fields['menu.items.0.slug'] = 'otro')],
    ['un tipo de detalle distinto', (fields: FormFields) => (fields['menu.items.0.detailsType'] = 'variants')],
    ['un chip de más', (fields: FormFields) => (fields['menu.items.0.chips.3.text'] = 'Extra')],
    ['un campo de texto ausente', (fields: FormFields) => delete fields['menu.items.0.name']],
    ['un id ausente', (fields: FormFields) => delete fields['menu.items.1.slug']],
    ['reordenar productos', (fields: FormFields) => {
      [fields['menu.items.0.slug'], fields['menu.items.1.slug']] = [fields['menu.items.1.slug']!, fields['menu.items.0.slug']!];
    }],
  ])('CA-18: marca error de estructura con %s', async (_label, mutate) => {
    const fields = pageFields('birria');
    mutate(fields);
    expect((await parse('birria', fields)).structureError).toBe(true);
  });

  it('ignora los campos de control del formulario', async () => {
    const result = await parse('molotes', { ...pageFields('molotes'), _csrf: 'x', author: 'Ana', expectedVersion: '1@x', action: 'save' });
    expect(result.structureError).toBe(false);
  });

  it.each([
    ['alt vacío', 'menu.items.0.image.alt', ''],
    ['ancho no entero', 'menu.items.0.image.width', '10.5'],
    ['ancho 0', 'menu.items.0.image.width', '0'],
    ['alto 4001', 'menu.items.0.image.height', '4001'],
    ['tono fuera de la lista', 'menu.items.0.tone', 'pink'],
    ['icono con mayúsculas', 'drinks.items.0.icon', 'Water'],
    ['icono con guion', 'drinks.items.0.icon', 'water-full'],
    ['cantidad por orden 0', 'menu.items.0.orderQuantity', '0'],
    ['cantidad por orden 21', 'menu.items.0.orderQuantity', '21'],
    ['cantidad por orden decimal', 'menu.items.0.orderQuantity', '2.5'],
    ['nombre de 81 caracteres', 'menu.items.0.name', 'a'.repeat(81)],
    ['badge de 41 caracteres', 'menu.items.0.badge', 'a'.repeat(41)],
    ['descripción de 401 caracteres', 'menu.items.0.description', 'a'.repeat(401)],
    ['texto destacado de 121 caracteres', 'menu.highlight', 'a'.repeat(121)],
    ['descripción de promoción de 401 caracteres', 'promo.description', 'a'.repeat(401)],
    ['etiqueta del hero de 41 caracteres', 'hero.showcase.tag', 'a'.repeat(41)],
    ['texto obligatorio con solo espacios', 'promo.title', '   '],
    ['ruta de imagen con ..', 'menu.items.0.image.src', '/img/../package.json'],
    ['ruta de imagen fuera de /img/', 'menu.items.0.image.src', '/css/molotes/main.jpg'],
    ['ruta de imagen con otra extensión', 'menu.items.0.image.src', '/img/molotes/logo.gif'],
  ])('CA-16/CA-17 (molotes): rechaza %s junto al campo', async (_label, field, value) => {
    const result = await parse('molotes', { ...pageFields('molotes'), [field]: value });
    expect(result.structureError).toBe(false);
    expect(Object.keys(result.errors)).toEqual([field]);
    expect(result.values[field]).toBe(value);
  });

  it('acepta textos en el límite y recorta espacios', async () => {
    const result = await parse('molotes', {
      ...pageFields('molotes'),
      'menu.items.0.name': `  ${'a'.repeat(80)}  `,
      'menu.items.0.orderQuantity': '20',
      'menu.items.0.image.width': '4000',
    });
    expect(result.errors).toEqual({});
    expect(result.data.menu.items[0]!.name).toBe('a'.repeat(80));
    expect(result.data.menu.items[0]!.orderQuantity).toBe(20);
  });

  it('la unidad de precio de Birria es opcional', async () => {
    const result = await parse('birria', { ...pageFields('birria'), 'menu.items.0.priceUnit': '' });
    expect(result.errors).toEqual({});
    expect((result.data.menu.items[0] as BirriaChipsItem).priceUnit).toBe('');
  });

  it('CA-16: rechaza una imagen que no existe en public/img', async () => {
    const result = await parse(
      'molotes',
      { ...pageFields('molotes'), 'menu.items.0.image.src': '/img/molotes/no-existe.jpg' },
      { imageExists: createImageChecker(DEFAULT_PUBLIC_DIR) },
    );
    expect(result.errors).toEqual({ 'menu.items.0.image.src': 'La imagen no existe en public/img/.' });
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
