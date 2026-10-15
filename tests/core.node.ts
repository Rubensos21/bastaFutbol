import { test } from 'node:test';
import { cases } from './core.cases.js';
for (const [name, run] of cases) test(name, run);
