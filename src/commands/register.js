const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { registerChannel } = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link this channel to a QWICKY tournament')
    .addStringOption(option =>
      option.setName('tournament-id')
        .setDescription('The QWICKY tournament ID')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('division-id')
        .setDescription('Optionally scope to a specific division')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const tournamentId = interaction.options.getString('tournament-id');
    const divisionId = interaction.options.getString('division-id');

    try {
      await registerChannel({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        tournamentId,
        divisionId,
        registeredBy: interaction.user.id,
      });

      const scope = divisionId ? ` (division: ${divisionId})` : '';
      await interaction.reply({
        content: `This channel is now linked to tournament **${tournamentId}**${scope}.\nHub URLs posted here will be tracked as match submissions.`,
      });
    } catch (err) {
      console.error('Register error:', err);
      await interaction.reply({
        content: 'Failed to register channel. Check bot logs.',
        ephemeral: true,
      });
    }
  },
};
