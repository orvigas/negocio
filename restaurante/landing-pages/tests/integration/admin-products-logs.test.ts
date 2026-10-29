import { describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, login, setupAdmin } from '../support/admin.ts';
import { adminSql } from '../support/database.ts';
import { VALID_INPUTS } from '../support/products.ts';

/**
 * Los logs y las respuestas de la API de productos no filtran secretos ni detalles internos
 * (REQ-F-008, CA-24, DT-15 y la regla de logging). Ampliación de QA aprobada por el usuario (P-2).
 *
 * Se recorre una sesión completa con MySQL real (acceso, token CSRF, escrituras correctas,
 * 403, 409, 413, 415, 422 y fallos reales de la base con el servidor en marcha) y se comprueba
 * que ni el log ni los cuerpos de respuesta contienen la contraseña, el token CSRF, la cookie de
 * sesión, el mensaje de MySQL o Prisma, SQL, credenciales de la base, rutas del sistema ni stack traces.
 */

const API = '/admin/api';
const MOLOTES = `${API}/molotes/productos`;
const MYSQL_MESSAGE = 'qa-mensaje-interno-de-mysql';

describe('logs y respuestas sin secretos ni detalles internos (P-2)', () => {
  it('una sesión completa con errores y fallos reales de la base no filtra nada', async () => {
    // Entorno por defecto de las pruebas (no development: ahí el manejador de errores expone el stack a propósito).
    const context = await setupAdmin();
    const { logger, database } = context;
    const browser = context.browser();
    const bodies: string[] = [];
    const track = <T extends { text: string; status: number }>(res: T): T => {
      bodies.push(res.text);
      return res;
    };

    // Acceso fallido y correcto (la contraseña viaja en el formulario).
    track(await login(context.browser(), { password: `${ADMIN_PASSWORD}-mal` }));
    const access = track(await login(browser));
    expect(access.status).toBe(303);
    const cookies = ([] as string[]).concat(access.headers['set-cookie'] ?? []);
    const cookieValues = cookies.map((cookie) => cookie.split(';')[0]!.split('=').slice(1).join('=')).filter((value) => value.length >= 16);
    expect(cookieValues.length).toBeGreaterThan(0);

    const session = track(await browser.get(`${API}/sesion`));
    const csrf = session.body.csrfToken as string;
    expect(csrf.length).toBeGreaterThanOrEqual(16);

    // Escrituras correctas y errores de cliente.
    const created = track(await browser.post(MOLOTES).set('X-CSRF-Token', csrf).send({ category: 'bebida', ...VALID_INPUTS.molotesBebida }));
    expect(created.status).toBe(201);
    const { id } = created.body.product as { id: number };
    const body = { ...VALID_INPUTS.molotesBebida, available: true };
    expect(track(await browser.put(`${MOLOTES}/${id}`).set('X-CSRF-Token', csrf).send({ ...body, version: 1 })).status).toBe(200);
    expect(track(await browser.put(`${MOLOTES}/${id}`).set('X-CSRF-Token', csrf).send({ ...body, version: 1 })).status).toBe(409);
    expect(track(await browser.put(`${MOLOTES}/${id}`).set('X-CSRF-Token', csrf).send({ ...body, price: 0, version: 2 })).status).toBe(422);
    expect(track(await browser.put(`${MOLOTES}/${id}`).set('X-CSRF-Token', `${csrf}x`).send({ ...body, version: 2 })).status).toBe(403);
    expect(track(await browser.post(MOLOTES).set('X-CSRF-Token', csrf).set('Content-Type', 'text/plain').send('hola')).status).toBe(415);
    expect(track(await browser.post(MOLOTES).set('X-CSRF-Token', csrf).set('Content-Type', 'application/json').send('{"name":')).status).toBe(400);
    expect(track(await browser.post(MOLOTES).set('X-CSRF-Token', csrf).send({ name: 'x'.repeat(40 * 1024) })).status).toBe(413);

    // Fallo real de MySQL en una escritura: el mensaje del trigger llega en el error de Prisma.
    // (El usuario de la app no tiene DDL: el trigger lo crea el usuario admin de pruebas.)
    await adminSql(database.name, `CREATE TRIGGER qa_fail BEFORE INSERT ON product_change FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${MYSQL_MESSAGE}'`);
    const failedWrite = track(await browser.put(`${MOLOTES}/${id}`).set('X-CSRF-Token', csrf).send({ ...body, version: 2 }));
    expect(failedWrite.status).toBe(503);
    expect(failedWrite.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } });

    // Fallo real de MySQL en una lectura (la tabla deja de existir) por la API y por el HTML.
    await adminSql(database.name, 'RENAME TABLE product TO product_qa_renombrada');
    const failedRead = track(await browser.get(MOLOTES));
    expect(failedRead.status).toBe(503);
    expect(failedRead.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(track(await browser.get('/admin/molotes')).status).toBe(503);
    // La landing sigue respondiendo con la caché (CA-35).
    expect(track(await context.request().get('/molotes')).status).toBe(200);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'database_unavailable' }));

    const logText = JSON.stringify(logger.lines);
    // Ni la contraseña de la base ni su usuario (CA-8, REQ-F-014).
    const secrets = [ADMIN_PASSWORD, csrf, ...cookieValues, database.config.password, database.config.user];
    const internals = [
      MYSQL_MESSAGE,
      'product_qa_renombrada',
      "doesn't exist",
      'SIGNAL',
      'SELECT ',
      'INSERT INTO',
      'UPDATE "',
      'prisma.',
      'Invalid `',
      database.name,
      'mysql://',
      '/Users/',
      '\\n    at ',
      '"stack"',
    ];
    for (const value of [...secrets, ...internals]) {
      expect(logText.includes(value), `log contiene ${value.slice(0, 40)}`).toBe(false);
    }
    // Las respuestas solo pueden llevar el token CSRF en GET /admin/api/sesion (y en formularios HTML).
    for (const [index, text] of bodies.entries()) {
      for (const value of [ADMIN_PASSWORD, ...cookieValues, ...internals]) {
        expect(text.includes(value), `respuesta ${index} contiene ${value.slice(0, 40)}`).toBe(false);
      }
    }
    // Tampoco la contraseña equivocada del acceso fallido.
    expect(logText).not.toContain(`${ADMIN_PASSWORD}-mal`);
  });
});
