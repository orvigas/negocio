/**
 * Campos modificados entre dos versiones de los datos editables, para el registro de cambios
 * (RF-6.3). Compara hoja por hoja; las rutas usan puntos ("menu.items.3.priceCents").
 */

const isContainer = (value) => value !== null && typeof value === 'object';

function walk(before, after, path, changes) {
  if (isContainer(before) && isContainer(after) && Array.isArray(before) === Array.isArray(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) walk(before[key], after[key], [...path, key], changes);
    return;
  }
  if (before !== after) {
    changes.push({ field: path.join('.'), before: before ?? null, after: after ?? null });
  }
}

/**
 * @param {object} before
 * @param {object} after
 * @returns {{ field: string, before: unknown, after: unknown }[]}
 */
export function diffMenuData(before, after) {
  const changes = [];
  walk(before, after, [], changes);
  return changes;
}
