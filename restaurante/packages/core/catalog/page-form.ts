import type { BusinessId } from '../shared/index.ts';
import {
  ICON_PATTERN,
  childOf,
  getPageSchema,
  imageSrcError,
  resolveUnion,
  textError,
  type JsonObject,
  type LeafNode,
  type ObjectNode,
  type SchemaNode,
} from './menu-schema.ts';
import { centsToInput, parsePesosInput } from './price.ts';
import type { ImageExists } from './product-repository.ts';

/**
 * Formulario de administración -> datos de página (REQ-F-001, RF-3 y CA-18/CA-19; desde
 * REQ-F-008 solo hero, texto destacado y promociones: los productos tienen su propio formulario).
 * En core desde REQ-F-044: `/admin` y `/api/v1/admin` aplican exactamente las mismas reglas.
 *
 * Los nombres de campo son rutas planas del esquema ("menu.items.3.priceCents"). Solo se leen
 * las rutas que el esquema espera para la estructura vigente: nunca se construyen objetos a
 * partir de nombres recibidos (sin riesgo de prototype pollution). Cualquier campo extra, un
 * identificador distinto o un valor imposible para un campo oculto o casilla es un error de
 * estructura; los demás errores son por campo y se muestran junto a él.
 */

/** Campos del formulario que no son datos del menú. */
export const FORM_META_FIELDS: readonly string[] = Object.freeze(['_csrf', 'expectedVersion', 'action']);

export const CHECKBOX_VALUE = 'on';
const INT_INPUT = /^\d{1,5}$/;
const normalizeText = (value: string): string => value.replace(/\r\n?/g, '\n').trim();

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
      throw new Error(`Tipo de nodo desconocido: ${String((node as { kind: unknown }).kind)}`);
  }
}

export interface PageFormResult {
  /** Datos leídos del formulario; sin validar contra el documento hasta guardarlos. */
  data: unknown;
  errors: Record<string, string>;
  values: Record<string, unknown>;
  structureError: boolean;
}

/**
 * `fields`: campos recibidos (formulario o `fields` de la API; REQ-F-044, RF-6).
 * `reference`: datos de página vigentes (pickPageData); definen la estructura esperada.
 */
export async function parsePageForm(
  businessId: BusinessId,
  fields: ReadonlyMap<string, string>,
  reference: unknown,
  { imageExists = () => Promise.resolve(false) }: { imageExists?: ImageExists } = {},
): Promise<PageFormResult> {
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

  const data = visit(getPageSchema(businessId), reference, []);

  for (const name of fields.keys()) {
    if (!used.has(name) && !FORM_META_FIELDS.includes(name)) structureError = true;
  }

  const existence = await Promise.all(imageChecks.map(({ src }) => imageExists(src)));
  imageChecks.forEach(({ name }, index) => {
    if (!existence[index]) errors[name] = 'La imagen no existe en public/img/.';
  });

  return { data, errors, values, structureError };
}

// --- Descriptor y valores para el admin nuevo (REQ-F-044, RF-6) ------------------------

/** Campo editable de la página: inventory-manager pinta el formulario con esto, sin conocer el esquema. */
export interface PageFormLeaf {
  name: string;
  /** Título del grupo (leyenda del fieldset más cercano). */
  group: string;
  kind: 'text' | 'price';
  label: string;
  max?: number;
  optional?: boolean;
}

/** Campos de la página, en orden. El esquema de página solo tiene objetos, textos y precios. */
export function pageFormFields(businessId: BusinessId): PageFormLeaf[] {
  const leaves: PageFormLeaf[] = [];
  function visit(node: ObjectNode, path: string[], group: string): void {
    for (const [name, child] of Object.entries(node.fields)) {
      const childPath = [...path, name];
      if (child.kind === 'object') {
        visit(child, childPath, child.legend?.({}, 0) ?? group);
      } else if (child.kind === 'text') {
        leaves.push({ name: childPath.join('.'), group, kind: 'text', label: child.label, max: child.max, optional: child.optional });
      } else if (child.kind === 'price') {
        leaves.push({ name: childPath.join('.'), group, kind: 'price', label: child.label });
      } else {
        throw new TypeError(`Campo de página no admitido: ${child.kind}`);
      }
    }
  }
  visit(getPageSchema(businessId), [], '');
  return leaves;
}

/** Valores de la página como texto del formulario, por nombre de campo. `data` ya está validado. */
export function pageFormValues(businessId: BusinessId, data: unknown): Record<string, string> {
  const values: Record<string, string> = {};
  for (const { name, kind } of pageFormFields(businessId)) {
    const value = name.split('.').reduce<unknown>((container, key) => childOf(container, key), data);
    // Datos validados: un campo de precio siempre es un entero en centavos.
    values[name] = kind === 'price' ? centsToInput(value as number) : String(value);
  }
  return values;
}
