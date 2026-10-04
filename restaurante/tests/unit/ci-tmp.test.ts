// Prueba temporal de verificación del CI (REQ-F-006, CA-4). No mergear.
import { describe, expect, it } from 'vitest';

describe('ci-tmp', () => {
  it('falla a propósito', () => {
    expect(1).toBe(2);
  });
});
