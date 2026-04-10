const { supabase } = require('./supabase');

// Enqueue game-day reminders and unscheduled-match alerts for all active tournaments
async function generateDailyNotifications(today) {
  // Find tournaments that have registered channels
  const { data: channels, error: chErr } = await supabase
    .from('tournament_channels')
    .select('tournament_id, discord_channel_id');

  if (chErr) {
    console.error('[DailyReminders] Error fetching channels:', chErr.message);
    return;
  }
  if (!channels || channels.length === 0) return;

  // Group channels by tournament
  const byTournament = {};
  for (const ch of channels) {
    if (!byTournament[ch.tournament_id]) byTournament[ch.tournament_id] = [];
    byTournament[ch.tournament_id].push(ch.discord_channel_id);
  }

  for (const [tournamentId, channelIds] of Object.entries(byTournament)) {
    try {
      // Check tournament settings
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('settings')
        .eq('id', tournamentId)
        .single();

      const discord = tournament?.settings?.discord || {};

      // Game day reminders
      if (discord.gameDayReminders?.enabled) {
        await enqueueGameDayReminders(tournamentId, channelIds, today);
      }

      // Unscheduled match alerts
      if (discord.unscheduledAlerts?.enabled) {
        await enqueueUnscheduledAlerts(tournamentId, channelIds);
      }

      // Stale pending submissions (always check if adminAlerts enabled)
      if (discord.adminAlerts?.enabled) {
        await enqueueStalePendingAlerts(tournamentId, channelIds);
      }
    } catch (err) {
      console.error(`[DailyReminders] Error for tournament ${tournamentId}:`, err.message);
    }
  }
}

async function enqueueGameDayReminders(tournamentId, channelIds, today) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('team1, team2, match_date, match_time, best_of, round, "group", round_num, division_id')
    .eq('tournament_id', tournamentId)
    .eq('match_date', today)
    .eq('status', 'scheduled');

  if (error) {
    console.error("[DailyReminders] Error fetching today's matches:", error.message);
    return;
  }
  if (!matches || matches.length === 0) return;

  // Group by division for cleaner embeds
  const byDivision = {};
  for (const m of matches) {
    const key = m.division_id || 'default';
    if (!byDivision[key]) byDivision[key] = [];
    byDivision[key].push(m);
  }

  // Look up division names
  const divIds = Object.keys(byDivision).filter((k) => k !== 'default');
  let divNames = {};
  if (divIds.length > 0) {
    const { data: divs } = await supabase.from('divisions').select('id, name').in('id', divIds);
    if (divs) divNames = Object.fromEntries(divs.map((d) => [d.id, d.name]));
  }

  const rows = [];
  for (const [divId, divMatches] of Object.entries(byDivision)) {
    for (const channelId of channelIds) {
      rows.push({
        tournament_id: tournamentId,
        channel_id: channelId,
        notification_type: 'game_day_reminder',
        payload: {
          date: today,
          division_name: divNames[divId] || null,
          matches: divMatches.map((m) => ({
            team1: m.team1,
            team2: m.team2,
            time: m.match_time || null,
            bestOf: m.best_of,
            round: m.round,
            group: m.group,
          })),
        },
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from('discord_notifications').insert(rows);
    if (insertErr)
      console.error('[DailyReminders] Error enqueuing game day reminders:', insertErr.message);
    else
      console.log(
        `[DailyReminders] Enqueued ${rows.length} game day reminder(s) for ${tournamentId}`
      );
  }
}

async function enqueueUnscheduledAlerts(tournamentId, channelIds) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('team1, team2, round, "group", round_num, division_id')
    .eq('tournament_id', tournamentId)
    .eq('status', 'scheduled')
    .is('match_date', null);

  if (error) {
    console.error('[DailyReminders] Error fetching unscheduled matches:', error.message);
    return;
  }
  if (!matches || matches.length === 0) return;

  // Look up division names
  const divIds = [...new Set(matches.map((m) => m.division_id).filter(Boolean))];
  let divNames = {};
  if (divIds.length > 0) {
    const { data: divs } = await supabase.from('divisions').select('id, name').in('id', divIds);
    if (divs) divNames = Object.fromEntries(divs.map((d) => [d.id, d.name]));
  }

  for (const channelId of channelIds) {
    await supabase.from('discord_notifications').insert({
      tournament_id: tournamentId,
      channel_id: channelId,
      notification_type: 'unscheduled_alert',
      payload: {
        total_unscheduled: matches.length,
        matches: matches.slice(0, 15).map((m) => ({
          team1: m.team1,
          team2: m.team2,
          round: m.round,
          group: m.group,
          round_num: m.round_num,
          division_name: divNames[m.division_id] || null,
        })),
      },
    });
  }
  console.log(
    `[DailyReminders] Enqueued unscheduled alert for ${tournamentId} (${matches.length} matches)`
  );
}

async function enqueueStalePendingAlerts(tournamentId, channelIds) {
  // Find pending submissions older than 3 days
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale, error } = await supabase
    .from('match_submissions')
    .select('id, game_id, submitted_by_name, created_at')
    .eq('tournament_id', tournamentId)
    .eq('status', 'pending')
    .lt('created_at', cutoff);

  if (error) {
    console.error('[DailyReminders] Error fetching stale submissions:', error.message);
    return;
  }
  if (!stale || stale.length === 0) return;

  for (const channelId of channelIds) {
    await supabase.from('discord_notifications').insert({
      tournament_id: tournamentId,
      channel_id: channelId,
      notification_type: 'admin_alert',
      payload: {
        alert_type: 'stale_pending',
        severity: 'warning',
        details: `${stale.length} submission(s) pending for 3+ days. Review them in QWICKY.`,
        submissions: stale.slice(0, 10).map((s) => ({
          game_id: s.game_id,
          submitted_by: s.submitted_by_name,
          created_at: s.created_at,
        })),
      },
    });
  }
  console.log(
    `[DailyReminders] Enqueued stale pending alert for ${tournamentId} (${stale.length} submissions)`
  );
}

async function cleanupOldNotifications() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('discord_notifications')
    .delete({ count: 'exact' })
    .in('status', ['completed', 'failed'])
    .lt('created_at', cutoff);

  if (error) {
    console.error('[Cleanup] Error deleting old notifications:', error.message);
  } else if (count > 0) {
    console.log(`[Cleanup] Deleted ${count} notification(s) older than 7 days`);
  }
}

module.exports = { generateDailyNotifications, cleanupOldNotifications };
