const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getChannelRegistration, supabase } = require('../services/supabase');
const { parseDate } = require('../utils/dateParser');
const { normalize } = require('../utils/nameNormalizer');

// Patterns that look like scheduling messages (two teams + a date)
// Skip messages that contain hub URLs (those are submissions, not scheduling)
const HUB_URL = /hub\.quakeworld\.nu/;

async function handleScheduleMessage(message) {
  // Don't process bot messages or hub URL submissions
  if (message.author.bot) return;
  if (HUB_URL.test(message.content)) return;

  // Check channel registration
  const reg = await getChannelRegistration(message.channelId);
  if (!reg) return;

  // Try to parse a date from the message
  const parsed = parseDate(message.content);
  if (!parsed || !parsed.date) return;

  // Fetch teams for this tournament
  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('name, tag')
    .eq('tournament_id', reg.tournament_id);

  if (teamErr || !teams || teams.length < 2) return;

  // Try to find two team references in the message
  const msgLower = message.content.toLowerCase();
  const found = [];

  for (const team of teams) {
    const nameLower = team.name.toLowerCase();
    const tagLower = team.tag.toLowerCase();
    const nameNorm = normalize(team.name);
    const tagNorm = normalize(team.tag);

    // Check if the message contains this team's name or tag
    if (
      (tagLower.length >= 2 && new RegExp(`\\b${escapeRegex(tagLower)}\\b`).test(msgLower)) ||
      msgLower.includes(nameLower) ||
      (nameNorm.length >= 3 && msgLower.includes(nameNorm))
    ) {
      // Avoid duplicates
      if (!found.some(f => f.name === team.name)) {
        found.push(team);
      }
    }
  }

  // Need exactly 2 teams
  if (found.length !== 2) return;

  // Find the scheduled match between these two teams
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, team1, team2, match_date, match_time, round, "group", round_num, division_id')
    .eq('tournament_id', reg.tournament_id)
    .eq('status', 'scheduled');

  if (matchErr || !matches) return;

  // Find a match involving both teams
  const t1 = found[0].name.toLowerCase();
  const t2 = found[1].name.toLowerCase();
  const match = matches.find(m =>
    (m.team1.toLowerCase() === t1 && m.team2.toLowerCase() === t2) ||
    (m.team1.toLowerCase() === t2 && m.team2.toLowerCase() === t1)
  );

  if (!match) return;

  // Build confirmation embed
  const timeStr = parsed.time ? ` at ${parsed.time} ${parsed.tzName}` : '';
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord blurple
    .setTitle('Schedule Match?')
    .setDescription(`**${match.team1}** vs **${match.team2}**`)
    .addFields(
      { name: 'Date', value: parsed.date + timeStr, inline: true },
      { name: 'Round', value: match.group ? `Round ${match.round_num} — Group ${match.group}` : `Round ${match.round_num}`, inline: true },
    )
    .setFooter({ text: `Requested by ${message.author.displayName || message.author.username}` });

  if (match.match_date) {
    embed.addFields({ name: 'Current date', value: match.match_date + (match.match_time ? ` ${match.match_time}` : ''), inline: true });
  }

  // Encode match ID + date into button custom IDs
  const payload = `${match.id}|${parsed.date}|${parsed.time || ''}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`qwicky:confirm-schedule:${payload}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`qwicky:cancel-schedule:${payload}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await message.reply({ embeds: [embed], components: [row] });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { handleScheduleMessage };
