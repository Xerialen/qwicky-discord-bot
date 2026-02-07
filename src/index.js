require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleMessage } = require('./listeners/messageCreate');

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

// Prevent unhandled errors from crashing the bot
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

client.once('clientReady', () => {
  console.log(`QWICKY Bot online as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
