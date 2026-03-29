const { supabase } = require('./supabase');

/**
 * Generate a weekly activity report for a tournament.
 * @param {string} tournamentId
 * @returns {Promise<{embed: object, hasActivity: boolean}>}
 */
async function generateWeeklyReport(tournamentId) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const startDate = weekAgo.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  // Fetch all submissions from the last 7 days for this tournament
  const { data: submissions, error } = await supabase
    .from('match_submissions')
    .select('*')
    .eq('tournament_id', tournamentId)
    .gte('created_at', weekAgo.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    console.error(`[WeeklyReport] Error fetching submissions for ${tournamentId}:`, error);
    throw error;
  }

  // No activity
  if (!submissions || submissions.length === 0) {
    return {
      embed: {
        title: `Weekly Activity Report — ${tournamentId}`,
        description: 'No activity this week.',
        color: 0x808080, // gray
        footer: { text: `Report for ${startDate} – ${endDate}` },
      },
      hasActivity: false,
    };
  }

  // Count by status
  const total = submissions.length;
  const approved = submissions.filter(s => s.status === 'approved').length;
  const pending = submissions.filter(s => s.status === 'pending').length;

  // Unique maps from game_data
  const maps = new Set();
  for (const sub of submissions) {
    if (sub.game_data && sub.game_data.map) {
      maps.add(sub.game_data.map);
    }
  }
  const mapList = maps.size > 0 ? [...maps].join(', ') : 'N/A';

  // Most active teams — count submissions per team appearing in game_data
  const teamCounts = {};
  for (const sub of submissions) {
    if (sub.game_data && Array.isArray(sub.game_data.players)) {
      const teamsInGame = new Set();
      for (const player of sub.game_data.players) {
        if (player.team) {
          teamsInGame.add(player.team);
        }
      }
      for (const team of teamsInGame) {
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      }
    }
  }
  const topTeams = Object.entries(teamCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ') || 'N/A';

  return {
    embed: {
      title: `Weekly Activity Report — ${tournamentId}`,
      fields: [
        { name: 'Submissions this week', value: String(total), inline: true },
        { name: 'Approved', value: String(approved), inline: true },
        { name: 'Pending review', value: String(pending), inline: true },
        { name: 'Maps played', value: mapList, inline: false },
        { name: 'Most active teams', value: topTeams, inline: false },
      ],
      color: 0xFFB300, // amber
      footer: { text: `Report for ${startDate} – ${endDate}` },
    },
    hasActivity: true,
  };
}

module.exports = { generateWeeklyReport };
