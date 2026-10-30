import { afterAll, describe } from 'vitest';

import { CONTRACT_SECTIONS, FACTORIES, productRepositoryContract, runCleanups } from '../support/product-repository-contract.ts';

/**
 * Contrato del repositorio de productos (REQ-F-008, RF-9; ver tests/support/product-repository-contract.ts).
 * REQ-F-041: parte de product-repository-contract.test.ts.
 */

afterAll(runCleanups);

describe.each(FACTORIES.filter(([name]) => name === 'memoria'))('repositorio de productos (%s)', (_name, factory) => {
  productRepositoryContract(factory, CONTRACT_SECTIONS);
});
