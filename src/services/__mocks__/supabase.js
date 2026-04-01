// Manual mock for src/services/supabase.js
// Used automatically when tests call vi.mock('../services/supabase').
// vi is injected as a global by Vitest, so vi.fn() here creates real mock instances
// with the full mock API (.mockResolvedValue, .mockRejectedValue, etc.).

const { vi } = require('vitest');

module.exports = {
  supabase: { from: vi.fn() },
  getChannelRegistration: vi.fn(),
  registerChannel: vi.fn(),
  unregisterChannel: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmissionMessageId: vi.fn(),
  getSubmissionById: vi.fn(),
  claimNotifications: vi.fn(),
  completeNotification: vi.fn(),
  failNotification: vi.fn(),
};
