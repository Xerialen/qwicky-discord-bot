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

module.exports = {
  supabase,
  getChannelRegistration,
  registerChannel,
  unregisterChannel,
  insertSubmission,
};
