const DEFAULT_CHANNEL_ID = '1467942158135853218'; // #qwicky

async function handleAnnouncement(client, notification) {
  const { content, source_issue } = notification.payload;
  if (!content) throw new Error('Announcement payload missing "content"');

  const channelId = notification.channel_id || DEFAULT_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  await channel.send(content);
  console.log(
    `[Announcement] Posted to channel ${channelId}` +
      (source_issue ? ` (source: ${source_issue})` : '')
  );
}

module.exports = { handleAnnouncement };
