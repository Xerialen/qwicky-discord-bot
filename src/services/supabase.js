const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getChannelRegistration(channelId) {
  const { data, error } = await supabase
    .from('tournament_channels')
    .select('*')
    .eq('discord_channel_id', channelId)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

async function registerChannel({ guildId, channelId, tournamentId, divisionId, registeredBy }) {
  const { data, error } = await supabase
    .from('tournament_channels')
    .upsert({
      discord_guild_id: guildId,
      discord_channel_id: channelId,
      tournament_id: tournamentId,
      division_id: divisionId || null,
      registered_by: registeredBy,
    }, { onConflict: 'discord_channel_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function unregisterChannel(channelId) {
  const { error } = await supabase
    .from('tournament_channels')
    .delete()
    .eq('discord_channel_id', channelId);
  if (error) throw error;
}

async function insertSubmission({ tournamentId, divisionId, hubUrl, gameId, gameData, discordUserId, discordUserName, channelId }) {
  const { data, error } = await supabase
    .from('match_submissions')
    .insert({
      tournament_id: tournamentId,
      division_id: divisionId,
      hub_url: hubUrl,
      game_id: gameId,
      game_data: gameData,
      submitted_by_discord_id: discordUserId,
      submitted_by_name: discordUserName,
      discord_channel_id: channelId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = duplicate
    if (error.code === '23505') {
      return { duplicate: true };
    }
    throw error;
  }
  return data;
}

async function updateSubmissionMessageId(submissionId, messageId) {
  const { error } = await supabase
    .from('match_submissions')
    .update({ discord_message_id: messageId })
    .eq('id', submissionId);
  if (error) console.error(`[Supabase] Failed to store message ID for ${submissionId}:`, error.message);
}

async function getSubmissionById(submissionId) {
  const { data, error } = await supabase
    .from('match_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function claimNotifications(batchSize = 10) {
  const { data, error } = await supabase.rpc('claim_notifications', { batch_size: batchSize });
  if (error) throw error;
  return data || [];
}

async function completeNotification(id) {
  const { error } = await supabase
    .from('discord_notifications')
    .update({ status: 'completed', processed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error(`[Supabase] Failed to complete notification ${id}:`, error.message);
}

async function failNotification(id, errorMsg) {
  const { error } = await supabase
    .from('discord_notifications')
    .update({ status: 'failed', error: errorMsg })
    .eq('id', id);
  if (error) console.error(`[Supabase] Failed to mark notification ${id} as failed:`, error.message);
}

module.exports = {
  supabase,
  getChannelRegistration,
  registerChannel,
  unregisterChannel,
  insertSubmission,
  updateSubmissionMessageId,
  getSubmissionById,
  claimNotifications,
  completeNotification,
  failNotification,
};
