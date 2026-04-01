vi.mock('../services/supabase', () => ({
  getChannelRegistration: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmissionMessageId: vi.fn(),
}));

vi.mock('../services/hubApi', () => ({
  fetchGameData: vi.fn(),
}));

const { callAutoApprove } = require('../listeners/messageCreate');

const AUTO_APPROVE_URL = 'https://qwicky.example.com/api/auto-approve';

describe('callAutoApprove', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
    delete process.env.QWICKY_AUTO_APPROVE_URL;
    delete process.env.ADMIN_API_KEY;
  });

  afterEach(() => {
    fetchMock.mockRestore();
    delete process.env.QWICKY_AUTO_APPROVE_URL;
    delete process.env.ADMIN_API_KEY;
  });

  it('returns null without fetching when QWICKY_AUTO_APPROVE_URL is not set', async () => {
    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends POST with correct JSON payload and Authorization header', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    process.env.ADMIN_API_KEY = 'test-admin-key';
    const gameData = { teams: ['alpha', 'beta'], map: 'dm2' };
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'approved', matchId: 'match1' }),
    });

    await callAutoApprove('sub1', 'qwi-2025', 'div-1', gameData);

    expect(fetchMock).toHaveBeenCalledWith(
      AUTO_APPROVE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-key',
        },
        body: JSON.stringify({
          submissionId: 'sub1',
          tournamentId: 'qwi-2025',
          divisionId: 'div-1',
          gameData,
        }),
      })
    );
  });

  it('returns the parsed JSON response on success', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    const approvalResult = { status: 'approved', matchId: 'match1' };
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(approvalResult),
    });

    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toEqual(approvalResult);
  });

  it('returns null when response is not ok (e.g. 401 unauthorized)', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toBeNull();
  });

  it('returns null on network error without throwing', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    fetchMock.mockRejectedValue(new Error('network timeout'));

    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toBeNull();
  });

  it('returns null on fetch timeout without throwing', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    fetchMock.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));

    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toBeNull();
  });

  it('returns flagged status when API flags the submission', async () => {
    process.env.QWICKY_AUTO_APPROVE_URL = AUTO_APPROVE_URL;
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'flagged', reason: 'Duplicate teams' }),
    });

    const result = await callAutoApprove('sub1', 'qwi-2025', 'div-1', {});
    expect(result).toEqual({ status: 'flagged', reason: 'Duplicate teams' });
  });
});
