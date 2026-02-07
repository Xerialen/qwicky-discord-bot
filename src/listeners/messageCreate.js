const { EmbedBuilder } = require('discord.js');
const { extractUrls } = require('../utils/parseUrl');
const { getChannelRegistration, insertSubmission } = require('../services/supabase');
const { fetchGameData } = require('../services/hubApi');

// Clean QuakeWorld high-bit character encoding for display
function cleanQWName(name) {
  if (typeof name !== 'string') return String(name || '');
  const lookup = { 0:"=",2:"=",5:".",10:" ",14:".",15:".",16:"[",17:"]",18:"0",19:"1",20:"2",21:"3",22:"4",23:"5",24:"6",25:"7",26:"8",27:"9",28:".",29:"=",30:"=",31:"=" };
  return name.split('').map(ch => {
    const c = ch.charCodeAt(0);
    const n = c >= 128 ? c - 128 : c;
    if (n < 32) return lookup[n] || '';
    return String.fromCharCode(n);
  }).join('').trim();
}

// Calculate team frags from game data (handles all formats)
function getTeamScores(gameData) {
  const rawTeams = gameData.teams || [];
  const t1Raw = rawTeams[0];
  const t2Raw = rawTeams[1];

  // Hub row format: teams are objects with .name and .frags
  if (typeof t1Raw === 'object' && t1Raw !== null) {
    return { t1Name: t1Raw.name || '?', t2Name: t2Raw?.name || '?', t1Score: t1Raw.frags ?? '?', t2Score: t2Raw?.frags ?? '?' };
  }

  // ktxstats format: teams are strings, scores from team_stats or players
  const t1Name = cleanQWName(t1Raw || '');
  const t2Name = cleanQWName(t2Raw || '');

  if (gameData.team_stats) {
    return { t1Name, t2Name, t1Score: gameData.team_stats[t1Raw]?.frags ?? '?', t2Score: gameData.team_stats[t2Raw]?.frags ?? '?' };
  }

  if (gameData.players && Array.isArray(gameData.players)) {
    let t1Score = 0, t2Score = 0;
    gameData.players.forEach(p => {
      const frags = p.stats?.frags ?? p.frags ?? 0;
      if (p.team === t1Raw) t1Score += frags;
      else if (p.team === t2Raw) t2Score += frags;
    });
    return { t1Name, t2Name, t1Score, t2Score };
  }

  return { t1Name: t1Name || '?', t2Name: t2Name || '?', t1Score: '?', t2Score: '?' };
}

async function handleMessage(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Extract hub URLs from the message
  const urls = extractUrls(message.content);
  if (urls.length === 0) return;

  // Check if this channel is registered
  const reg = await getChannelRegistration(message.channelId);
  if (!reg) return;

  const embeds = [];

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

      if (result.duplicate) {
        embeds.push(new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle(`Game ${gameId} — Duplicate`)
          .setDescription('This game has already been submitted.')
        );
        continue;
      }

      // Build confirmation embed for this map
      const { t1Name, t2Name, t1Score, t2Score } = getTeamScores(gameData);
      const map = gameData.map || 'unknown';
      const mode = gameData.mode || '';

      embeds.push(new EmbedBuilder()
        .setColor(0xFFB300)
        .setTitle(`${t1Name} vs ${t2Name} — ${map}`)
        .addFields(
          { name: 'Score', value: `${t1Score} - ${t2Score}`, inline: true },
          { name: 'Mode', value: mode, inline: true },
          { name: 'Game ID', value: gameId, inline: true },
        )
      );
    } catch (err) {
      console.error(`Error processing game ${gameId}:`, err);
      embeds.push(new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle(`Game ${gameId} — Error`)
        .setDescription(err.message)
      );
    }
  }

  if (embeds.length > 0) {
    // Add footer only to the last embed
    embeds[embeds.length - 1].setFooter({
      text: `${embeds.length} map(s) submitted | Pending review in QWICKY | Tournament: ${reg.tournament_id}`
    });
    await message.reply({ embeds });
  }
}

module.exports = { handleMessage };
