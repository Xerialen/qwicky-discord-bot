const { EmbedBuilder } = require('discord.js');
const { extractUrls } = require('../utils/parseUrl');
const { getChannelRegistration, insertSubmission } = require('../services/supabase');
const { fetchGameData } = require('../services/hubApi');

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
      const teams = gameData.teams || [];
      const map = gameData.map || 'unknown';
      const mode = gameData.mode || '';
      const team1 = teams[0] || {};
      const team2 = teams[1] || {};
      const t1Name = team1.name || 'Team 1';
      const t2Name = team2.name || 'Team 2';
      const t1Score = team1.frags ?? '?';
      const t2Score = team2.frags ?? '?';

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
