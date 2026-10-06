import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.ts';
import { createUser, formFields, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';

/**
 * QA (REQ-F-001, R-QA-1): flujo HTTP completo de la administración con el repositorio
 * de archivos real sobre un directorio temporal, sin repositorio en memoria.
 * Verifica el efecto observable en disco (current, previous, registro) y en la landing.
 */

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'qa-admin-files-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const readJson = async (...parts: string[]) => JSON.parse(await readFile(join(dataDir, ...parts), 'utf8'));
const readRaw = (...parts: string[]) => readFile(join(dataDir, ...parts), 'utf8');
const changeLog = async () =>
  (await readRaw('changes.jsonl'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

async function startAdmin() {
  const repository = createFileMenuRepository({ dataDir, timezone: 'America/Mexico_City' });
  await repository.init();
  const context = await setupAdmin({ repository });
  // Cuentas personales (REQ-F-007): el autor de cada cambio es el nombre visible de la sesión.
  const people = { ana: 'Ana QA', a: 'Editor A', b: 'Editor B', rita: 'Rita QA' };
  for (const [username, displayName] of Object.entries(people)) {
    await createUser(context.users, { username, displayName, businesses: ['molotes', 'birria'] });
  }
  const newEditor = (username: keyof typeof people = 'ana') => loginAs(context.browser(), username);
  return { ...context, browser: await newEditor(), newEditor };
}

describe('administración con el repositorio de archivos real', () => {
  it('CA-27: guardar escribe current y previous, registra el cambio y la landing lo muestra sin reiniciar', async () => {
    const { browser, request } = await startAdmin();
    const before = await readJson('molotes', 'current.json');

    const { fields } = await openForm(browser, 'molotes');
    const res = await submitForm(browser, 'molotes', fields, {
      'hero.showcase.priceCents': '150.00',
      'menu.highlight': 'Destacado QA',
    });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/admin\/molotes\?ok=/);

    const current = await readJson('molotes', 'current.json');
    const previous = await readJson('molotes', 'previous.json');
    expect(current.data.hero.showcase.priceCents).toBe(15000);
    // REQ-F-008 (Q-3 A): formato v1 con las listas de productos tal cual.
    expect(current.data.menu.items).toEqual(before.data.menu.items);
    expect(current.data.drinks).toEqual(before.data.drinks);
    expect(current.data.menu.highlight).toBe('Destacado QA');
    expect(current.updatedBy).toBe('Ana QA');
    expect(current.revision).toBe(before.revision + 1);
    expect(previous.data).toEqual(before.data);

    const entry = (await changeLog()).at(-1);
    expect(entry).toMatchObject({ author: 'Ana QA', authorId: expect.any(Number), business: 'molotes', action: 'save' });
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(entry.changes).toEqual(
      expect.arrayContaining([
        { field: 'hero.showcase.priceCents', before: before.data.hero.showcase.priceCents, after: 15000 },
        { field: 'menu.highlight', before: before.data.menu.highlight, after: 'Destacado QA' },
      ]),
    );

    const landing = await request().get('/molotes');
    expect(textOf(landing.text)).toContain('$150 MXN');
    expect(textOf(landing.text)).toContain('Destacado QA');

    const files = await readdir(join(dataDir, 'molotes'));
    expect(files.filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('CA-33: sobrescribir tras conflicto guarda los datos de B, deja los de A como versión anterior y lo registra', async () => {
    // Dos editores (dos navegadores con su propia sesión) sobre la misma app y el mismo archivo.
    const { newEditor } = await startAdmin();
    const a = await newEditor('a');
    const editorB = await newEditor('b');

    const formA = (await openForm(a, 'birria')).fields;
    const formB = (await openForm(editorB, 'birria')).fields;

    const saveA = await submitForm(a, 'birria', formA, { 'promo.title': 'Título de A' });
    expect(saveA.status).toBe(303);
    const afterA = await readRaw('birria', 'current.json');

    const conflict = await submitForm(editorB, 'birria', formB, { 'promo.title': 'Título de B' });
    expect(conflict.status).toBe(409);
    expect(await readRaw('birria', 'current.json')).toBe(afterA);
    expect(textOf(conflict.text)).toContain('Editor A');

    const overwrite = await submitForm(editorB, 'birria', formFields(conflict.text), { action: 'overwrite_after_conflict' });
    expect(overwrite.status).toBe(303);

    expect((await readJson('birria', 'current.json')).data.promo.title).toBe('Título de B');
    expect((await readJson('birria', 'previous.json')).data.promo.title).toBe('Título de A');
    expect((await changeLog()).at(-1)).toMatchObject({ author: 'Editor B', business: 'birria', action: 'overwrite_after_conflict' });
  });

  it('CA-30: restaurar la versión anterior intercambia current y previous y la landing la muestra', async () => {
    const { browser, request, newEditor } = await startAdmin();
    const { fields } = await openForm(browser, 'molotes');
    await submitForm(browser, 'molotes', fields, { 'menu.highlight': 'Versión nueva' });
    const rita = await newEditor('rita');
    const newer = await readJson('molotes', 'current.json');
    const older = await readJson('molotes', 'previous.json');

    const confirm = await rita.get('/admin/molotes/restaurar-anterior');
    expect(confirm.status).toBe(200);
    const csrf = confirm.text.match(/name="_csrf" value="([^"]+)"/)![1];
    const res = await rita.post('/admin/molotes/restaurar-anterior').type('form').send({ _csrf: csrf });
    expect(res.status).toBe(303);

    expect((await readJson('molotes', 'current.json')).data).toEqual(older.data);
    expect((await readJson('molotes', 'previous.json')).data).toEqual(newer.data);
    expect((await changeLog()).at(-1)).toMatchObject({ author: 'Rita QA', business: 'molotes', action: 'restore_previous' });
    expect(textOf((await request().get('/molotes')).text)).toContain(older.data.menu.highlight);
  });

  it('CA-36 y RF-8.5: un daño con el servidor en marcha mantiene la landing, bloquea la edición y restaurar la semilla la desbloquea', async () => {
    const { browser, request } = await startAdmin();
    const landingBefore = (await request().get('/birria')).text;
    await writeFile(join(dataDir, 'birria', 'current.json'), '{ roto');

    const landing = await request().get('/birria');
    expect(landing.status).toBe(200);
    expect(landing.text).toBe(landingBefore);

    const page = await browser.get('/admin/birria');
    expect(page.status).toBe(200);
    expect(textOf(page.text)).toContain('Los datos guardados están dañados');
    expect(page.text).toMatch(/<fieldset[^>]*disabled/);
    const files = await readdir(join(dataDir, 'birria'));
    expect(files.some((name) => /^damaged-.+\.json$/.test(name))).toBe(true);
    expect(files).toContain('damaged.marker.json');

    const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)![1];
    const blocked = await browser
      .post('/admin/birria')
      .type('form')
      .send({ ...formFields(page.text), _csrf: csrf, action: 'save' });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    expect(blocked.status).toBeLessThan(500);

    const restore = await browser.post('/admin/birria/restaurar-semilla').type('form').send({ _csrf: csrf });
    expect(restore.status).toBe(303);
    expect((await changeLog()).at(-1)).toMatchObject({ author: 'Ana QA', business: 'birria', action: 'restore_seed' });
    expect(await readdir(join(dataDir, 'birria'))).not.toContain('damaged.marker.json');

    const unlocked = await browser.get('/admin/birria');
    expect(unlocked.text).not.toMatch(/<fieldset[^>]*disabled/);
    expect(textOf(unlocked.text)).not.toContain('Los datos guardados están dañados');
  });
});
