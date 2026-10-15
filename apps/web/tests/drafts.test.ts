import { createMutationId } from '../src/utils/mutation';
import { describe, expect, it } from 'vitest';
import { draftKey, readDrafts } from '../../../apps/web/src/utils/drafts';
describe('Aislamiento de borradores', () => {
  it('separa sesión, sala y ronda', () => {
    expect(draftKey('a', 'R1', 'r1')).not.toBe(draftKey('b', 'R1', 'r1'));
    expect(draftKey('a', 'R1', 'r1')).not.toBe(draftKey('a', 'R2', 'r1'));
    expect(draftKey('a', 'R1', 'r1')).not.toBe(draftKey('a', 'R1', 'r2'));
  });
  it('almacenamiento no disponible conserva el funcionamiento', () => {
    expect(readDrafts('sin-localStorage')).toEqual({});
  });
});

describe('Mutaciones desde navegador', () => {
  it('genera UUID v4 seguros y distintos', () => {
    const a = createMutationId(),
      b = createMutationId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
