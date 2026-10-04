/**
 * Lectura de propiedades de un error capturado (`catch (err)` es `unknown`).
 * Equivale a `err?.[key]`: cualquier valor no nulo admite el acceso por propiedad.
 */
export function errorProp(err: unknown, key: string): unknown {
  return err == null ? undefined : (err as Record<string, unknown>)[key];
}

// Defecto temporal de verificación del CI (REQ-F-006, CA-2). No mergear.
export const ciTmpTypeError: number = 'texto';
