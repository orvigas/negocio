import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { ICON_PATTERN, getMenuSchema, imageSrcError, resolveUnion, textError } from './menu-schema.js';
import { parsePesosInput } from './price.js';

/**
 * Formulario de administración -> datos editables (REQ-F-001, RF-3 y CA-18/CA-19).
 *
 * Los nombres de campo son rutas planas del esquema ("menu.items.3.priceCents"). Solo se leen
 * las rutas que el esquema espera para la estructura vigente: nunca se construyen objetos a
 * partir de nombres recibidos (sin riesgo de prototype pollution). Cualquier campo extra, un
 * identificador distinto o un valor imposible para un campo oculto o casilla es un error de
 * estructura; los demás errores son por campo y se muestran junto a él.
 */

/** Campos del formulario que no son datos del menú. */
export const FORM_META_FIELDS = Object.freeze(['_csrf', 'author', 'expectedVersion', 'action']);

export const CHECKBOX_VALUE = 'on';
const INT_INPUT = /^\d{1,5}$/;
const normalizeText = (value) => value.replace(/\r\n?/g, '\n').trim();

/**
 * Comprueba que una ruta de imagen corresponde a un archivo dentro de public/img (DT-6).
 * @param {string} publicDir
 */
export function createImageChecker(publicDir) {
  const imgDir = resolve(publicDir, 'img');
  return async function imageExists(src) {
    const file = resolve(publicDir, `.${src}`);
    const rel = relative(imgDir, file);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return false;
    try {
      return (await stat(join(imgDir, rel))).isFile();
    } catch {
      return false;
    }
  };
}

function parseLeaf(node, raw, reference) {
  switch (node.kind) {
    case 'key':
      return raw === reference ? { value: reference } : { structure: true };
    case 'bool':
      if (raw === undefined) return { value: false };
      return raw === CHECKBOX_VALUE ? { value: true } : { structure: true };
    default:
      break;
  }
  if (raw === undefined) return { structure: true };

  switch (node.kind) {
    case 'text': {
      const value = normalizeText(raw);
      const error = textError(node, value);
      return error ? { error } : { value };
    }
    case 'price': {
      const result = parsePesosInput(raw);
      return result.ok ? { value: result.cents } : { error: result.error };
    }
    case 'int': {
      const text = raw.trim();
      const value = Number(text);
      if (!INT_INPUT.test(text) || value < node.min || value > node.max) {
        return { error: `Escribe un número entero de ${node.min} a ${node.max}.` };
      }
      return { value };
    }
    case 'enum':
      return node.options.includes(raw) ? { value: raw } : { error: 'Elige una opción de la lista.' };
    case 'icon': {
      const value = raw.trim();
      return ICON_PATTERN.test(value) ? { value } : { error: 'Usa solo minúsculas, dígitos y "_" (máximo 40).' };
    }
    case 'imageSrc': {
      const value = raw.trim();
      const error = imageSrcError(value);
      return error ? { error } : { value, checkFile: true };
    }
    default:
      throw new Error(`Tipo de nodo desconocido: ${node.kind}`);
  }
}

/**
 * @param {'molotes'|'birria'} businessId
 * @param {Map<string, string>} fields Campos recibidos (src/utils/form-body.js).
 * @param {object} reference Datos vigentes: definen la estructura esperada.
 * @param {{ imageExists: (src: string) => Promise<boolean> }} deps
 * @returns {Promise<{
 *   data: object,
 *   errors: Record<string, string>,
 *   values: Record<string, string>,
 *   structureError: boolean,
 * }>}
 */
export async function parseAdminForm(businessId, fields, reference, { imageExists }) {
  const errors = {};
  const values = {};
  const used = new Set();
  const imageChecks = [];
  let structureError = false;

  function visit(node, ref, path) {
    if (node.kind === 'object') {
      const result = {};
      for (const [name, child] of Object.entries(node.fields)) result[name] = visit(child, ref?.[name], [...path, name]);
      return result;
    }
    if (node.kind === 'list') {
      return (ref ?? []).map((item, index) => visit(node.item, item, [...path, String(index)]));
    }
    if (node.kind === 'union') {
      const concrete = resolveUnion(node, ref);
      if (!concrete) {
        structureError = true;
        return undefined;
      }
      return visit(concrete, ref, path);
    }

    const name = path.join('.');
    const raw = fields.get(name);
    used.add(name);
    values[name] = raw ?? (node.kind === 'key' ? ref : '');

    const result = parseLeaf(node, raw, ref);
    if (result.structure) structureError = true;
    if (result.error) errors[name] = result.error;
    if (result.checkFile) imageChecks.push({ name, src: result.value });
    return result.value;
  }

  const data = visit(getMenuSchema(businessId), reference, []);

  for (const name of fields.keys()) {
    if (!used.has(name) && !FORM_META_FIELDS.includes(name)) structureError = true;
  }

  const existence = await Promise.all(imageChecks.map(({ src }) => imageExists(src)));
  imageChecks.forEach(({ name }, index) => {
    if (!existence[index]) errors[name] = 'La imagen no existe en public/img/.';
  });

  return { data, errors, values, structureError };
}
