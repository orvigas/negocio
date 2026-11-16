import { createBotWebhookApp, type BotWebhookAppOptions } from '../../src/bot/webhook-app.ts';
import { listenLocal } from './http.ts';

/**
 * Cliente HTTP de las pruebas del webhook (REQ-F-042): las pruebas del bot venían de landing-pages,
 * donde usaban supertest. En la api las peticiones se hacen con fetch (`.claude/rules/testing.md`);
 * este cliente conserva la forma encadenada (`get`, `post`, `set`, `send`) para no reescribir los
 * casos, sobre el servidor de `listenLocal` (127.0.0.1, puerto libre, cerrado al terminar).
 */

export interface TestResponse {
  readonly status: number;
  readonly text: string;
  /** Cuerpo JSON ya leído ({} si no es JSON), como en supertest. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any justificado: las pruebas leen campos de respuestas JSON de forma libre, como hacían con supertest.
  readonly body: any;
  /** Tipo de contenido sin parámetros ("application/json"). */
  readonly type: string;
  /** Cabeceras en minúsculas. */
  readonly headers: Readonly<Record<string, string>>;
}

class TestRequest implements PromiseLike<TestResponse> {
  readonly #method: string;
  readonly #url: string;
  readonly #headers = new Headers();
  #body: string | Uint8Array<ArrayBuffer> | undefined;

  constructor(method: string, url: string) {
    this.#method = method;
    this.#url = url;
  }

  set(name: string | Readonly<Record<string, string>>, value?: string): this {
    if (typeof name === 'string') this.#headers.set(name, value ?? '');
    else for (const [key, item] of Object.entries(name)) this.#headers.set(key, item);
    return this;
  }

  send(body: string | Uint8Array | object): this {
    if (typeof body === 'string') {
      this.#body = body;
    } else if (body instanceof Uint8Array) {
      // Copia en un ArrayBuffer propio: fetch no acepta vistas de un SharedArrayBuffer.
      this.#body = new Uint8Array(body);
    } else {
      this.#body = JSON.stringify(body);
      if (!this.#headers.has('content-type')) this.#headers.set('Content-Type', 'application/json');
    }
    return this;
  }

  async #run(): Promise<TestResponse> {
    const res = await fetch(this.#url, { method: this.#method, headers: this.#headers, body: this.#body, redirect: 'manual' });
    const text = await res.text();
    const type = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
    let body: unknown = {};
    if (type === 'application/json' && text !== '') body = JSON.parse(text);
    return { status: res.status, text, body, type, headers: Object.fromEntries(res.headers.entries()) };
  }

  then<T1 = TestResponse, T2 = never>(onFulfilled?: ((value: TestResponse) => T1 | PromiseLike<T1>) | null, onRejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return this.#run().then(onFulfilled, onRejected);
  }
}

export interface TestClient {
  readonly url: string;
  request(): {
    get(path: string): TestRequest;
    post(path: string): TestRequest;
    put(path: string): TestRequest;
  };
}

export function clientFor(url: string): TestClient {
  return {
    url,
    request: () => ({
      get: (path) => new TestRequest('GET', `${url}${path}`),
      post: (path) => new TestRequest('POST', `${url}${path}`),
      put: (path) => new TestRequest('PUT', `${url}${path}`),
    }),
  };
}

/** App del webhook (la de producción) escuchando en 127.0.0.1, con su cliente. */
export async function listenWebhook(options: BotWebhookAppOptions): Promise<TestClient> {
  const { url } = await listenLocal(createBotWebhookApp(options));
  return clientFor(url);
}
