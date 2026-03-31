const { EmbedBuilder } = require('discord.js');

async function handleGameDayReminder(client, notification) {
  const { date, division_name, matches } = notification.payload;

  if (!matches || matches.length === 0) return;

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) throw new Error(`Channel ${notification.channel_id} not found`);

  const title = division_name ? `Matches Today \u2014 ${division_name}` : 'Matches Today';

  const embed = new EmbedBuilder()
    .setColor(0x2196f3) // blue
    .setTitle(title)
    .setDescription(`${matches.length} match(es) scheduled for **${date}**`);

  for (const m of matches.slice(0, 25)) {
    const parts = [];
    if (m.bestOf) parts.push(`Bo${m.bestOf}`);
    if (m.time) parts.push(m.time);
    else parts.push('Time TBD');
    if (m.group) parts.push(`Group ${m.group}`);

    embed.addFields({
      name: `${m.team1}  vs  ${m.team2}`,
      value: parts.join('  \u2022  '),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Good luck! Post hub URLs here when played.' });

  await channel.send({ embeds: [embed] });
  console.log(
    `[GameDayReminder] Posted ${matches.length} match(es) to channel ${notification.channel_id}`
  );
}

module.exports = { handleGameDayReminder };
