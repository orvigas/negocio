/**
 * Campos modificados entre dos versiones de los datos editables, para el registro de cambios
 * (RF-6.3). Compara hoja por hoja; las rutas usan puntos ("menu.items.3.priceCents").
 */

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

type Container = Record<string, unknown>;

// Arrays incluidos: se recorren por sus índices igual que los objetos.
const isContainer = (value: unknown): value is Container => value !== null && typeof value === 'object';

function walk(before: unknown, after: unknown, path: string[], changes: FieldChange[]): void {
  if (isContainer(before) && isContainer(after) && Array.isArray(before) === Array.isArray(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) walk(before[key], after[key], [...path, key], changes);
    return;
  }
  if (before !== after) {
    changes.push({ field: path.join('.'), before: before ?? null, after: after ?? null });
  }
}

export function diffMenuData(before: unknown, after: unknown): FieldChange[] {
  const changes: FieldChange[] = [];
  walk(before, after, [], changes);
  return changes;
}
