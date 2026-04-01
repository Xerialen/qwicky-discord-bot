const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const DEFAULT_CHANNEL_ID = '1467942158135853218';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post a plain-text message to a channel')
    .addStringOption((option) =>
      option.setName('message').setDescription('The message to post').setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Target channel (defaults to #qwicky)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel');

    const channelId = targetChannel ? targetChannel.id : DEFAULT_CHANNEL_ID;

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: `Could not find a text channel with ID ${channelId}.`,
          ephemeral: true,
        });
      }

      await channel.send({ content: message, allowedMentions: { parse: [] } });

      await interaction.reply({
        content: `Message posted to <#${channelId}>.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('[Announce] Error:', err);
      await interaction.reply({
        content: 'Failed to send the announcement. Check bot permissions and logs.',
        ephemeral: true,
      });
    }
  },
};
