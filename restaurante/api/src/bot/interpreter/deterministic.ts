import { otherBusiness } from '../messages.ts';
import { interpretCustomerData } from './customer-data.ts';
import { interpretAnswer, interpretOrder } from './order.ts';
import type { OrderInterpreter } from './types.ts';
import { buildBusinessIndex } from './vocabulary.ts';

/**
 * Intérprete determinista y propio (REQ-F-013, D-2): sin IA ni servicios externos. El índice se
 * construye por llamada a partir del catálogo en caché (como mucho 50 productos), así que un
 * producto nuevo o renombrado se reconoce de inmediato (RF-10.3).
 */
export function createDeterministicInterpreter(): OrderInterpreter {
  const indexOf = (scope: Parameters<OrderInterpreter['order']>[1]) =>
    buildBusinessIndex(scope.business, scope.catalog, otherBusiness(scope.business), scope.otherCatalog);
  return {
    order: (text, scope) => interpretOrder(text, indexOf(scope)),
    answer: (text, blocks, scope) => interpretAnswer(text, blocks, indexOf(scope)),
    customerData: (text) => interpretCustomerData(text),
  };
}
