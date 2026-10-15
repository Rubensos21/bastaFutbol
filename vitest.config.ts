import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      '@basta/shared': fileURLToPath(new URL('./packages/shared/dist/index.js', import.meta.url)),
    },
  },
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
