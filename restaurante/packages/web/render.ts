import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Renderizador mínimo de plantillas HTML sin motor externo.
 *
 * Sintaxis:
 *   {{ clave }}    -> valor escapado como HTML (por defecto, siempre).
 *   {{{ clave }}}  -> HTML sin escapar; SOLO acepta instancias de SafeHtml
 *                     (resultado de otro render), nunca strings arbitrarios.
 *   {{ a.b.0.c }}  -> ruta con puntos: propiedades propias de objetos/arrays.
 *
 * Las plantillas se leen una sola vez al crear el renderizador.
 * Una clave ausente o nula lanza error (falla rápido ante plantillas rotas).
 */

const PLACEHOLDER = /\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g;

const HTML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
});

export function escapeHtml(value: unknown): string {
  // El patrón solo captura caracteres con entrada en HTML_ESCAPES.
  return String(value).replace(/[&<>"'`]/g, (char) => HTML_ESCAPES[char] as string);
}

/** Marca un fragmento HTML como ya renderizado y seguro. Solo lo crea el renderizador. */
export class SafeHtml {
  #html: string;

  constructor(html: string) {
    this.#html = html;
  }

  toString(): string {
    return this.#html;
  }
}

/** Resuelve "a.b.0" recorriendo solo propiedades propias (sin prototipo). */
function resolvePath(data: unknown, path: string): unknown {
  let value = data;
  for (const segment of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined;
    // Objeto con la propiedad propia `segment` (comprobado arriba).
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function loadTemplates(viewsDir: string): Map<string, string> {
  const templates = new Map<string, string>();
  const files = readdirSync(viewsDir, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'));
  for (const file of files) {
    const name = relative(viewsDir, join(viewsDir, file)).slice(0, -'.html'.length).split(sep).join('/');
    templates.set(name, readFileSync(join(viewsDir, file), 'utf8'));
  }
  return templates;
}

/** Datos de una plantilla: se leen solo sus propiedades propias (ver resolvePath). */
export type TemplateData = object;

// Propiedades función (no métodos): no usan `this`, así que se pueden desestructurar sin perder el contexto.
export interface Renderer {
  render: (name: string, data?: TemplateData) => SafeHtml;
  renderEach: (name: string, items: Iterable<TemplateData>) => SafeHtml;
  join: (fragments: Iterable<unknown>) => SafeHtml;
  has: (name: string) => boolean;
}

export function createRenderer({ viewsDir }: { viewsDir: string }): Renderer {
  const templates = loadTemplates(viewsDir);

  function render(name: string, data: TemplateData = {}): SafeHtml {
    const template = templates.get(name);
    if (template === undefined) throw new Error(`Plantilla no encontrada: ${name}`);

    const html = template.replace(PLACEHOLDER, (_match, rawKey: string | undefined, escapedKey: string) => {
      const key = rawKey ?? escapedKey;
      const value = resolvePath(data, key);
      if (value === undefined || value === null) {
        throw new Error(`Falta el valor "${key}" en la plantilla "${name}"`);
      }
      if (rawKey !== undefined) {
        if (!(value instanceof SafeHtml)) {
          throw new TypeError(`"${key}" en "${name}" requiere HTML renderizado (SafeHtml), no texto`);
        }
        return value.toString();
      }
      if (typeof value === 'object' || typeof value === 'function') {
        throw new TypeError(`"${key}" en "${name}" debe ser texto o número, no un objeto`);
      }
      return escapeHtml(value);
    });

    return new SafeHtml(html);
  }

  /** Concatena fragmentos ya renderizados (lista vacía = fragmento vacío). */
  function join(fragments: Iterable<unknown>): SafeHtml {
    let html = '';
    for (const fragment of fragments) {
      if (!(fragment instanceof SafeHtml)) throw new TypeError('join solo acepta fragmentos SafeHtml');
      html += fragment.toString();
    }
    return new SafeHtml(html);
  }

  /** Renderiza la misma plantilla para cada elemento y concatena el resultado. */
  function renderEach(name: string, items: Iterable<TemplateData>): SafeHtml {
    return join(Array.from(items, (item) => render(name, item)));
  }

  return Object.freeze({ render, renderEach, join, has: (name: string) => templates.has(name) });
}
