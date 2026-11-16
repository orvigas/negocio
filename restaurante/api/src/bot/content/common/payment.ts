/**
 * Datos de la cuenta para las transferencias de los pedidos del bot de WhatsApp (REQ-F-035, RF-7.1
 * y RN-5): una sola cuenta para los dos negocios. Es el único lugar donde se editan; el flujo y los
 * textos del bot los leen solo mediante `getBankAccount()`.
 *
 * No son secretos (el bot los muestra a cualquier cliente que elige transferencia), pero nunca van a
 * los logs. Decisión del usuario (2026-10-16): en el futuro se guardarán en la base de datos y se
 * editarán desde la administración; entonces solo cambia `getBankAccount()`.
 */

export interface BankAccount {
  readonly beneficiary: string;
  readonly bank: string;
  /** CLABE interbancaria de 18 dígitos. */
  readonly clabe: string;
}

const bankAccount: BankAccount = Object.freeze({
  beneficiary: 'Orlando Villegas Galan',
  bank: 'Mercado Pago W',
  clabe: '722969010833880068',
});

/** Cuenta vigente para las transferencias (punto único de acceso). */
export const getBankAccount = (): BankAccount => bankAccount;
