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

const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
});

export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (char) => HTML_ESCAPES[char]);
}

/** Marca un fragmento HTML como ya renderizado y seguro. Solo lo crea el renderizador. */
export class SafeHtml {
  #html;

  constructor(html) {
    this.#html = html;
  }

  toString() {
    return this.#html;
  }
}

/** Resuelve "a.b.0" recorriendo solo propiedades propias (sin prototipo). */
function resolvePath(data, path) {
  let value = data;
  for (const segment of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, segment)) return undefined;
    value = value[segment];
  }
  return value;
}

function loadTemplates(viewsDir) {
  const templates = new Map();
  const files = readdirSync(viewsDir, { recursive: true }).filter((file) => file.endsWith('.html'));
  for (const file of files) {
    const name = relative(viewsDir, join(viewsDir, file)).slice(0, -'.html'.length).split(sep).join('/');
    templates.set(name, readFileSync(join(viewsDir, file), 'utf8'));
  }
  return templates;
}

/**
 * @param {{ viewsDir: string }} options
 * @returns {{
 *   render: (name: string, data?: Record<string, unknown>) => SafeHtml,
 *   renderEach: (name: string, items: Iterable<Record<string, unknown>>) => SafeHtml,
 *   join: (fragments: Iterable<SafeHtml>) => SafeHtml,
 *   has: (name: string) => boolean,
 * }}
 */
export function createRenderer({ viewsDir }) {
  const templates = loadTemplates(viewsDir);

  function render(name, data = {}) {
    const template = templates.get(name);
    if (template === undefined) throw new Error(`Plantilla no encontrada: ${name}`);

    const html = template.replace(PLACEHOLDER, (_match, rawKey, escapedKey) => {
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
  function join(fragments) {
    let html = '';
    for (const fragment of fragments) {
      if (!(fragment instanceof SafeHtml)) throw new TypeError('join solo acepta fragmentos SafeHtml');
      html += fragment.toString();
    }
    return new SafeHtml(html);
  }

  /** Renderiza la misma plantilla para cada elemento y concatena el resultado. */
  function renderEach(name, items) {
    return join(Array.from(items, (item) => render(name, item)));
  }

  return Object.freeze({ render, renderEach, join, has: (name) => templates.has(name) });
}
