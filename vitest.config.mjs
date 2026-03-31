import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_KEY: 'placeholder-key',
    },
  },
});
