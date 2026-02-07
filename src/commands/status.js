const { SlashCommandBuilder } = require('discord.js');
const { getChannelRegistration } = require('../services/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show which QWICKY tournament this channel is linked to'),

  async execute(interaction) {
    try {
      const reg = await getChannelRegistration(interaction.channelId);
      if (!reg) {
        return interaction.reply({
          content: 'This channel is not linked to any tournament.\nUse `/register <tournament-id>` to link it.',
          ephemeral: true,
        });
      }

      const division = reg.division_id ? `\nDivision: **${reg.division_id}**` : '';
      await interaction.reply({
        content: `Tournament: **${reg.tournament_id}**${division}\nRegistered by: <@${reg.registered_by}>\nSince: ${new Date(reg.created_at).toLocaleDateString()}`,
      });
    } catch (err) {
      console.error('Status error:', err);
      await interaction.reply({
        content: 'Failed to fetch status. Check bot logs.',
        ephemeral: true,
      });
    }
  },
};
