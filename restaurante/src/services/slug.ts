/**
 * Slugs de producto (REQ-F-008, RF-7.2 y D-16): se generan a partir del nombre al crear el
 * producto, no se editan y nunca se reutilizan dentro de un negocio (aunque el producto que lo
 * tenía esté eliminado).
 */

/** Longitud máxima de la base: deja sitio al sufijo ("-99") dentro de los 60 de KEY_PATTERN. */
export const SLUG_BASE_MAX = 54;
export const SLUG_FALLBACK = 'producto';

/** "Molotes de Champiñones" -> "molotes-de-champinones". */
export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX)
    .replace(/-+$/g, '');
  return base === '' ? SLUG_FALLBACK : base;
}

/** Slug libre en el negocio: el base o, si ya existe, con sufijo -2, -3, ... */
export function uniqueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
