import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    setupFiles: ['./tests/setup.js'],
    env: {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-key',
      HUB_SUPABASE_KEY: 'test-hub-key',
    },
  },
});
