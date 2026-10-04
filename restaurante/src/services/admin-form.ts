import { stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type { BusinessId } from '../config/businesses.ts';
import {
  ICON_PATTERN,
  childOf,
  getMenuSchema,
  imageSrcError,
  resolveUnion,
  textError,
  type JsonObject,
  type LeafNode,
  type SchemaNode,
} from './menu-schema.ts';
import { parsePesosInput } from './price.ts';

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
export const FORM_META_FIELDS: readonly string[] = Object.freeze(['_csrf', 'author', 'expectedVersion', 'action']);

export const CHECKBOX_VALUE = 'on';
const INT_INPUT = /^\d{1,5}$/;
const normalizeText = (value: string): string => value.replace(/\r\n?/g, '\n').trim();

export type ImageExists = (src: string) => Promise<boolean>;

/** Comprueba que una ruta de imagen corresponde a un archivo dentro de public/img (DT-6). */
export function createImageChecker(publicDir: string): ImageExists {
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

/** Resultado de leer una hoja: valor, error del campo o error de estructura. */
interface LeafResult {
  value?: unknown;
  error?: string;
  structure?: boolean;
  checkFile?: boolean;
}

function parseLeaf(node: LeafNode, raw: string | undefined, reference: unknown): LeafResult {
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
      throw new Error(`Tipo de nodo desconocido: ${(node as { kind: unknown }).kind}`);
  }
}

export interface AdminFormResult {
  /** Datos leídos del formulario; sin validar contra el documento hasta guardarlos. */
  data: unknown;
  errors: Record<string, string>;
  values: Record<string, unknown>;
  structureError: boolean;
}

/**
 * `fields`: campos recibidos (src/utils/form-body.ts).
 * `reference`: datos vigentes; definen la estructura esperada.
 */
export async function parseAdminForm(
  businessId: BusinessId,
  fields: Map<string, string>,
  reference: unknown,
  { imageExists }: { imageExists: ImageExists },
): Promise<AdminFormResult> {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const used = new Set<string>();
  const imageChecks: { name: string; src: string }[] = [];
  let structureError = false;

  function visit(node: SchemaNode, ref: unknown, path: string[]): unknown {
    if (node.kind === 'object') {
      const result: JsonObject = {};
      for (const [name, child] of Object.entries(node.fields)) result[name] = visit(child, childOf(ref, name), [...path, name]);
      return result;
    }
    if (node.kind === 'list') {
      // La referencia son los datos vigentes ya validados: en un nodo lista siempre es un array.
      return ((ref ?? []) as unknown[]).map((item, index) => visit(node.item, item, [...path, String(index)]));
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
    // Con checkFile, `value` es la ruta de imagen (string) ya validada por imageSrcError.
    if (result.checkFile) imageChecks.push({ name, src: result.value as string });
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
