/**
 * Lectura de propiedades de un error capturado (`catch (err)` es `unknown`).
 * Equivale a `err?.[key]`: cualquier valor no nulo admite el acceso por propiedad.
 */
export function errorProp(err: unknown, key: string): unknown {
  return err == null ? undefined : (err as Record<string, unknown>)[key];
}
