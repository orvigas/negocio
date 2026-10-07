/**
 * Número de cliente enmascarado para los logs (REQ-F-009, RF-9.2): solo los 4 últimos dígitos.
 * "5215512345678" -> "*********5678".
 */
export function maskPhone(phone: string): string {
  const visible = phone.slice(-4);
  return `${'*'.repeat(Math.max(phone.length - visible.length, 0))}${visible}`;
}
