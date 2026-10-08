import { describe, expect, it } from 'vitest';

import { runNode } from '../support/process.ts';

/**
 * `npm run bot:chat` (REQ-F-009 RF-12; REQ-F-012 D-16, CA-15b): un pedido completo contra el doble
 * del proveedor, con la entrada redirigida. Sin `--proveedor` simula Meta. Ninguna petición sale
 * a internet: el bot usa los dobles y la app escucha solo en 127.0.0.1.
 */

const ORDER = ['Hola', '2', '9', '1', '4', 'Ana', '1', '0', '1', '/salir'].join('\n');
const run = (args: string[]) => runNode(['scripts/bot-chat.ts', '--ahora', '2026-10-06T10:00', ...args], { env: { BUSINESS_TIMEZONE: 'America/Mexico_City' }, input: `${ORDER}\n` });

describe('bot:chat (CA-15b)', () => {
  it('sin --proveedor simula Meta y completa un pedido con la plantilla del aviso', async () => {
    const { code, stdout } = await run([]);
    expect(code).toBe(0);
    expect(stdout).toContain('Simulador del bot con meta');
    expect(stdout).toContain('[aviso al personal +5215511110001, plantilla nuevo_pedido]');
    expect(stdout).toMatch(/¡Listo! Tu pedido \*M-[A-Z0-9]{4}\* fue enviado a Moloteando/);
  }, 30_000);

  it('con --proveedor twilio completa un pedido contra el doble de Twilio (aviso en texto libre)', async () => {
    const { code, stdout } = await run(['--proveedor', 'twilio']);
    expect(code).toBe(0);
    expect(stdout).toContain('Simulador del bot con twilio');
    expect(stdout).toContain('[aviso al personal +5215511110001, texto libre]');
    expect(stdout).toMatch(/\*Nuevo pedido M-[A-Z0-9]{4}\* - Moloteando/);
    expect(stdout).toMatch(/¡Listo! Tu pedido \*M-[A-Z0-9]{4}\* fue enviado a Moloteando/);
    expect(stdout).not.toContain('el webhook respondió');
  }, 30_000);

  it('un proveedor desconocido termina con código 1 y el uso', async () => {
    const { code, stderr } = await runNode(['scripts/bot-chat.ts', '--proveedor', 'vonage'], { env: {} });
    expect(code).toBe(1);
    expect(stderr).toContain('--proveedor meta|twilio');
  }, 30_000);
});
