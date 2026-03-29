require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleMessage } = require('./listeners/messageCreate');
const { handleScheduleMessage } = require('./listeners/scheduleParser');
const { startHealthServer } = require('./health');
const { generateWeeklyReport } = require('./services/weeklyReport');
const { startNotificationPoller } = require('./services/notificationPoller');
const { generateDailyNotifications, cleanupOldNotifications } = require('./services/dailyReminders');
const { handleButtonInteraction } = require('./services/buttonHandler');
const { supabase } = require('./services/supabase');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load slash commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
  // Handle button interactions
  if (interaction.isButton()) {
    try {
      await handleButtonInteraction(interaction);
    } catch (err) {
      console.error('[ButtonHandler] Error:', err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    try {
      const reply = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (replyErr) {
      console.error('Failed to send error reply:', replyErr.message);
    }
  }
});

// Handle messages (hub URL detection + schedule parsing)
client.on('messageCreate', async (message) => {
  await handleMessage(message);
  await handleScheduleMessage(message);
});

// Discord client error handlers
client.on('error', (error) => {
  console.error('[Discord Client Error]:', error);
});

client.on('warn', (warning) => {
  console.warn('[Discord Warning]:', warning);
});

client.on('shardError', (error) => {
  console.error('[Shard Error]:', error);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`[Shard ${id}] Disconnected (code: ${event.code})`);
});

client.on('shardReconnecting', (id) => {
  console.log(`[Shard ${id}] Reconnecting...`);
});

client.on('shardResume', (id, replayed) => {
  console.log(`[Shard ${id}] Resumed (${replayed} events replayed)`);
});

// Prevent unhandled errors from crashing the bot
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]:', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
  // Don't exit immediately - log and continue
});

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await client.destroy();
    console.log('Discord client destroyed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.once('clientReady', () => {
  console.log(`✅ QWICKY Bot online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} guilds`);

  // Start health check server (Railway requires an HTTP server)
  const PORT = process.env.PORT || 3000;
  startHealthServer(client, PORT);

  // Start notification queue poller (processes outbound Discord messages)
  startNotificationPoller(client, 30000);

  // Weekly activity report scheduler — runs every Monday at 10:00 UTC
  let lastReportDate = null;

  setInterval(async () => {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const today = now.toISOString().split('T')[0];

    // Only fire on Monday at 10:00 UTC, and only once per day
    if (day !== 1 || hour !== 10 || minute !== 0) return;
    if (lastReportDate === today) return;
    lastReportDate = today;

    console.log('[WeeklyReport] Generating weekly reports...');

    try {
      // Get all registered channels
      const { data: channels, error } = await supabase
        .from('tournament_channels')
        .select('*');

      if (error) {
        console.error('[WeeklyReport] Error fetching channels:', error);
        return;
      }

      if (!channels || channels.length === 0) {
        console.log('[WeeklyReport] No registered channels, skipping.');
        return;
      }

      // Group channels by tournament_id
      const byTournament = {};
      for (const ch of channels) {
        if (!byTournament[ch.tournament_id]) {
          byTournament[ch.tournament_id] = [];
        }
        byTournament[ch.tournament_id].push(ch.discord_channel_id);
      }

      // Generate and post report for each tournament
      for (const [tournamentId, channelIds] of Object.entries(byTournament)) {
        try {
          const { embed } = await generateWeeklyReport(tournamentId);

          for (const channelId of channelIds) {
            try {
              const channel = await client.channels.fetch(channelId);
              if (channel) {
                await channel.send({ embeds: [embed] });
              }
            } catch (sendErr) {
              console.error(`[WeeklyReport] Failed to send to channel ${channelId}:`, sendErr.message);
            }
          }
        } catch (reportErr) {
          console.error(`[WeeklyReport] Failed to generate report for ${tournamentId}:`, reportErr.message);
        }
      }

      console.log('[WeeklyReport] Weekly reports complete.');
    } catch (err) {
      console.error('[WeeklyReport] Unexpected error:', err);
    }
  }, 60 * 1000); // Check every 60 seconds

  // Daily reminder scheduler — runs every day at 09:00 UTC
  let lastReminderDate = null;

  setInterval(async () => {
    const now = new Date();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const today = now.toISOString().split('T')[0];

    if (hour !== 9 || minute !== 0) return;
    if (lastReminderDate === today) return;
    lastReminderDate = today;

    console.log('[DailyReminders] Running daily notifications...');
    try {
      await generateDailyNotifications(today);
      await cleanupOldNotifications();
      console.log('[DailyReminders] Daily notifications complete.');
    } catch (err) {
      console.error('[DailyReminders] Unexpected error:', err);
    }
  }, 60 * 1000); // Check every 60 seconds
});

// Login to Discord
console.log('🔄 Logging in to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});
