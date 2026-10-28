import { describe, expect, it, vi } from 'vitest';

import { NOTIFY_PATH, createLandingNotifier, type NotifyFetch } from '../../src/notifier.ts';
import { recordingLogger } from '../support/admin.ts';

/**
 * Aviso interno de la API a landing-pages (REQ-F-039, RF-12 a RF-14; CA-11): frescura honesta,
 * reintentos acotados, agrupación por negocio y sin el token en el log.
 */

const TOKEN = 't'.repeat(64);
const URL_BASE = 'http://app:3002';
const FIRST_WAIT = 2000;

type Reply = Response | Error | (() => Promise<Response>);

function setup(replies: Reply[], { firstWaitMs = FIRST_WAIT }: { firstWaitMs?: number } = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const delays: number[] = [];
  const logger = recordingLogger();
  const fetch: NotifyFetch = async (url, init) => {
    requests.push({ url, init });
    const reply = replies.shift() ?? new Error('sin respuesta');
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply() : reply;
  };
  // La espera de la escritura (firstWaitMs) es real y corta; los reintentos no esperan, pero se anotan.
  const sleep = (ms: number) => {
    if (ms === firstWaitMs) return new Promise<void>((resolve) => setTimeout(resolve, 200));
    delays.push(ms);
    return Promise.resolve();
  };
  const notifier = createLandingNotifier({ url: URL_BASE, token: TOKEN, fetch, logger, firstWaitMs, sleep });
  const events = () => logger.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { notifier, requests, delays, logger, events };
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('aviso interno a landing-pages', () => {
  it('confirmed si landing-pages confirma la landing y el bot; envía el negocio con la credencial', async () => {
    const { notifier, requests } = setup([ok({ landing: true, bot: true })]);
    expect(await notifier.notify('birria')).toBe('confirmed');
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe(`${URL_BASE}${NOTIFY_PATH}`);
    expect(request?.init.method).toBe('POST');
    expect(request?.init.body).toBe(JSON.stringify({ business: 'birria' }));
    expect(new Headers(request?.init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(request?.init.redirect).toBe('error');
  });

  it('entregado sin confirmar la landing: pending y sin reintentos', async () => {
    const { notifier, requests, delays } = setup([ok({ landing: false, bot: true })]);
    expect(await notifier.notify('molotes')).toBe('pending');
    expect(requests).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('caído: pending al momento, reintentos a 1 s, 5 s y 30 s y, al agotarlos, gave_up en el log (CA-11)', async () => {
    const { notifier, requests, delays, events } = setup([new TypeError('fetch failed'), new Response('', { status: 503 }), new TypeError('x'), new TypeError('y')]);
    expect(await notifier.notify('molotes')).toBe('pending');
    await vi.waitFor(() => expect(events().some((event) => event.msg === 'products_notify_gave_up')).toBe(true));
    expect(requests).toHaveLength(4);
    expect(delays).toEqual([1000, 5000, 30_000]);
    const failed = events().filter((event) => event.msg === 'products_notify_failed');
    expect(failed.map((event) => event.reason)).toEqual(['network', 'http_status', 'network', 'network']);
    expect(failed[1]).toMatchObject({ status: 503, business: 'molotes', attempt: 2 });
  });

  it('se recupera en un reintento: products_notify_recovered', async () => {
    const { notifier, events } = setup([new TypeError('x'), ok({ landing: true, bot: true })]);
    expect(await notifier.notify('molotes')).toBe('pending');
    await vi.waitFor(() => expect(events().some((event) => event.msg === 'products_notify_recovered')).toBe(true));
  });

  it('credencial rechazada (401): se registra y no se reintenta', async () => {
    const { notifier, requests, events } = setup([new Response('', { status: 401 })]);
    expect(await notifier.notify('molotes')).toBe('pending');
    await vi.waitFor(() => expect(events().some((event) => event.msg === 'products_notify_failed')).toBe(true));
    expect(events().find((event) => event.msg === 'products_notify_failed')).toMatchObject({ reason: 'rejected', status: 401 });
    expect(requests).toHaveLength(1);
  });

  it('respuesta lenta: la escritura no espera más de firstWaitMs (pending) y el aviso sigue', async () => {
    let release: (response: Response) => void = () => {};
    const slow = () => new Promise<Response>((resolve) => (release = resolve));
    const { notifier, requests } = setup([slow]);
    expect(await notifier.notify('birria')).toBe('pending');
    expect(requests).toHaveLength(1);
    release(ok({ landing: true, bot: true }));
  });

  it('una escritura con un intento en vuelo no lanza otro en paralelo; otro negocio sí', async () => {
    let release: (response: Response) => void = () => {};
    const slow = () => new Promise<Response>((resolve) => (release = resolve));
    const { notifier, requests } = setup([slow, ok({ landing: true, bot: true }), ok({ landing: true, bot: true })]);
    const first = notifier.notify('molotes');
    const second = notifier.notify('molotes');
    expect(await notifier.notify('birria')).toBe('confirmed');
    expect(requests.map((request) => request.init.body)).toEqual([JSON.stringify({ business: 'molotes' }), JSON.stringify({ business: 'birria' })]);
    release(ok({ landing: true, bot: true }));
    expect(await first).toBe('confirmed');
    expect(await second).toBe('confirmed');
  });

  it('DEF-001: si el intento en vuelo termina bien, la escritura que llegó durante él recibe otro aviso (y su frescura es la de ese aviso)', async () => {
    let release: (response: Response) => void = () => {};
    const slow = () => new Promise<Response>((resolve) => (release = resolve));
    const { notifier, requests } = setup([slow, ok({ landing: false, bot: true })]);
    const first = notifier.notify('molotes');
    const second = notifier.notify('molotes');
    expect(requests).toHaveLength(1);
    release(ok({ landing: true, bot: true }));
    expect(await first).toBe('confirmed');
    // El segundo aviso empezó después de la segunda escritura: su resultado (landing aún sin datos) es el que cuenta.
    expect(await second).toBe('pending');
    expect(requests).toHaveLength(2);
  });

  it('DEF-001: una escritura que espera más que firstWaitMs responde pending, pero su aviso se envía igual', async () => {
    let release: (response: Response) => void = () => {};
    const slow = () => new Promise<Response>((resolve) => (release = resolve));
    const { notifier, requests } = setup([slow, ok({ landing: true, bot: true })]);
    void notifier.notify('molotes');
    expect(await notifier.notify('molotes')).toBe('pending');
    release(ok({ landing: true, bot: true }));
    await vi.waitFor(() => expect(requests).toHaveLength(2));
  });

  it('una escritura llegada durante los reintentos la cubre el siguiente intento, sin avisos extra', async () => {
    const { notifier, requests, events } = setup([new TypeError('x'), ok({ landing: true, bot: true })]);
    const [first, second] = await Promise.all([notifier.notify('molotes'), notifier.notify('molotes')]);
    // La primera esperaba el intento que falló; la segunda, el reintento (inmediato en la prueba), que confirmó.
    expect([first, second]).toEqual(['pending', 'confirmed']);
    await vi.waitFor(() => expect(events().some((event) => event.msg === 'products_notify_recovered')).toBe(true));
    expect(requests).toHaveLength(2);
  });

  it('el token nunca va al log', async () => {
    const { notifier, logger, events } = setup([new Response('', { status: 401 })]);
    await notifier.notify('molotes');
    await vi.waitFor(() => expect(events().length).toBeGreaterThan(0));
    expect(logger.lines.join('\n')).not.toContain(TOKEN);
  });

  it('sin URL o sin token no avisa (pending)', async () => {
    const fetch = vi.fn<NotifyFetch>();
    expect(await createLandingNotifier({ fetch }).notify('molotes')).toBe('pending');
    expect(await createLandingNotifier({ url: URL_BASE, fetch }).notify('molotes')).toBe('pending');
    expect(fetch).not.toHaveBeenCalled();
  });
});
