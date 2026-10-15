import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'packages/**/*.test.ts',
      'apps/server/src/tests/**/*.test.ts',
      'apps/web/tests/**/*.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } },
});
