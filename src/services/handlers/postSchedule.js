const { EmbedBuilder } = require('discord.js');

async function handlePostSchedule(client, notification) {
  const { division_name, round_num, group, deadline, matches } = notification.payload;

  if (!matches || matches.length === 0) {
    throw new Error('No matches in schedule payload');
  }

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) {
    throw new Error(`Channel ${notification.channel_id} not found`);
  }

  // Build title
  const parts = [];
  if (round_num) parts.push(`Round ${round_num}`);
  if (group) parts.push(`Group ${group}`);
  const roundLabel = parts.join(' \u2014 ') || 'Schedule';
  const title = division_name ? `${roundLabel} \u2014 ${division_name}` : roundLabel;

  const embed = new EmbedBuilder().setColor(0xffb300).setTitle(title);

  // Add each match as a field
  const scheduled = matches.filter((m) => m.status !== 'completed');
  const display = scheduled.length > 0 ? scheduled : matches;

  for (const m of display.slice(0, 25)) {
    // Discord limits: 25 fields max
    const bestOf = m.bestOf ? `Bo${m.bestOf}` : '';
    const dateParts = [];
    if (m.date) dateParts.push(m.date);
    if (m.time) dateParts.push(m.time);
    const dateStr = dateParts.length > 0 ? dateParts.join(' ') : 'TBD';

    embed.addFields({
      name: `${m.team1}  vs  ${m.team2}`,
      value: `${bestOf}${bestOf && dateStr ? '  \u2022  ' : ''}${dateStr}`,
      inline: false,
    });
  }

  if (display.length > 25) {
    embed.addFields({ name: '\u2026', value: `and ${display.length - 25} more`, inline: false });
  }

  // Footer
  const footerParts = [];
  if (deadline) footerParts.push(`Deadline: ${deadline}`);
  footerParts.push('Post hub URLs here when played!');
  embed.setFooter({ text: footerParts.join(' \u2022 ') });

  await channel.send({ embeds: [embed] });
  console.log(
    `[PostSchedule] Posted ${display.length} match(es) to channel ${notification.channel_id}`
  );
}

module.exports = { handlePostSchedule };
