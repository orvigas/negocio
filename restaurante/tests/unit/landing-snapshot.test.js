import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.js';
import { BUSINESS_IDS } from '../../src/config/businesses.js';
import { loadSeedDocument } from '../../src/content/seeds.js';
import { renderLandingPage } from '../../src/views/landings/index.js';
import { createRenderer } from '../../src/views/render.js';
import { makeConfig } from '../helpers.js';

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

/**
 * CA-4: con la semilla, el HTML de las landings es idéntico byte a byte al previo a REQ-F-001.
 * La línea base (tests/snapshots/) se generó con el contenido estático anterior al cambio.
 */
describe('regresión visual con la semilla', () => {
  it.each(BUSINESS_IDS)('%s: el HTML coincide con la línea base', async (businessId) => {
    const menu = loadSeedDocument(businessId).data;
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu }).toString();
    await expect(html).toMatchFileSnapshot(`../snapshots/landing-${businessId}.html`);
  });
});
