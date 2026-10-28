import type { LeafNode } from './menu-schema.ts';
import { MAX_ROWS, fieldDefinitions, type FieldRule, type InputField, type ProductKind } from './product-schema.ts';

/**
 * Campos del formulario de un producto (REQ-F-008, RF-6 y DT-12), movidos de
 * landing-pages/src/services/product-form.ts (REQ-F-039): los usa el /admin actual para pintar su
 * formulario y la API los sirve como descriptor (`/api/v1/admin/:negocio/productos/campos`) al admin
 * nuevo. Los nombres son planos ("price", "image.src", "variants.2.label"). Variantes y chips se
 * muestran en 6 filas fijas: cada fila tiene sus campos, una "Posición" (1 a 6) y "Quitar".
 */

export const ROW_SLOTS = MAX_ROWS;
export const POSITION_OPTIONS = Object.freeze(Array.from({ length: ROW_SLOTS }, (_, index) => String(index + 1)));

/** Campo del formulario: nombre plano, nodo para pintarlo y a qué grupo pertenece. */
export interface FormLeaf {
  name: string;
  node: LeafNode;
  group: 'main' | 'image' | 'chips' | 'variants';
  /** Fila (0 a 5) de variantes o chips. */
  slot?: number;
}

export type RowKind = 'chips' | 'variants';

const IMAGE_LEAVES: readonly [string, LeafNode][] = Object.freeze([
  ['src', { kind: 'imageSrc', label: 'Ruta de la imagen' }],
  ['alt', { kind: 'text', label: 'Texto alternativo (alt)', max: 150, optional: false }],
  ['width', { kind: 'int', label: 'Ancho (px)', min: 1, max: 4000 }],
  ['height', { kind: 'int', label: 'Alto (px)', min: 1, max: 4000 }],
]);

const ROW_LEAVES: Readonly<Record<RowKind, readonly [string, LeafNode][]>> = Object.freeze({
  chips: [
    ['text', { kind: 'text', label: 'Texto del chip', max: 40, optional: true }],
    ['highlight', { kind: 'bool', label: 'Resaltado' }],
  ],
  variants: [
    ['label', { kind: 'text', label: 'Etiqueta de la variante', max: 40, optional: true }],
    ['price', { kind: 'price', label: 'Precio' }],
    ['description', { kind: 'text', label: 'Descripción', max: 400, optional: true }],
    ['available', { kind: 'bool', label: 'Disponible' }],
  ],
});

const ROW_CONTROLS: readonly [string, LeafNode][] = Object.freeze([
  ['position', { kind: 'enum', label: 'Posición', options: POSITION_OPTIONS }],
  ['remove', { kind: 'bool', label: 'Quitar esta fila' }],
]);

function leafOf(rule: FieldRule): LeafNode | null {
  switch (rule.kind) {
    case 'text':
      return rule.node;
    case 'price':
      return { kind: 'price', label: rule.label };
    case 'int':
      return { kind: 'int', label: rule.label, min: rule.min, max: rule.max };
    case 'enum':
      return { kind: 'enum', label: rule.label, options: rule.options };
    case 'icon':
      return { kind: 'icon', label: rule.label };
    default:
      return null;
  }
}

/** Campos del formulario de una combinación, en el orden en que se pintan. */
export function productFormLeaves(kind: ProductKind, { withAvailable }: { withAvailable: boolean }): FormLeaf[] {
  const leaves: FormLeaf[] = [];
  const definitions = fieldDefinitions(kind);
  for (const [field, rule] of Object.entries(definitions) as [InputField, FieldRule][]) {
    const leaf = leafOf(rule);
    if (leaf) leaves.push({ name: field, node: leaf, group: 'main' });
  }
  if (withAvailable) leaves.push({ name: 'available', node: { kind: 'bool', label: 'Disponible (visible en la landing)' }, group: 'main' });
  if (definitions.image) {
    for (const [name, node] of IMAGE_LEAVES) leaves.push({ name: `image.${name}`, node, group: 'image' });
  }
  for (const rows of ['chips', 'variants'] as const) {
    if (!definitions[rows]) continue;
    for (let slot = 0; slot < ROW_SLOTS; slot += 1) {
      for (const [name, node] of [...ROW_LEAVES[rows], ...ROW_CONTROLS]) leaves.push({ name: `${rows}.${slot}.${name}`, node, group: rows, slot });
    }
  }
  return leaves;
}
