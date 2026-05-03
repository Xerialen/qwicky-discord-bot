const { EmbedBuilder } = require('discord.js');
const { extractUrls } = require('../utils/parseUrl');
const {
  getChannelRegistration,
  insertSubmission,
  updateSubmissionMessageId,
} = require('../services/supabase');
const { fetchGameData } = require('../services/hubApi');
const { cleanName } = require('../utils/nameNormalizer');

const AUTO_APPROVE_URL = process.env.QWICKY_AUTO_APPROVE_URL; // e.g. https://qwicky.vercel.app/api/auto-approve

async function callAutoApprove(submissionId, tournamentId, divisionId, gameData) {
  if (!AUTO_APPROVE_URL) return null;
  try {
    const res = await fetch(AUTO_APPROVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, tournamentId, divisionId, gameData }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Calculate team frags from game data (handles all formats)
function getTeamScores(gameData) {
  const rawTeams = gameData.teams || [];
  const t1Raw = rawTeams[0];
  const t2Raw = rawTeams[1];

  // Hub row format: teams are objects with .name and .frags
  if (typeof t1Raw === 'object' && t1Raw !== null) {
    return {
      t1Name: t1Raw.name || '?',
      t2Name: t2Raw?.name || '?',
      t1Score: t1Raw.frags ?? '?',
      t2Score: t2Raw?.frags ?? '?',
    };
  }

  // ktxstats format: teams are strings, scores from team_stats or players
  const t1Name = cleanName(t1Raw || '');
  const t2Name = cleanName(t2Raw || '');

  if (gameData.team_stats) {
    return {
      t1Name,
      t2Name,
      t1Score: gameData.team_stats[t1Raw]?.frags ?? '?',
      t2Score: gameData.team_stats[t2Raw]?.frags ?? '?',
    };
  }

  if (gameData.players && Array.isArray(gameData.players)) {
    let t1Score = 0,
      t2Score = 0;
    gameData.players.forEach((p) => {
      const frags = p.stats?.frags ?? p.frags ?? 0;
      if (p.team === t1Raw) t1Score += frags;
      else if (p.team === t2Raw) t2Score += frags;
    });
    return { t1Name, t2Name, t1Score, t2Score };
  }

  return { t1Name: t1Name || '?', t2Name: t2Name || '?', t1Score: '?', t2Score: '?' };
}

async function handleMessage(message) {
  // Extract hub URLs from the message
  const urls = extractUrls(message.content);
  console.log(
    `[MessageCreate] Extracted ${urls.length} URLs from message in channel ${message.channelId}`
  );
  if (urls.length === 0) return;

  // Check if this channel is registered
  const reg = await getChannelRegistration(message.channelId);
  console.log(`[MessageCreate] Channel registration:`, reg ? 'FOUND' : 'NOT FOUND');
  if (!reg) return;

  const embeds = [];
  const successfulSubmissionIds = [];

  for (const { url, gameId } of urls) {
    try {
      // Fetch game data from hub
      const gameData = await fetchGameData(gameId);

      // Insert submission
      const result = await insertSubmission({
        tournamentId: reg.tournament_id,
        divisionId: reg.division_id,
        hubUrl: `https://${url}`,
        gameId,
        gameData,
        discordUserId: message.author.id,
        discordUserName: message.author.displayName || message.author.username,
        channelId: message.channelId,
      });

      if (!result.duplicate) {
        successfulSubmissionIds.push(result.id);
      }

      if (result.duplicate) {
        embeds.push(
          new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle(`Game ${gameId} — Duplicate`)
            .setDescription('This game has already been submitted.')
        );
        continue;
      }

      // Fire auto-approve (non-blocking — don't await before building embed)
      const autoApprovePromise = callAutoApprove(
        result.id,
        reg.tournament_id,
        reg.division_id,
        gameData
      );

      // Build confirmation embed for this map
      const { t1Name, t2Name, t1Score, t2Score } = getTeamScores(gameData);
      const map = gameData.map || 'unknown';
      const mode = gameData.mode || '';

      // Wait for auto-approve result to set embed color
      const approval = await autoApprovePromise;
      const embedColor =
        approval?.status === 'approved'
          ? 0x00c853 // green
          : approval?.status === 'flagged'
            ? 0xffd600 // yellow
            : 0xffb300; // gold (pending/unknown)
      const statusNote =
        approval?.status === 'approved'
          ? `✓ Auto-approved → match ${approval.matchId}`
          : approval?.status === 'flagged'
            ? `⚠ Flagged: ${approval.reason}`
            : null;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${t1Name} vs ${t2Name} — ${map}`)
        .addFields(
          { name: 'Score', value: `${t1Score} - ${t2Score}`, inline: true },
          { name: 'Mode', value: mode, inline: true },
          { name: 'Game ID', value: gameId, inline: true }
        );
      if (statusNote) embed.addFields({ name: 'Status', value: statusNote, inline: false });
      embeds.push(embed);
    } catch (err) {
      console.error(`Error processing game ${gameId}:`, err);
      embeds.push(
        new EmbedBuilder()
          .setColor(0xff3366)
          .setTitle(`Game ${gameId} — Error`)
          .setDescription(err.message)
      );
    }
  }

  if (embeds.length > 0) {
    // Add footer only to the last embed
    embeds[embeds.length - 1].setFooter({
      text: `${embeds.length} map(s) submitted | Tournament: ${reg.tournament_id}${AUTO_APPROVE_URL ? ' | Auto-approve enabled' : ' | Pending review in QWICKY'}`,
    });
    console.log(`[MessageCreate] Sending ${embeds.length} embed(s) as reply`);
    const replyMsg = await message.reply({ embeds });

    // Store the Discord message ID on each submission so we can edit embeds later
    for (const subId of successfulSubmissionIds) {
      await updateSubmissionMessageId(subId, replyMsg.id);
    }
    console.log(
      `[MessageCreate] Reply sent successfully (messageId: ${replyMsg.id}, linked to ${successfulSubmissionIds.length} submission(s))`
    );
  } else {
    console.log(`[MessageCreate] No embeds to send`);
  }
}

module.exports = { handleMessage };
