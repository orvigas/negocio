import { JSDOM } from 'jsdom';

import { createAdminApiClient } from '@restaurante/contracts';

import { createInventoryApp } from '../../src/app.ts';
import { loadInventoryConfig } from '../../src/config.ts';
import { startApiDouble, type ApiDouble, type DoubleUser } from './api-double.ts';
import { listenLocal } from './http.ts';
import { recordingLogger } from './logger.ts';

/**
 * Admin nuevo contra el doble de la API, y un "navegador" mínimo: guarda las cookies, envía Origin y
 * Sec-Fetch-Site como un navegador del mismo origen y nunca sigue redirecciones (las pruebas las
 * comprueban).
 */

export const ANA: DoubleUser = { username: 'ana', password: 'clave-de-ana-123', user: { id: 1, name: 'Ana Admin', role: 'admin', businesses: ['molotes', 'birria'] } };
export const ELI: DoubleUser = { username: 'eli', password: 'clave-de-eli-123', user: { id: 2, name: 'Eli Molotes', role: 'editor', businesses: ['molotes'] } };

export interface Harness {
  url: string;
  api: ApiDouble;
  logger: ReturnType<typeof recordingLogger>;
  browser(): Browser;
}

export async function startInventory({
  products = [],
  env = {},
  apiUrl,
}: { products?: Parameters<typeof startApiDouble>[1]; env?: Record<string, string>; apiUrl?: string } = {}): Promise<Harness> {
  const api = await startApiDouble([ANA, ELI], products);
  const logger = recordingLogger();
  const config = loadInventoryConfig({ NODE_ENV: 'test', API_INTERNAL_URL: apiUrl ?? api.url, ...env });
  const client = createAdminApiClient({ baseUrl: config.apiInternalUrl, timeoutMs: 2000 });
  const { url } = await listenLocal(createInventoryApp({ config, api: client, logger }));
  return { url, api, logger, browser: () => new Browser(url) };
}

export class Browser {
  readonly url: string;
  readonly cookies = new Map<string, string>();
  /** Cabeceras extra en todas las peticiones (p. ej. las de un proxy). */
  readonly headers: Record<string, string> = {};

  constructor(url: string) {
    this.url = url;
  }

  private store(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  private cookieHeader(): Record<string, string> {
    return this.cookies.size > 0 ? { cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ') } : {};
  }

  async get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    const response = await fetch(`${this.url}${path}`, { redirect: 'manual', headers: { ...this.headers, ...this.cookieHeader(), ...headers } });
    this.store(response);
    return response;
  }

  async post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Promise<Response> {
    const response = await fetch(`${this.url}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: this.url,
        'sec-fetch-site': 'same-origin',
        ...this.headers,
        ...this.cookieHeader(),
        ...headers,
      },
      body: new URLSearchParams(fields).toString(),
    });
    this.store(response);
    return response;
  }

  /** POST con el cuerpo tal cual (p. ej. el FormData de un formulario, con campos repetidos si los hay). */
  async postBody(path: string, body: URLSearchParams): Promise<Response> {
    const response = await fetch(`${this.url}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: this.url, 'sec-fetch-site': 'same-origin', ...this.headers, ...this.cookieHeader() },
      body: body.toString(),
    });
    this.store(response);
    return response;
  }

  async login(user: DoubleUser, next?: string): Promise<Response> {
    return this.post('/acceso', { username: user.username, password: user.password, ...(next ? { next } : {}) });
  }
}

/** Campos de un formulario como los enviaría el navegador (las casillas, solo si están marcadas). */
export function formFields(html: string, selector: string): Record<string, string> {
  const { document } = new JSDOM(html).window;
  const form = document.querySelector(selector);
  if (!form) throw new Error(`No se encontró ${selector}`);
  const fields: Record<string, string> = {};
  for (const element of form.querySelectorAll<HTMLInputElement>('input[name], select[name], textarea[name]')) {
    if (element.type === 'checkbox' && !element.checked) continue;
    fields[element.name] = element.value;
  }
  return fields;
}

export const dom = (html: string): Document => new JSDOM(html).window.document;
