const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { unregisterChannel, getChannelRegistration } = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unregister')
    .setDescription('Unlink this channel from its QWICKY tournament')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      const reg = await getChannelRegistration(interaction.channelId);
      if (!reg) {
        return interaction.reply({
          content: 'This channel is not linked to any tournament.',
          ephemeral: true,
        });
      }

      await unregisterChannel(interaction.channelId);
      await interaction.reply({
        content: `Channel unlinked from tournament **${reg.tournament_id}**. Hub URLs will no longer be tracked here.`,
      });
    } catch (err) {
      console.error('Unregister error:', err);
      await interaction.reply({
        content: 'Failed to unregister channel. Check bot logs.',
        ephemeral: true,
      });
    }
  },
};
