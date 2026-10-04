import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { BUSINESS_IDS } from '../../src/config/businesses.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import type { MenuDocument } from '../../src/services/menu-schema.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { createRenderer } from '../../src/views/render.ts';
import { makeConfig } from '../helpers.ts';

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

/**
 * CA-4: con la semilla, el HTML de las landings es idéntico byte a byte al previo a REQ-F-001.
 * La línea base (tests/snapshots/) se generó con el contenido estático anterior al cambio.
 */
describe('regresión visual con la semilla', () => {
  it.each(BUSINESS_IDS)('%s: el HTML coincide con la línea base', async (businessId) => {
    // Semilla versionada (válida según content.test).
    const menu = (loadSeedDocument(businessId) as MenuDocument).data;
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu }).toString();
    await expect(html).toMatchFileSnapshot(`../snapshots/landing-${businessId}.html`);
  });
});
