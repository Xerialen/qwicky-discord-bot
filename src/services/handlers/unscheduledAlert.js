const { EmbedBuilder } = require('discord.js');

async function handleUnscheduledAlert(client, notification) {
  const { total_unscheduled, matches } = notification.payload;

  if (!matches || matches.length === 0) return;

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) throw new Error(`Channel ${notification.channel_id} not found`);

  const embed = new EmbedBuilder()
    .setColor(0xff9800) // orange
    .setTitle('Unscheduled Matches')
    .setDescription(`**${total_unscheduled}** match(es) still need a date`);

  for (const m of matches.slice(0, 15)) {
    const parts = [];
    if (m.division_name) parts.push(m.division_name);
    if (m.group) parts.push(`Group ${m.group}`);
    parts.push(`Round ${m.round_num}`);

    embed.addFields({
      name: `${m.team1}  vs  ${m.team2}`,
      value: parts.join('  \u2022  '),
      inline: false,
    });
  }

  if (total_unscheduled > 15) {
    embed.addFields({ name: '\u2026', value: `and ${total_unscheduled - 15} more`, inline: false });
  }

  embed.setFooter({ text: 'Set dates in the QWICKY Schedule tab.' });

  await channel.send({ embeds: [embed] });
  console.log(
    `[UnscheduledAlert] Posted ${total_unscheduled} unscheduled match(es) to channel ${notification.channel_id}`
  );
}

module.exports = { handleUnscheduledAlert };
