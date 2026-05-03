// Global test setup: stub fetch to prevent real network calls from
// Supabase client background connections (realtime, health checks).
// Individual test mocks for specific modules will override as needed.

import { vi } from 'vitest';

// Replace global fetch with a stub that returns a realistic Response-like object.
// This prevents the Supabase client (which gets created at module load
// time in supabase.js) from making real network requests.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({}),
  text: async () => '',
  clone: function () { return this; },
});
