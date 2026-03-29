const { EmbedBuilder } = require('discord.js');

const ALERT_TITLES = {
  stale_pending: 'Stale Pending Submissions',
  unmatched_teams: 'Unmatched Teams',
};

async function handleAdminAlert(client, notification) {
  const { alert_type, severity, details, submissions } = notification.payload;

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) throw new Error(`Channel ${notification.channel_id} not found`);

  const color = severity === 'error' ? 0xFF3366 : 0xFF9800;
  const title = ALERT_TITLES[alert_type] || `Admin Alert \u2014 ${alert_type}`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(details || 'No details provided.');

  // Add submission details if present (stale pending)
  if (submissions && submissions.length > 0) {
    const lines = submissions.map(s =>
      `\u2022 Game ${s.game_id} by ${s.submitted_by} (${new Date(s.created_at).toLocaleDateString()})`
    );
    embed.addFields({
      name: 'Submissions',
      value: lines.join('\n').slice(0, 1024),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Review in QWICKY \u2192 Results \u2192 Discord tab' });

  await channel.send({ embeds: [embed] });
  console.log(`[AdminAlert] Posted ${alert_type} alert to channel ${notification.channel_id}`);
}

module.exports = { handleAdminAlert };
