import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AS, ROOT, forbiddenByLocation, use, violations } from '../support/dependency-rule.ts';

/** QA de REQ-F-042 (CA-10): casos adicionales a los de dependency-rule-apps.test.ts. */

const landing = (...parts: string[]) => join(ROOT, 'landing-pages', ...parts);

describe('CA-10: importar el bot desde landing-pages', () => {
  it.each([
    ['por el nombre del paquete', "import { createBotWebhookApp } from 'api/src/bot/webhook-app.ts';"],
    ['por ruta relativa desde src', "import { createBotWebhookApp } from '../../api/src/bot/webhook-app.ts';"],
  ])('falla el lint: %s', async (_name, code) => {
    expect((await violations(code + use('createBotWebhookApp'), AS.landing)).length).toBeGreaterThan(0);
  });
});

describe('CA-10: archivos del bot en landing-pages, por ruta', () => {
  it.each([
    ['anidado en un proveedor', ['src', 'services', 'whatsapp-bot', 'interpreter', 'order.ts']],
    ['con la misma carpeta que en api', ['src', 'bot', 'orchestrator.ts']],
    ['anidado en src/bot', ['src', 'bot', 'providers', 'meta', 'webhook.ts']],
    ['variante del webhook', ['src', 'routes', 'whatsapp-webhook-v2.ts']],
    ['contenido común', ['src', 'content', 'common', 'bot.ts']],
    ['simulador con sufijo', ['scripts', 'bot-chat-dev.ts']],
  ])('falla el lint: %s', async (_name, parts) => {
    expect(await forbiddenByLocation(landing(...parts))).toMatch(/El bot de WhatsApp vive en api/);
  });
});
