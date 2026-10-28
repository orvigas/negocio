import { describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  conflictErrorSchema,
  loginResponseSchema,
  productFieldsResponseSchema,
  productListResponseSchema,
  productWriteResponseSchema,
  sessionResponseSchema,
  validationErrorSchema,
} from '@restaurante/contracts';
import { MAX_ACTIVE_PRODUCTS } from '@restaurante/core/catalog';
import { SESSION_IDLE_MS } from '@restaurante/core/identity';

import {
  ADMIN,
  EXISTING_IMAGE,
  MOLOTES_EDITOR,
  PASSWORD,
  call,
  login,
  nextIp,
  session,
  startAdmin,
  type AdminHarness,
} from '../support/admin.ts';

/**
 * API de administración `/api/v1/admin` (REQ-F-039): acceso (RF-1 a RF-5), permisos (RF-6) y
 * productos (RF-7 a RF-12), en proceso con el store en memoria.
 */

const P = '/api/v1/admin';

const molotesInput = (name: string, src = EXISTING_IMAGE) => ({
  category: 'platillo',
  name,
  description: 'Masa rellena.',
  label: 'Nuevo',
  tone: 'sky',
  price: '25.00',
  orderPrice: '70.00',
  orderQuantity: 3,
  image: { src, alt: name, width: 800, height: 600 },
});

async function molotesProducts(h: AdminHarness, includeDeleted = false) {
  return (await h.store.listBusiness('molotes')).filter((product) => includeDeleted || !product.deleted);
}

