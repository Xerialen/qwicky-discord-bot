const { EmbedBuilder } = require('discord.js');
const { getSubmissionById } = require('../supabase');

const STATUS_COLORS = {
  approved: 0x00c853, // green
  rejected: 0xff3366, // red
  flagged: 0xffd600, // yellow
  pending: 0xffb300, // amber/gold
};

const STATUS_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
};

async function handleEditSubmission(client, notification) {
  const { submission_id, new_status, reviewer } = notification.payload;

  // Fetch the submission to get message and channel IDs
  const submission = await getSubmissionById(submission_id);
  if (!submission) {
    throw new Error(`Submission ${submission_id} not found`);
  }

  if (!submission.discord_message_id) {
    console.log(`[EditSubmission] No discord_message_id for ${submission_id}, skipping`);
    return;
  }

  if (!submission.discord_channel_id) {
    console.log(`[EditSubmission] No discord_channel_id for ${submission_id}, skipping`);
    return;
  }

  // Fetch the Discord channel and message
  const channel = await client.channels.fetch(submission.discord_channel_id);
  if (!channel) {
    throw new Error(`Channel ${submission.discord_channel_id} not found`);
  }

  const message = await channel.messages.fetch(submission.discord_message_id);
  if (!message) {
    throw new Error(`Message ${submission.discord_message_id} not found`);
  }

  // Rebuild embeds with updated status
  const color = STATUS_COLORS[new_status] || STATUS_COLORS.pending;
  const label = STATUS_LABELS[new_status] || new_status;
  const reviewerText = reviewer || 'admin';

  const updatedEmbeds = message.embeds.map((existingEmbed) => {
    const embed = EmbedBuilder.from(existingEmbed).setColor(color);

    // Remove any existing Status field and add the new one
    const fields = (existingEmbed.fields || []).filter((f) => f.name !== 'Status');
    fields.push({
      name: 'Status',
      value: `${new_status === 'approved' ? '\u2713' : '\u2717'} ${label} by ${reviewerText}`,
      inline: false,
    });
    embed.setFields(fields);

    return embed;
  });

  await message.edit({ embeds: updatedEmbeds });
  console.log(`[EditSubmission] Updated embed for submission ${submission_id} → ${new_status}`);
}

module.exports = { handleEditSubmission };
