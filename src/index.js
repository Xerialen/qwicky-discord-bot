require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleMessage } = require('./listeners/messageCreate');
const { startHealthServer } = require('./health');

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

// Handle messages (hub URL detection)
client.on('messageCreate', handleMessage);

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
});

// Login to Discord
console.log('🔄 Logging in to Discord...');
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});
