import { afterEach, expect, it } from 'vitest';

import { runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { noPhone, runCleanups, startReal, valueOf } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-5 de QA de REQ-F-043, PR 2 (QA2-21 y QA2-22): matriz del motivo. La `api` real dice si lo
 * acepta; la pantalla, si lo vuelve a pintar tras un error. La regla de D-4 aceptada por el usuario: un
 * motivo con 8 o más dígitos se vacía, y uno normal se conserva.
 */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

type Row = readonly [string, string, 'acepta' | 'rechaza', 'conserva' | 'vacía'];
const decode = (html: string): string | undefined => valueOf(html, 'motivo')?.replaceAll('&amp;', '&').replaceAll('&#43;', '+').replaceAll('&#39;', "'").replaceAll('&#x27;', "'");

const MATRIX: readonly Row[] = [
  ['normal', 'Abuso en pedidos', 'acepta', 'conserva'],
  ['7 dígitos', 'folio 1234567', 'acepta', 'conserva'],
  ['8 dígitos', 'folio 12345678', 'rechaza', 'vacía'],
  ['8 al inicio', '12345678 folio', 'rechaza', 'vacía'],
  ['8 al final, sin espacio', 'folio12345678', 'rechaza', 'vacía'],
  ['espacios', '55 12 34 56', 'rechaza', 'vacía'],
  ['guiones', '55-12-34-56', 'rechaza', 'vacía'],
  ['puntos', '55.12.34.56', 'rechaza', 'vacía'],
  ['más y paréntesis', '+52 (55) 1234', 'rechaza', 'vacía'],
  ['NBSP', '5512 3456', 'rechaza', 'vacía'],
  ['barra', '5512/3456', 'acepta', 'conserva'],
  ['guion bajo', '5512_3456', 'acepta', 'conserva'],
  ['coma', '5512,3456', 'acepta', 'conserva'],
  ['200 caracteres', 'a'.repeat(200), 'acepta', 'conserva'],
  ['201 caracteres', 'a'.repeat(201), 'rechaza', 'conserva'],
  ['201 con 8 dígitos', `${'a'.repeat(193)}12345678`, 'rechaza', 'vacía'],
  ['solo espacios', '   ', 'acepta', 'conserva'],
  ['emoji', '🌮 abuso 🌮', 'acepta', 'conserva'],
  ['NFD', 'Café raro', 'acepta', 'conserva'],
];

// R-2: core rechaza el control antes de mirar los dígitos, y `keptReason` no lo quita.
const DIVERGENT: readonly Row[] = [
  ['control entre dígitos', '5512\u00013456', 'rechaza', 'conserva'],
  ['teléfono partido con control', '55\u000198\u000176\u00015432', 'rechaza', 'conserva'],
  ['NEL entre dígitos', '5512\u00853456', 'rechaza', 'conserva'],
];

it('QA2-21 y QA2-22: lo que acepta core y lo que se vuelve a pintar', async () => {
  const s = await startReal();
  const csrf = await s.csrf();
  const table: string[] = [];
  for (const [name, reason, core, kept] of [...MATRIX, ...DIVERGENT]) {
    // El interruptor da el veredicto de core: 303 acepta, 422 rechaza. Reanudar no cambia el estado.
    const verdict = await s.admin.post('/bot/interruptor', { _csrf: csrf, accion: 'reanudar', motivo: reason });
    expect(verdict.status, name).toBe(core === 'acepta' ? 303 : 422);
    // Con teléfono inválido el alta siempre da 422: se ve si el motivo vuelve.
    const form = await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: 'abc', duracion: '24h', motivo: reason });
    expect(form.status, name).toBe(422);
    const painted = (decode(form.html) ?? '') !== '';
    table.push(`${name}: core ${core}, pantalla ${painted ? 'conserva' : 'vacía'}`);
    if (reason.trim() !== '') expect(painted ? 'conserva' : 'vacía', name).toBe(kept);
    expect(/<option value="24h" selected/.test(form.html), name).toBe(true);
  }
  console.log('QA2-21', JSON.stringify(table));
  noPhone(s.logs(), 'logs');
});