describe('acceso (RF-1 a RF-4)', () => {
  it('entrar: 201 con id de sesión, token CSRF y usuario (con sus negocios); registra el acceso', async () => {
    const h = await startAdmin();
    const res = await login(h.url, MOLOTES_EDITOR.username);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(loginResponseSchema.safeParse(body).success).toBe(true);
    expect(body.user).toEqual({ id: h.ids.eli, name: 'Eli Molotes', role: 'editor', businesses: ['molotes'] });
    expect(body.session.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(h.calls.recordLogin).toBe(1);
  });

  it.each([
    ['contraseña incorrecta', { username: 'eli', password: 'otra' }],
    ['usuario inexistente', { username: 'nadie', password: PASSWORD }],
    ['cuerpo sin contraseña', { username: 'eli' }],
  ])('credenciales inválidas (%s): 401 genérico, sin sesión', async (_name, body) => {
    const h = await startAdmin();
    const res = await fetch(`${h.url}${P}/sesion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': nextIp() },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' } });
  });

  it('una cuenta desactivada no puede entrar (misma respuesta)', async () => {
    const h = await startAdmin();
    h.change(h.ids.eli as number, { active: false });
    expect((await login(h.url, 'eli')).status).toBe(401);
  });

  it('sin una IP válida en X-Forwarded-For: 400 (no se mezclan los intentos)', async () => {
    const h = await startAdmin();
    for (const headers of [{}, { 'X-Forwarded-For': 'no-es-ip' }] as Record<string, string>[]) {
      const res = await fetch(`${h.url}${P}/sesion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ username: 'eli', password: PASSWORD }),
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('CLIENT_IP_REQUIRED');
    }
  });

  it('límite de intentos por la IP del visitante (CA-2): 429 sin comprobar la contraseña; otra IP no queda afectada', async () => {
    const h = await startAdmin();
    const ip = nextIp();
    for (let attempt = 1; attempt <= 4; attempt += 1) expect((await login(h.url, 'eli', 'mal', ip)).status).toBe(401);
    expect((await login(h.url, 'eli', 'mal', ip)).status).toBe(429);
    const checked = h.calls.findCredentials;
    const locked = await login(h.url, 'eli', PASSWORD, ip);
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBe('900');
    expect((await locked.json()).error.code).toBe('LOGIN_LOCKED');
    expect(h.calls.findCredentials).toBe(checked);
    // La IP es el último valor de X-Forwarded-For (la que pone el admin), no la del socket.
    expect((await login(h.url, 'eli', PASSWORD, `${ip}, 198.51.100.7`)).status).toBe(201);
    expect((await login(h.url, 'eli', PASSWORD, nextIp())).status).toBe(201);
  });

  it('sesión vigente: usuario y token CSRF; sin sesión o con un id desconocido, 401', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/sesion`, auth);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(sessionResponseSchema.safeParse(body).success).toBe(true);
    expect(body.csrfToken).toBe(auth.csrfToken);
    expect((await call(h.url, `${P}/sesion`, null)).status).toBe(401);
    const unknown = await call(h.url, `${P}/sesion`, { id: 'x'.repeat(43), csrfToken: 'y' });
    expect(await unknown.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar.' } });
  });

  it('caduca tras 2 h sin actividad y se renueva con cada petición (CA-3)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    h.clock.now = new Date(h.clock.now.getTime() + SESSION_IDLE_MS - 1000);
    expect((await call(h.url, `${P}/sesion`, auth)).status).toBe(200);
    h.clock.now = new Date(h.clock.now.getTime() + SESSION_IDLE_MS - 1000);
    expect((await call(h.url, `${P}/sesion`, auth)).status).toBe(200);
    h.clock.now = new Date(h.clock.now.getTime() + SESSION_IDLE_MS);
    expect((await call(h.url, `${P}/sesion`, auth)).status).toBe(401);
  });

  it('deja de valer si la cuenta se desactiva o cambia su sessionVersion (CA-3)', async () => {
    const h = await startAdmin();
    const first = await session(h.url, MOLOTES_EDITOR);
    h.change(h.ids.eli as number, { sessionVersion: 2 });
    expect((await call(h.url, `${P}/sesion`, first)).status).toBe(401);
    const second = await session(h.url, MOLOTES_EDITOR);
    h.change(h.ids.eli as number, { active: false });
    expect((await call(h.url, `${P}/sesion`, second)).status).toBe(401);
  });

  it('salir exige el token CSRF y después la sesión ya no vale (RF-4)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    expect((await call(h.url, `${P}/sesion`, auth, { method: 'DELETE', csrf: null })).status).toBe(403);
    expect((await call(h.url, `${P}/sesion`, auth, { method: 'DELETE' })).status).toBe(204);
    expect((await call(h.url, `${P}/sesion`, auth)).status).toBe(401);
  });

  it('el log nunca lleva contraseñas, ids de sesión ni tokens CSRF (CA-16)', async () => {
    const h = await startAdmin();
    await login(h.url, 'eli', 'contraseña-equivocada');
    const auth = await session(h.url, MOLOTES_EDITOR);
    await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Log') });
    await call(h.url, `${P}/sesion`, auth, { method: 'DELETE', csrf: 'token-ajeno' });
    const log = h.logger.lines.join('\n');
    for (const secret of [PASSWORD, 'contraseña-equivocada', auth.id, auth.csrfToken, 'token-ajeno']) expect(log).not.toContain(secret);
    expect(log).toContain('admin_login_failed');
    expect(log).toContain('admin_csrf_rejected');
  });
});

describe('permisos (RF-6, CA-4)', () => {
  it('sin sesión: 401; negocio inexistente: 404; negocio ajeno: 403 sin datos', async () => {
    const h = await startAdmin();
    expect((await call(h.url, `${P}/molotes/productos`, null)).status).toBe(401);
    const auth = await session(h.url, MOLOTES_EDITOR);
    const unknown = await call(h.url, `${P}/tacos/productos`, auth);
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe('BUSINESS_NOT_FOUND');
    for (const path of [`${P}/birria/productos`, `${P}/birria/productos/1`, `${P}/birria/productos/campos?categoria=platillo&tipo=chips`]) {
      const res = await call(h.url, path, auth);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: { code: 'FORBIDDEN_BUSINESS', message: 'No tienes permiso sobre este negocio.' } });
    }
    const write = await call(h.url, `${P}/birria/productos`, auth, { method: 'POST', body: { category: 'platillo' } });
    expect(write.status).toBe(403);
    expect((await call(h.url, `${P}/molotes/productos`, auth)).status).toBe(200);
  });

  it('el administrador puede en los dos negocios', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, ADMIN);
    for (const business of ['molotes', 'birria']) expect((await call(h.url, `${P}/${business}/productos`, auth)).status).toBe(200);
  });
});

describe('CSRF en las escrituras (D-2, CA-5)', () => {
  it('sin token, con el de otra sesión o con uno inventado: 403 y nada cambia', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const other = await session(h.url, ADMIN);
    const before = JSON.stringify(await molotesProducts(h, true));
    for (const csrf of [null, other.csrfToken, 'inventado']) {
      const res = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote CSRF'), csrf });
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe('CSRF_INVALID');
      const update = await call(h.url, `${P}/molotes/productos/1`, auth, { method: 'PUT', body: { version: 1 }, csrf });
      expect(update.status).toBe(403);
    }
    expect(JSON.stringify(await molotesProducts(h, true))).toBe(before);
  });
});

describe('productos (RF-7 a RF-12)', () => {
  it('listar: activos por categoría y en su orden; ?eliminados=1 incluye los eliminados; ?categoria filtra', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/molotes/productos`, auth);
    const body = await res.json();
    expect(productListResponseSchema.safeParse(body).success).toBe(true);
    expect(body.products.map((product: { slug: string }) => product.slug)).toEqual(['cafe', 'queso']);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const all = await (await call(h.url, `${P}/molotes/productos?eliminados=1`, auth)).json();
    expect(all.products.map((product: { slug: string }) => product.slug)).toContain('oculto');
    const drinks = await (await call(h.url, `${P}/molotes/productos?categoria=bebida`, auth)).json();
    expect(drinks.products.map((product: { slug: string }) => product.slug)).toEqual(['cafe']);
    expect((await call(h.url, `${P}/molotes/productos?categoria=postre`, auth)).status).toBe(422);
  });

  it('crear: 201, no disponible, al final de su categoría, slug único, historial con el autor y aviso a las landings (CA-6)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote de Queso') });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(productWriteResponseSchema.safeParse(body).success).toBe(true);
    expect(body.product).toMatchObject({ available: false, position: 2, slug: 'molote-de-queso', updatedBy: { id: h.ids.eli, name: 'Eli Molotes' } });
    expect(body.meta).toEqual({ freshness: 'confirmed' });
    expect(res.headers.get('location')).toBe(`${P}/molotes/productos/${body.product.id}`);
    expect(h.notified).toEqual(['molotes']);
    // Con el mismo nombre, otro slug.
    const again = await (await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote de Queso') })).json();
    expect(again.product.slug).not.toBe('molote-de-queso');
  });

  it('frescura pendiente si landing-pages no confirma (RF-12)', async () => {
    const h = await startAdmin();
    h.notifier.freshness = 'pending';
    const auth = await session(h.url, MOLOTES_EDITOR);
    const body = await (await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Pendiente') })).json();
    expect(body.meta).toEqual({ freshness: 'pending' });
  });

  it('validación por campo: 422 con fields; nada se guarda', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: { ...molotesInput(''), price: 'abc', extra: 1 } });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(validationErrorSchema.safeParse(body).success).toBe(true);
    expect(Object.keys(body.error.fields)).toEqual(expect.arrayContaining(['name', 'price', 'extra']));
    expect(h.notified).toEqual([]);
  });

  it('imagen inexistente: 422 en image.src; una existente se acepta (CA-12)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const missing = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Sin Foto', '/img/molotes/no-existe.jpg') });
    expect(missing.status).toBe(422);
    expect((await missing.json()).error.fields).toEqual({ 'image.src': 'La imagen no existe en public/img/.' });
    expect((await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Con Foto') })).status).toBe(201);
  });

  it(`máximo de ${MAX_ACTIVE_PRODUCTS} productos activos (RF-7)`, async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const active = (await molotesProducts(h)).length;
    for (let index = active; index < MAX_ACTIVE_PRODUCTS; index += 1) {
      expect((await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput(`Molote ${index}`) })).status).toBe(201);
    }
    const over = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Uno de más') });
    expect(over.status).toBe(422);
    expect(Object.keys((await over.json()).error.fields)).toEqual(['']);
  });

  it('Idempotency-Key: el mismo envío dos veces crea un solo producto (doble envío)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const headers = { 'Idempotency-Key': 'clave-de-prueba-0001' };
    const [first, second] = await Promise.all([
      call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Doble'), headers }),
      call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Doble'), headers }),
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect((await first.json()).product.id).toBe((await second.json()).product.id);
    expect((await molotesProducts(h)).filter((product) => product.name === 'Molote Doble')).toHaveLength(1);
    const bad = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('X'), headers: { 'Idempotency-Key': 'corta' } });
    expect(bad.status).toBe(400);
  });

  it('Idempotency-Key (DEF-002): otro negocio es otra alta; otro cuerpo con la misma clave, 422 sin crear nada', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, ADMIN);
    const headers = { 'Idempotency-Key': 'clave-de-prueba-0002' };
    const molotes = await (await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Clave'), headers })).json();
    const birriaBody = { category: 'platillo', detailsType: 'portion', name: 'Tazón Clave', label: 'Grande', description: 'Caldo.', price: '140', image: { src: EXISTING_IMAGE, alt: 'Tazón', width: 800, height: 600 }, detailsLabel: 'Porción:', portion: '500ml', portionExtra: 'Con tuétano' };
    const birria = await call(h.url, `${P}/birria/productos`, auth, { method: 'POST', body: birriaBody, headers });
    expect(birria.status).toBe(201);
    const created = (await birria.json()).product;
    expect(created).toMatchObject({ business: 'birria', name: 'Tazón Clave' });
    expect(created.id).not.toBe(molotes.product.id);
    const before = (await molotesProducts(h)).length;
    const reused = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Otro Nombre'), headers });
    expect(reused.status).toBe(422);
    expect((await reused.json()).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await molotesProducts(h)).length).toBe(before);
  });

  it('editar con version; otra versión: 409 con la vigente, quién y cuándo; nada se sobrescribe (CA-7)', async () => {
    const h = await startAdmin();
    const eli = await session(h.url, MOLOTES_EDITOR);
    const ana = await session(h.url, ADMIN);
    const created = (await (await call(h.url, `${P}/molotes/productos`, eli, { method: 'POST', body: molotesInput('Molote Editable') })).json()).product;
    const edit = (name: string, version: number) => ({ ...molotesInput(name), available: true, version });
    const first = await call(h.url, `${P}/molotes/productos/${created.id}`, ana, { method: 'PUT', body: edit('Molote de Ana', 1) });
    expect(first.status).toBe(200);
    const stale = await call(h.url, `${P}/molotes/productos/${created.id}`, eli, { method: 'PUT', body: edit('Molote de Eli', 1) });
    expect(stale.status).toBe(409);
    const conflict = await stale.json();
    expect(conflictErrorSchema.safeParse(conflict).success).toBe(true);
    expect(conflict.error.current).toMatchObject({ id: created.id, version: 2, updatedBy: 'Ana Admin' });
    expect(conflict.error.current.updatedAt).toMatch(/-06:00$/);
    expect((await h.store.listBusiness('molotes')).find((product) => product.id === created.id)?.name).toBe('Molote de Ana');
    // Volver a aplicar sus cambios sobre la versión vigente (RF-9).
    const overwrite = await call(h.url, `${P}/molotes/productos/${created.id}?sobrescribir=1`, eli, { method: 'PUT', body: edit('Molote de Eli', 2) });
    expect(overwrite.status).toBe(200);
    expect((await overwrite.json()).product).toMatchObject({ name: 'Molote de Eli', version: 3, available: true });
  });

  it('producto inexistente o con id inválido: 404', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    for (const id of ['999', 'abc', '0']) {
      const res = await call(h.url, `${P}/molotes/productos/${id}`, auth);
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe('PRODUCT_NOT_FOUND');
    }
  });

  it('eliminar (borrado lógico) y recuperar: vuelve al final y no disponible', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const removed = await call(h.url, `${P}/molotes/productos/1?version=1`, auth, { method: 'DELETE' });
    expect(removed.status).toBe(200);
    const product = (await removed.json()).product;
    expect(product).toMatchObject({ deleted: true, version: 2 });
    expect((await call(h.url, `${P}/molotes/productos/1?version=1`, auth, { method: 'DELETE' })).status).toBe(422);
    const restored = await call(h.url, `${P}/molotes/productos/1/recuperar`, auth, { method: 'POST', body: { version: 2 } });
    expect(restored.status).toBe(200);
    expect((await restored.json()).product).toMatchObject({ deleted: false, available: false, version: 3 });
    expect((await call(h.url, `${P}/molotes/productos/1/recuperar`, auth, { method: 'POST', body: { version: 3, otro: 1 } })).status).toBe(422);
  });

  it('mover arriba y abajo con version, y reordenar la categoría completa', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const created = (await (await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', body: molotesInput('Molote Segundo') })).json()).product;
    const moved = await call(h.url, `${P}/molotes/productos/${created.id}/mover`, auth, { method: 'POST', body: { direction: 'up', version: 1 } });
    expect(moved.status).toBe(200);
    const list = await moved.json();
    expect(list.meta).toEqual({ freshness: 'confirmed' });
    const platillos = list.products.filter((product: { category: string }) => product.category === 'platillo');
    expect(platillos.map((product: { slug: string }) => product.slug)).toEqual(['molote-segundo', 'queso']);
    const stale = await call(h.url, `${P}/molotes/productos/${created.id}/mover`, auth, { method: 'POST', body: { direction: 'down', version: 1 } });
    expect(stale.status).toBe(409);
    const bad = await call(h.url, `${P}/molotes/productos/${created.id}/mover`, auth, { method: 'POST', body: { direction: 'izquierda', version: 2 } });
    expect(bad.status).toBe(422);
    const current = (await h.store.listBusiness('molotes')).filter((product) => product.category === 'platillo' && !product.deleted);
    const order = [...current].sort((a, b) => b.position - a.position).map((product) => ({ id: product.id, version: product.version }));
    const reordered = await call(h.url, `${P}/molotes/productos/orden`, auth, { method: 'PUT', body: { category: 'platillo', items: order } });
    expect(reordered.status).toBe(200);
  });

  it('descriptor del formulario de una combinación (sale de core)', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, ADMIN);
    const res = await call(h.url, `${P}/birria/productos/campos?categoria=platillo&tipo=variants`, auth);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(productFieldsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.create.some((field: { name: string }) => field.name === 'available')).toBe(false);
    expect(body.update.some((field: { name: string }) => field.name === 'available')).toBe(true);
    expect(body.create).toContainEqual({ name: 'variants.0.price', group: 'variants', slot: 0, kind: 'price', label: 'Precio' });
    expect(body.create).toContainEqual({ name: 'name', group: 'main', kind: 'text', label: 'Nombre', max: 80, optional: false });
    for (const query of ['categoria=bebida', 'categoria=platillo', 'categoria=platillo&tipo=otro']) {
      const bad = await call(h.url, `${P}/birria/productos/campos?${query}`, auth);
      expect(bad.status).toBe(400);
      expect((await bad.json()).error.code).toBe('INVALID_KIND');
    }
    const drink = await (await call(h.url, `${P}/molotes/productos/campos?categoria=bebida`, auth)).json();
    expect(drink.create.find((field: { name: string }) => field.name === 'tone')).toMatchObject({ kind: 'enum', options: ['amber', 'red'] });
  });
});

describe('errores de la API', () => {
  it('otro método en una ruta conocida: 405 con Allow; ruta desconocida: 404', async () => {
    const h = await startAdmin();
    const res = await fetch(`${h.url}${P}/sesion`, { method: 'PATCH' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('POST');
    expect(apiErrorSchema.safeParse(await res.json()).success).toBe(true);
    const missing = await fetch(`${h.url}${P}/nada`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('NOT_FOUND');
  });

  it('cuerpo que no es JSON: 415; JSON inválido: 400', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const text = await call(h.url, `${P}/molotes/productos`, auth, { method: 'POST', headers: { 'Content-Type': 'text/plain' } });
    expect(text.status).toBe(415);
    const res = await fetch(`${h.url}${P}/molotes/productos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.id}`, 'X-CSRF-Token': auth.csrfToken, 'Content-Type': 'application/json' },
      body: '{roto',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_JSON');
  });
});
