import type { BusinessHours } from '../hours.ts';

/**
 * Horario de servicio de Birria El Muñeco: sábado y domingo, de 08:00 a 15:00 (REQ-F-010, D-3).
 * Se valida y se expone en src/content/hours.ts. Los textos de horario de
 * ./index.ts deben coincidir con estos datos (tests/unit/business-hours.test.ts).
 */
export const birriaHours: BusinessHours = {
  days: ['Sat', 'Sun'],
  opens: '08:00',
  closes: '15:00',
};
