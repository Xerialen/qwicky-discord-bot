vi.mock('../services/supabase', () => ({
  supabase: {},
  getChannelRegistration: vi.fn(),
  insertSubmission: vi.fn(),
  updateSubmissionMessageId: vi.fn(),
}));

vi.mock('../services/hubApi', () => ({
  fetchGameData: vi.fn(),
}));

const { getTeamScores } = require('../listeners/messageCreate');

describe('getTeamScores', () => {
  describe('Hub row format (teams as objects)', () => {
    it('extracts name and frags from team objects', () => {
      const gameData = {
        teams: [
          { name: 'Thunderbolts', frags: 42 },
          { name: 'Rockets', frags: 37 },
        ],
      };
      expect(getTeamScores(gameData)).toEqual({
        t1Name: 'Thunderbolts',
        t2Name: 'Rockets',
        t1Score: 42,
        t2Score: 37,
      });
    });

    it('falls back to ? when team object has no name', () => {
      const gameData = {
        teams: [{ frags: 10 }, { frags: 5 }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('?');
      expect(result.t2Name).toBe('?');
    });

    it('falls back to ? when team object has no frags', () => {
      const gameData = {
        teams: [{ name: 'Alpha' }, { name: 'Beta' }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe('?');
      expect(result.t2Score).toBe('?');
    });

    it('handles missing second team gracefully', () => {
      const gameData = {
        teams: [{ name: 'Solo', frags: 20 }],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('Solo');
      expect(result.t1Score).toBe(20);
      expect(result.t2Name).toBe('?');
      expect(result.t2Score).toBe('?');
    });
  });

  describe('ktxstats format with team_stats', () => {
    it('sums frags from team_stats', () => {
      const gameData = {
        teams: ['axemen', 'bishops'],
        team_stats: {
          axemen: { frags: 55 },
          bishops: { frags: 48 },
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('axemen');
      expect(result.t2Name).toBe('bishops');
      expect(result.t1Score).toBe(55);
      expect(result.t2Score).toBe(48);
    });

    it('strips QW color codes from team names', () => {
      const gameData = {
        teams: ['^1red^0team', '^4blue^0team'],
        team_stats: {
          '^1red^0team': { frags: 30 },
          '^4blue^0team': { frags: 20 },
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Name).toBe('redteam');
      expect(result.t2Name).toBe('blueteam');
    });

    it('falls back to ? when team_stats entry is missing', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        team_stats: {
          alpha: { frags: 10 },
          // beta missing
        },
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(10);
      expect(result.t2Score).toBe('?');
    });
  });

  describe('ktxstats format with players array', () => {
    it('sums frags per team from players with stats.frags', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        players: [
          { team: 'alpha', stats: { frags: 10 } },
          { team: 'alpha', stats: { frags: 15 } },
          { team: 'beta', stats: { frags: 8 } },
        ],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(25);
      expect(result.t2Score).toBe(8);
    });

    it('sums frags per team from players with top-level frags field', () => {
      const gameData = {
        teams: ['alpha', 'beta'],
        players: [
          { team: 'alpha', frags: 7 },
          { team: 'beta', frags: 3 },
          { team: 'beta', frags: 9 },
        ],
      };
      const result = getTeamScores(gameData);
      expect(result.t1Score).toBe(7);
      expect(result.t2Score).toBe(12);
    });
  });

  describe('fallback when no score data', () => {
    it('returns ? for scores when no teams, team_stats, or players', () => {
      const result = getTeamScores({});
      expect(result).toEqual({ t1Name: '?', t2Name: '?', t1Score: '?', t2Score: '?' });
    });

    it('handles empty teams array', () => {
      const result = getTeamScores({ teams: [] });
      expect(result.t1Score).toBe('?');
      expect(result.t2Score).toBe('?');
    });
  });
});
