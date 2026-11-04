import Koa from 'koa';
import { describe, expect, it, vi } from 'vitest';

import { createLandingNotifier } from '../../src/notifier.ts';
import { ADMIN, call, session, startAdmin, type AdminHarness, type Session } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { makeBotHarness, mx, WEEK } from '../support/whatsapp.ts';

/**
 * Frescura del catálogo del bot en la api (REQ-F-042, RF-10 y CA-9): el bot usa el mismo repositorio
 * de productos que /api/v1/admin, que recarga su caché en cada escritura confirmada. Un producto que
 * el admin nuevo marca como no disponible deja de ofrecerse en el siguiente mensaje, sin esperar a la
 * recarga de 60 s ni al aviso interno.
 */

const P = '/api/v1/admin';

async function markUnavailable(admin: AdminHarness, ana: Session) {
  const [queso] = (await admin.products.list('molotes')).filter((product) => product.name === 'Molote de Queso');
  if (!queso) throw new Error('Falta el producto de la prueba');
  return call(admin.url, `${P}/molotes/productos/${queso.id}`, ana, {
    method: 'PUT',
    body: {
      category: 'platillo',
      name: queso.name,
      description: queso.description,
      label: queso.label,
      tone: queso.tone,
      price: ((queso.priceCents ?? 0) / 100).toFixed(2),
      orderPrice: ((queso.orderPriceCents ?? 0) / 100).toFixed(2),
      orderQuantity: queso.orderQuantity,
      image: queso.image,
      available: false,
      version: queso.version,
    },
  });
}

describe('catálogo del bot tras una escritura del admin nuevo (CA-9)', () => {
  it('el producto marcado como no disponible deja de ofrecerse en el siguiente mensaje', async () => {
    const admin = await startAdmin();
    const h = await makeBotHarness({ at: mx(`${WEEK.tue}T10:00`), products: admin.products });
    expect(await h.ask('menú')).toContain('*Molote de Queso*');

    const res = await markUnavailable(admin, await session(admin.url, ADMIN));
    expect(res.status).toBe(200);

    const menu = await h.ask('menú');
    expect(menu).not.toContain('*Molote de Queso*');
    expect(menu).toContain('*Café de Olla*');
  });
});

interface WriteBody {
  product: { available: boolean };
  meta: unknown;
}

/** Aviso interno real contra un doble de landing-pages que confirma la landing. */
async function startWithConfirmingLanding() {
  const landing = new Koa();
  landing.use((ctx) => {
    ctx.body = { landing: true };
  });
  const { url } = await listenLocal(landing);
  return startAdmin({ realNotifier: createLandingNotifier({ url, token: 'a'.repeat(64), retryDelaysMs: [] }) });
}

describe('frescura veraz: el bot lee la caché de la api (RF-10, DEF-001 de QA)', () => {
  it('con la caché al día y la landing confirmada, confirmed', async () => {
    const admin = await startWithConfirmingLanding();
    const res = await markUnavailable(admin, await session(admin.url, ADMIN));
    expect(res.status).toBe(200);
    expect(((await res.json()) as WriteBody).meta).toEqual({ freshness: 'confirmed' });
  });

  it('si falla la recarga tras la escritura: la escritura responde bien, pending aunque la landing confirme, y el bot lo ve al recargar', async () => {
    const admin = await startWithConfirmingLanding();
    const h = await makeBotHarness({ at: mx(`${WEEK.tue}T10:00`), products: admin.products });
    const ana = await session(admin.url, ADMIN);

    // El fallo se arma tras confirmar la transacción: la siguiente lectura es la recarga de la caché.
    const transaction = admin.store.transaction.bind(admin.store);
    vi.spyOn(admin.store, 'transaction').mockImplementationOnce(async (task) => {
      const result = await transaction(task);
      admin.store.failNext();
      return result;
    });
    const res = await markUnavailable(admin, ana);

    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteBody;
    expect(body.product.available).toBe(false);
    expect(body.meta).toEqual({ freshness: 'pending' });
    expect(await h.ask('menú')).toContain('*Molote de Queso*');

    expect(admin.products.isCacheFresh('molotes')).toBe(false);
    expect(await admin.products.reload('molotes')).toBe(true);
    expect(admin.products.isCacheFresh('molotes')).toBe(true);
    expect(await h.ask('menú')).not.toContain('*Molote de Queso*');
  });
});
