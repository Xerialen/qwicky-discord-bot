const { supabase } = require('./supabase');

// Custom ID format: "qwicky:{action}:{entityId}"
async function handleButtonInteraction(interaction) {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'qwicky' || parts.length < 3) return;

  const action = parts[1];
  const entityId = parts.slice(2).join(':'); // rejoin in case ID has colons

  // Require ManageChannels permission
  if (!interaction.memberPermissions?.has('ManageChannels')) {
    return interaction.reply({ content: 'Only admins can do this.', ephemeral: true });
  }

  await interaction.deferUpdate();

  try {
    switch (action) {
      case 'approve':
        await handleApproveButton(interaction, entityId);
        break;
      case 'reject':
        await handleRejectButton(interaction, entityId);
        break;
      case 'confirm-schedule':
        await handleConfirmSchedule(interaction, entityId);
        break;
      case 'cancel-schedule':
        await handleCancelSchedule(interaction);
        break;
      default:
        console.warn(`[ButtonHandler] Unknown action: ${action}`);
        break;
    }
  } catch (err) {
    console.error(`[ButtonHandler] Error handling ${action}:`, err.message);
    try {
      await interaction.followUp({ content: `Error: ${err.message}`, ephemeral: true });
    } catch {
      /* followUp may fail if interaction already replied */
    }
  }
}

async function handleApproveButton(interaction, gameId) {
  // Find the pending submission for this game
  const { data: submission, error } = await supabase
    .from('match_submissions')
    .select('id, status, tournament_id, discord_channel_id')
    .eq('game_id', gameId)
    .in('status', ['pending', 'flagged'])
    .single();

  if (error || !submission) {
    return interaction.followUp({
      content: `No pending submission found for game ${gameId}.`,
      ephemeral: true,
    });
  }

  // Approve it
  const { error: updateErr } = await supabase
    .from('match_submissions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', submission.id);

  if (updateErr) throw updateErr;

  // Update the embed — rebuild with green color and approved status
  const message = interaction.message;
  const { EmbedBuilder } = require('discord.js');
  const updatedEmbeds = message.embeds.map((e) => {
    const embed = EmbedBuilder.from(e).setColor(0x00c853);
    const fields = (e.fields || []).filter((f) => f.name !== 'Status');
    fields.push({
      name: 'Status',
      value: `\u2713 Approved by ${interaction.user.displayName || interaction.user.username}`,
      inline: false,
    });
    return embed.setFields(fields);
  });

  // Remove buttons after action
  await message.edit({ embeds: updatedEmbeds, components: [] });
  console.log(`[ButtonHandler] Approved game ${gameId} by ${interaction.user.username}`);
}

async function handleRejectButton(interaction, gameId) {
  const { data: submission, error } = await supabase
    .from('match_submissions')
    .select('id, status')
    .eq('game_id', gameId)
    .in('status', ['pending', 'flagged'])
    .single();

  if (error || !submission) {
    return interaction.followUp({
      content: `No pending submission found for game ${gameId}.`,
      ephemeral: true,
    });
  }

  const { error: updateErr } = await supabase
    .from('match_submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', submission.id);

  if (updateErr) throw updateErr;

  const message = interaction.message;
  const { EmbedBuilder } = require('discord.js');
  const updatedEmbeds = message.embeds.map((e) => {
    const embed = EmbedBuilder.from(e).setColor(0xff3366);
    const fields = (e.fields || []).filter((f) => f.name !== 'Status');
    fields.push({
      name: 'Status',
      value: `\u2717 Rejected by ${interaction.user.displayName || interaction.user.username}`,
      inline: false,
    });
    return embed.setFields(fields);
  });

  await message.edit({ embeds: updatedEmbeds, components: [] });
  console.log(`[ButtonHandler] Rejected game ${gameId} by ${interaction.user.username}`);
}

async function handleConfirmSchedule(interaction, payload) {
  // payload format: "matchId|date|time"
  const [matchId, date, time] = payload.split('|');

  const updates = { match_date: date };
  if (time) updates.match_time = time;

  const { error } = await supabase.from('matches').update(updates).eq('id', matchId);

  if (error) throw error;

  const { EmbedBuilder } = require('discord.js');
  const message = interaction.message;
  const updatedEmbeds = message.embeds.map((e) => {
    const embed = EmbedBuilder.from(e).setColor(0x00c853).setTitle('Match Scheduled');
    const fields = (e.fields || []).filter((f) => f.name !== 'Current date');
    fields.push({
      name: 'Confirmed by',
      value: interaction.user.displayName || interaction.user.username,
      inline: true,
    });
    return embed.setFields(fields);
  });

  await message.edit({ embeds: updatedEmbeds, components: [] });
  console.log(
    `[ButtonHandler] Scheduled match ${matchId} for ${date} ${time || ''} by ${interaction.user.username}`
  );
}

async function handleCancelSchedule(interaction) {
  const { EmbedBuilder } = require('discord.js');
  const message = interaction.message;
  const updatedEmbeds = message.embeds.map((e) =>
    EmbedBuilder.from(e).setColor(0x808080).setTitle('Schedule Request Cancelled')
  );
  await message.edit({ embeds: updatedEmbeds, components: [] });
}

module.exports = { handleButtonInteraction };
