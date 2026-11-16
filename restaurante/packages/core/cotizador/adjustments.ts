import type { QuoteCatalog } from './catalog.ts';
import { QUOTE_LIMITS, crossCheck, parseFieldText, quoteFieldDefs, sameFieldValue, setFieldValue } from './fields.ts';

/**
 * Ajustes de la pantalla sobre el catálogo (REQ-F-046, S-5, RF-8 y RN-14): las diferencias respecto
 * del JSON, como texto (`{ clave: valor }`), más las personas. Nunca modifica el catálogo recibido:
 * trabaja sobre una copia. Con cualquier error no se calcula nada y los errores van por clave (`n`
 * para las personas, `''` para lo general). Un valor igual al por defecto no cuenta como modificado.
 */

export const QUOTE_MESSAGES = Object.freeze({
  personas: `Escribe un número entero de personas entre ${String(QUOTE_LIMITS.personasMin)} y ${String(QUOTE_LIMITS.personasMax)}.`,
  unknownFields: 'El enlace tiene campos que ya no existen; restablece los valores.',
  invalidAdjustments: 'Los ajustes no son válidos; restablece los valores.',
});

export type QuoteAdjustmentResult =
  | { ok: true; personas: number; effective: QuoteCatalog; modified: string[] }
  | { ok: false; errors: Record<string, string> };

const PERSONAS_PATTERN = /^\d{1,6}$/;

function parsePersonas(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!PERSONAS_PATTERN.test(text)) return null;
  const value = Number(text);
  return value >= QUOTE_LIMITS.personasMin && value <= QUOTE_LIMITS.personasMax ? value : null;
}

const isTextRecord = (value: unknown): value is Record<string, string> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === 'string');

export function applyAdjustments(catalog: QuoteCatalog, { personas: rawPersonas, ajustes }: { personas: unknown; ajustes: unknown }): QuoteAdjustmentResult {
  const errors: Record<string, string> = {};
  const personas = parsePersonas(rawPersonas);
  if (personas === null) errors.n = QUOTE_MESSAGES.personas;
  if (!isTextRecord(ajustes)) {
    errors[''] = QUOTE_MESSAGES.invalidAdjustments;
    return { ok: false, errors };
  }

  const defs = quoteFieldDefs(catalog);
  const byKey = new Map(defs.map((def) => [def.key, def]));
  if (Object.keys(ajustes).some((key) => !byKey.has(key))) errors[''] = QUOTE_MESSAGES.unknownFields;

  const effective = structuredClone(catalog);
  const modified = new Set<string>();
  for (const [key, text] of Object.entries(ajustes)) {
    const def = byKey.get(key);
    if (!def) continue;
    const parsed = parseFieldText(def, text);
    if ('error' in parsed) {
      errors[key] = parsed.error;
      continue;
    }
    setFieldValue(def, effective, parsed.value);
    if (!sameFieldValue(parsed.value, def.get(catalog))) modified.add(key);
  }
  if (Object.keys(errors).length > 0 || personas === null) return { ok: false, errors };

  // Reglas entre campos, solo con todos los campos válidos (sin mensajes sobre valores a medio escribir).
  for (const { key, message } of crossCheck(effective, { activeOnly: true })) errors[key] ??= message;
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, personas, effective, modified: defs.map(({ key }) => key).filter((key) => modified.has(key)) };
}
