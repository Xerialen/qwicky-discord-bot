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
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Duplicate')
            .setDescription(`Game **${gameId}** has already been submitted.`)
          ],
        });
        continue;
      }

      // Build confirmation embed
      const teams = gameData.teams || [];
      const map = gameData.map || 'unknown';
      const mode = gameData.mode || '';
      const team1 = teams[0] || {};
      const team2 = teams[1] || {};
      const t1Name = team1.name || 'Team 1';
      const t2Name = team2.name || 'Team 2';
      const t1Score = team1.frags ?? '?';
      const t2Score = team2.frags ?? '?';

      const embed = new EmbedBuilder()
        .setColor(0xFFB300)
        .setTitle('Match Submitted')
        .addFields(
          { name: 'Teams', value: `**${t1Name}** vs **${t2Name}**`, inline: false },
          { name: 'Score', value: `${t1Score} - ${t2Score}`, inline: true },
          { name: 'Map', value: map, inline: true },
          { name: 'Mode', value: mode, inline: true },
          { name: 'Game ID', value: gameId, inline: true },
        )
        .setFooter({ text: `Pending review in QWICKY | Tournament: ${reg.tournament_id}` });

      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(`Error processing game ${gameId}:`, err);
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF3366)
          .setTitle('Error')
          .setDescription(`Failed to process game **${gameId}**: ${err.message}`)
        ],
      });
    }
  }
}

module.exports = { handleMessage };
