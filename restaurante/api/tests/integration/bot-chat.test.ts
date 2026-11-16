import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { API_DIR } from '../../src/config.ts';

/** Ejecuta `node <args>` en api/ con un entorno mínimo (nunca el del desarrollador) y `input` por stdin. */
function runNode(args: string[], { env, input = '' }: { env: Record<string, string>; input?: string }): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: API_DIR, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 25_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

/**
 * `npm run bot:chat` (REQ-F-009 RF-12; REQ-F-012 D-16, CA-15b; en la api desde REQ-F-042, CA-11): un
 * pedido completo contra el doble del proveedor, con la entrada redirigida. Sin `--proveedor` simula Meta. Ninguna petición sale
 * a internet: el bot usa los dobles y la app escucha solo en 127.0.0.1.
 */

/** El flujo de REQ-F-013 en texto libre: el mensaje de la landing, el pedido, los datos y "sí". */
const ORDER = ['Hola, quiero hacer un pedido de molotes', '2 órdenes de queso y una coca', 'Ana, recoger, efectivo', 'sí', '/salir'].join('\n');
const run = (args: string[]) => runNode(['scripts/bot-chat.ts', '--ahora', '2026-10-06T10:00', ...args], { env: { BUSINESS_TIMEZONE: 'America/Mexico_City' }, input: `${ORDER}\n` });

describe('bot:chat (CA-15b)', () => {
  it('sin --proveedor simula Meta y completa un pedido con la plantilla del aviso', async () => {
    const { code, stdout } = await run([]);
    expect(code).toBe(0);
    expect(stdout).toContain('Simulador del bot con meta');
    expect(stdout).toContain('[aviso al personal +5215511110001, plantilla nuevo_pedido]');
    expect(stdout).toContain('1 × Refrescos Familia Coca-Cola · Coca-Cola a $35 = $35');
    expect(stdout).toMatch(/¡Listo! 🙌\n\s*Tu pedido \*M-[A-Z0-9]{4}\* fue enviado a Moloteando/);
  }, 30_000);

  it('con --proveedor twilio completa un pedido contra el doble de Twilio (aviso en texto libre)', async () => {
    const { code, stdout } = await run(['--proveedor', 'twilio']);
    expect(code).toBe(0);
    expect(stdout).toContain('Simulador del bot con twilio');
    expect(stdout).toContain('[aviso al personal +5215511110001, texto libre]');
    expect(stdout).toMatch(/🔔 \*Nuevo pedido M-[A-Z0-9]{4}\* - Moloteando/);
    expect(stdout).toContain('2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260');
    expect(stdout).toMatch(/¡Listo! 🙌\n\s*Tu pedido \*M-[A-Z0-9]{4}\* fue enviado a Moloteando/);
    expect(stdout).not.toContain('el webhook respondió');
  }, 30_000);

  it('un proveedor desconocido termina con código 1 y el uso', async () => {
    const { code, stderr } = await runNode(['scripts/bot-chat.ts', '--proveedor', 'vonage'], { env: {} });
    expect(code).toBe(1);
    expect(stderr).toContain('--proveedor meta|twilio');
  }, 30_000);
});
