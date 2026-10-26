import type { BusinessHours } from '../hours.ts';

/**
 * Horario de servicio de Moloteando: martes a viernes, de 08:30 a 15:00 (REQ-F-010, D-1).
 * Se valida y se expone en src/content/hours.ts. Los textos de horario de
 * ./index.ts deben coincidir con estos datos (tests/unit/business-hours.test.ts).
 */
export const molotesHours: BusinessHours = {
  days: ['Tue', 'Wed', 'Thu', 'Fri'],
  opens: '08:30',
  closes: '15:00',
};
