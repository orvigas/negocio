/**
 * Umbrales de la protección del bot (REQ-F-025, RF-5). Los valores por defecto son los del
 * requisito; cada uno se puede cambiar con su variable de entorno (src/config/env.ts). Los importes
 * van en micro-USD enteros (1 USD = 1 000 000) para no acumular errores de coma flotante.
 */

export const MS = Object.freeze({ second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 });

export interface BotLimits {
  /** RF-1.1: pedidos confirmados por número y día. */
  readonly ordersPerNumberDay: number;
  /** RF-1.2: mensajes entrantes procesados por número y día. */
  readonly messagesPerNumberDay: number;
  /** RF-1.3: mensajes por número y minuto. */
  readonly messagesPerMinute: number;
  /** RF-1.4: ráfaga por número. */
  readonly burst: number;
  readonly burstWindowMs: number;
  /** RF-2.1: plantillas al personal. */
  readonly templatesDay: number;
  readonly templatesMonth: number;
  /** RF-2.2: mensajes salientes del bot (D-T2: textos al cliente, sin las plantillas). */
  readonly outboundDay: number;
  readonly outboundMonth: number;
  /** RF-2.3: presupuesto mensual y tarifas, en micro-USD. */
  readonly budgetMonthMicros: number;
  readonly utilityCostMicros: number;
  readonly serviceCostMicros: number;
  readonly freeServiceMonth: number;
  /** RF-7.1: textos idénticos que provocan el enfriamiento, su ventana y su duración. */
  readonly repeatCount: number;
  readonly repeatWindowMs: number;
  readonly cooldownMs: number;
  /** RF-1.2: bloqueo automático al pasar el tope diario de mensajes. */
  readonly capBlockMs: number;
  /** RF-7.2: escalones del bloqueo por repeticiones (1.º, 2.º, 3.º y siguientes). */
  readonly repeatBlockStepsMs: readonly number[];
  /** RF-7.2 y RF-10: historial que cuenta para el escalón y conservación de las entradas vencidas. */
  readonly blockHistoryMs: number;
  /** RF-10: conservación de la auditoría, en meses. */
  readonly auditRetentionMonths: number;
  /** RF-8: mensajes en proceso o en espera entre todos los clientes. */
  readonly queueMax: number;
  /** D-T5: antigüedad máxima de la copia en memoria de la lista negra y del interruptor. */
  readonly refreshMs: number;
}

export const DEFAULT_BOT_LIMITS: BotLimits = Object.freeze({
  ordersPerNumberDay: 3,
  messagesPerNumberDay: 60,
  messagesPerMinute: 20,
  burst: 5,
  burstWindowMs: 10 * MS.second,
  templatesDay: 60,
  templatesMonth: 1500,
  outboundDay: 800,
  outboundMonth: 12_000,
  budgetMonthMicros: 20_000_000,
  utilityCostMicros: 8500,
  serviceCostMicros: 8500,
  freeServiceMonth: 1000,
  repeatCount: 5,
  repeatWindowMs: 10 * MS.minute,
  cooldownMs: 30 * MS.minute,
  capBlockMs: 7 * MS.day,
  repeatBlockStepsMs: Object.freeze([24 * MS.hour, 7 * MS.day, 30 * MS.day]),
  blockHistoryMs: 30 * MS.day,
  auditRetentionMonths: 12,
  queueMax: 100,
  refreshMs: 10 * MS.second,
});

/** Conservación de los contadores diarios (D-T9), en meses. */
export const USAGE_DAY_RETENTION_MONTHS = 13;
