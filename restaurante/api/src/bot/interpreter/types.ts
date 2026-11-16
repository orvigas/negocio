import type { BusinessId } from '@restaurante/core/shared';

import type { BotCatalog } from '../catalog.ts';
import type { DeliveryMethod } from '../messages.ts';
import type { PaymentMethod } from '../payment.ts';

/**
 * Contrato del intérprete de pedidos (REQ-F-013, D-2): la conversación (conversation.ts) solo
 * consume estos resultados estructurados (slugs, claves de opción, cantidades y detalles) y nunca
 * interpreta texto por su cuenta. Otra implementación (p. ej. una híbrida) solo tiene que cumplir
 * esta interfaz. Todos los resultados son datos serializables.
 *
 * Los `fragment` son texto del cliente: solo se le devuelven a él y **nunca** se registran (RF-11).
 */

export interface InterpretScope {
  readonly business: BusinessId;
  readonly catalog: BotCatalog;
  /** Catálogo del otro negocio, para avisar de sus productos (RF-1.10, X-9). */
  readonly otherCatalog: BotCatalog;
}

/** Producto y opción concretos del catálogo. */
export interface Choice {
  readonly slug: string;
  readonly optionKey: string;
}

export type InterpretedLine =
  | { readonly kind: 'item'; readonly slug: string; readonly optionKey: string; readonly quantity: number; readonly detail: string; readonly exact: boolean }
  | {
      readonly kind: 'ambiguous';
      readonly fragment: string;
      readonly quantity: number;
      readonly detail: string;
      readonly reason: 'products' | 'variant' | 'typo';
      readonly candidates: readonly Choice[];
      readonly exact: boolean;
    }
  /** Producto del negocio que hoy no está disponible (`name` incluye la variante si aplica). */
  | { readonly kind: 'unavailable'; readonly fragment: string; readonly name: string; readonly exact: boolean }
  | { readonly kind: 'otherBusiness'; readonly fragment: string; readonly exact: boolean }
  /** Cantidad 0 o mayor que 20 (D-12 de REQ-F-009). */
  | { readonly kind: 'outOfRange'; readonly fragment: string; readonly exact: boolean }
  | { readonly kind: 'unknown'; readonly fragment: string }
  /**
   * No se puede separar ni leer la cantidad con seguridad ("2 tacos 1 cocacolota", "3 tacos x2"):
   * no se agrega nada de ese fragmento y se pide reescribirlo (DEF-002, DEF-003). La conversación
   * da un ejemplo fijo del negocio, nunca la frase del cliente partida (OBS-2).
   */
  | { readonly kind: 'unclear'; readonly fragment: string; readonly reason: 'unseparated' | 'quantity'; readonly exact: boolean };

export interface OrderInterpretation {
  /** Hasta 15 líneas, en el orden del mensaje (RF-1.7). */
  readonly lines: readonly InterpretedLine[];
  /** Líneas con contenido que no se interpretaron por pasar de 15. */
  readonly overflow: number;
  /** El mensaje expresa intención de pedir (RF-4.2). */
  readonly intent: boolean;
  /** El mensaje tiene una palabra de entrega (RF-5.6). */
  readonly hasDeliveryWord: boolean;
}

/** Una línea ambigua pendiente de aclarar (RF-3). */
export interface ClarifyBlock {
  readonly fragment: string;
  readonly quantity: number;
  readonly detail: string;
  readonly candidates: readonly Choice[];
}

export interface AnswerInterpretation {
  /** Índice del candidato elegido en cada bloque, o null si ese bloque sigue pendiente. */
  readonly choices: readonly (number | null)[];
  /** No resolvió nada y el texto parece un pedido nuevo (RF-3.3). */
  readonly looksLikeOrder: boolean;
}

export interface CustomerDataInterpretation {
  readonly name?: string;
  readonly delivery?: DeliveryMethod;
  readonly address?: string;
  /** Con "recoger", lo que sigue a la palabra de entrega (R-6 a). */
  readonly note?: string;
  /**
   * Forma de pago escrita como un segmento entero de los datos ("Ana, recoger, efectivo"; REQ-F-035,
   * RF-2.1). Solo junto con una entrega; si vale para ella lo decide la conversación (RF-2.2).
   */
  readonly payment?: PaymentMethod;
}

export interface OrderInterpreter {
  /** Líneas de pedido de un mensaje (RF-1). Nunca lanza ni registra. */
  order(text: string, scope: InterpretScope): OrderInterpretation;
  /** Respuesta a las líneas ambiguas pendientes (RF-3.3), en el orden de los bloques. */
  answer(text: string, blocks: readonly ClarifyBlock[], scope: InterpretScope): AnswerInterpretation;
  /** Datos del cliente (RF-5). Solo se llama después del aviso de privacidad (X-5). */
  customerData(text: string): CustomerDataInterpretation;
}
