const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function confidenceColor(score) {
  if (score >= 80) return 0x00c853; // green
  if (score >= 50) return 0xffb300; // amber
  return 0xff3366; // red
}

function confidenceLabel(score) {
  if (score >= 90) return 'Very High';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  if (score >= 30) return 'Low';
  return 'Very Low';
}

async function handleDiscoverySummary(client, notification) {
  const { candidates, tournament_id, summary } = notification.payload;

  if (!candidates || candidates.length === 0) return;

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) throw new Error(`Channel ${notification.channel_id} not found`);

  // Header embed with summary
  if (summary) {
    const headerEmbed = new EmbedBuilder()
      .setColor(0xffb300)
      .setTitle('Game Discovery Results')
      .setDescription(
        [
          `Scanned **${summary.scanned}** games, found **${candidates.length}** candidate series`,
          summary.totalMaps ? `**${summary.totalMaps}** total maps across all candidates` : null,
        ]
          .filter(Boolean)
          .join('\n')
      )
      .setFooter({ text: `Tournament: ${tournament_id}` });

    await channel.send({ embeds: [headerEmbed] });
  }

  // One message per candidate series (up to 10 to avoid rate limits)
  for (const series of candidates.slice(0, 10)) {
    const color = confidenceColor(series.avgConfidence);
    const label = confidenceLabel(series.avgConfidence);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${series.team1}  vs  ${series.team2}`)
      .setDescription(
        `**${series.mapCount}** map(s)  \u2022  Confidence: **${Math.round(series.avgConfidence)}%** (${label})  \u2022  Source: ${series.source || 'unknown'}`
      );

    // Add each map as a field
    for (const game of (series.games || []).slice(0, 10)) {
      const t1 = game.teams?.[0];
      const t2 = game.teams?.[1];
      const score = t1 && t2 ? `${t1.frags} - ${t2.frags}` : '?';
      const mapConf = game.confidence?.total ? ` (${Math.round(game.confidence.total)}%)` : '';
      const time = game.timestamp ? new Date(game.timestamp).toLocaleDateString() : '';

      embed.addFields({
        name: game.map || 'unknown',
        value: `${score}${mapConf}${time ? `  \u2022  ${time}` : ''}`,
        inline: true,
      });
    }

    // Build action row with Approve/Reject buttons
    // Use the first game's ID as the entity for the button
    const firstGameId = series.games?.[0]?.id;
    const components = [];

    if (firstGameId) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`qwicky:approve:${firstGameId}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`qwicky:reject:${firstGameId}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
      );
      components.push(row);
    }

    await channel.send({ embeds: [embed], components });
  }

  if (candidates.length > 10) {
    await channel.send(`... and ${candidates.length - 10} more candidates. Review all in QWICKY.`);
  }

  console.log(
    `[DiscoverySummary] Posted ${Math.min(candidates.length, 10)} candidate(s) to channel ${notification.channel_id}`
  );
}

module.exports = { handleDiscoverySummary };
