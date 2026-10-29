import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS } from '@restaurante/core/shared';
import type { MenuDocument } from '@restaurante/core/catalog';
import { createRenderer } from '@restaurante/web';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { makeConfig } from '../helpers.ts';

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

/**
 * CA-4: con la semilla, el HTML de las landings es idéntico byte a byte al previo a REQ-F-001.
 * La línea base (tests/snapshots/) se generó con el contenido estático anterior al cambio.
 * REQ-F-010 la regeneró cambiando solo los textos de horario (el marcado no cambió).
 */
describe('regresión visual con la semilla', () => {
  it.each(BUSINESS_IDS)('%s: el HTML coincide con la línea base', async (businessId) => {
    // Semilla versionada (válida según content.test).
    const menu = (loadSeedDocument(businessId) as MenuDocument).data;
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu }).toString();
    await expect(html).toMatchFileSnapshot(`../snapshots/landing-${businessId}.html`);
  });
});
