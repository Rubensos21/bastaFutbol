import { describe, it } from 'vitest';
import { cases } from '../../../../tests/core.cases.js';
describe('Reglas compartidas y motor autoritativo', () => {
  for (const [name, run] of cases) it(name, run);
});
