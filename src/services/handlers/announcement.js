async function handleAnnouncement(client, notification) {
  const { content } = notification.payload;
  if (!content) throw new Error('Announcement payload missing content');

  const channel = await client.channels.fetch(notification.channel_id);
  if (!channel) throw new Error(`Channel ${notification.channel_id} not found`);

  await channel.send({ content, allowedMentions: { parse: [] } });
  console.log(`[Announcement] Posted to channel ${notification.channel_id}`);
}

module.exports = { handleAnnouncement };
