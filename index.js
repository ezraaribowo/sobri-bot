require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const chokidar = require('chokidar');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const ReminderScheduler = require('./utils/reminderScheduler');

// Ensure required environment variables are set
if (!process.env.BOT_TOKEN) {
  console.error('BOT_TOKEN is missing from .env');
  process.exit(1);
}

// Create a Discord client with necessary intents and partials.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Collection to store slash commands.
client.commands = new Map();

// Determine where commands are located. Prefer a `commands` folder
// next to this file; otherwise load from the project root.
let commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  commandsPath = __dirname;
  console.warn(
    '[index] Commands directory not found; falling back to project root.'
  );
}

/**
 * Load all command modules from the commands directory.
 */
function loadCommands() {
  if (!fs.existsSync(commandsPath)) return;
  const files = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of files) {
    const full = path.join(commandsPath, file);
    try {
      delete require.cache[require.resolve(full)];
      const command = require(full);
      if (command?.data?.name && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.warn(`Skipping invalid command file: ${file}`);
      }
    } catch (err) {
      console.error(`Error loading command ${file}:`, err);
    }
  }
}
loadCommands();

// Hot-reload command files on change.
chokidar
  .watch(commandsPath, { ignoreInitial: true })
  .on('add', filePath => {
    if (!filePath.endsWith('.js')) return;
    try {
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);
      if (cmd?.data?.name && typeof cmd.execute === 'function') {
        client.commands.set(cmd.data.name, cmd);
        console.log(`Added command: ${cmd.data.name}`);
      }
    } catch (err) {
      console.error(`Failed to load new command ${filePath}:`, err);
    }
  })
  .on('change', filePath => {
    if (!filePath.endsWith('.js')) return;
    try {
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);
      if (cmd?.data?.name && typeof cmd.execute === 'function') {
        client.commands.set(cmd.data.name, cmd);
        console.log(`Reloaded command: ${cmd.data.name}`);
      }
    } catch (err) {
      console.error(`Failed to reload command ${filePath}:`, err);
    }
  })
  .on('unlink', filePath => {
    if (!filePath.endsWith('.js')) return;
    for (const [name, cmd] of client.commands.entries()) {
      const expected = path.join(commandsPath, `${name}.js`);
      try {
        if (require.resolve(expected) === filePath) {
          client.commands.delete(name);
          console.log(`Removed command: ${name}`);
          break;
        }
      } catch {
        /* ignore */
      }
    }
  });

/**
 * Handle interactions: slash commands, autocomplete, select menus, and buttons.
 */
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      // Race the command execution against a timeout to avoid hanging.
      const execPromise = cmd.execute(interaction);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Command timeout')), 10000)
      );
      await Promise.race([execPromise, timeout]);
    } catch (err) {
      console.error(`Error executing ${interaction.commandName}:`, err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ There was an error executing that command.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  } else if (interaction.isAutocomplete()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd || !cmd.autocomplete) return;
    try {
      const resp = cmd.autocomplete(interaction);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Autocomplete timeout')), 5000)
      );
      await Promise.race([resp, timeout]);
    } catch (err) {
      console.error(`Error in autocomplete ${interaction.commandName}:`, err);
      if (!interaction.responded) {
        await interaction.respond([]).catch(() => {});
      }
    }
  } else if (interaction.isStringSelectMenu()) {
    const [action] = interaction.customId.split('_');
    const cmd = client.commands.get(action);
    if (cmd?.handleSelectMenu) {
      try {
        await cmd.handleSelectMenu(interaction);
      } catch (err) {
        console.error(`Error in select menu ${interaction.customId}:`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ There was an error with your selection.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    }
  } else if (interaction.isButton()) {
    const [action] = interaction.customId.split('_');
    const cmd = client.commands.get(action);
    if (cmd?.handleButton) {
      try {
        await cmd.handleButton(interaction);
      } catch (err) {
        console.error(`Error in button ${interaction.customId}:`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ There was an error with that button.',
            ephemeral: true
          }).catch(() => {});
        }
      }
    }
  }
});

// Once the bot is ready, start the reminder scheduler.
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.reminderScheduler = new ReminderScheduler(client);
  client.reminderScheduler.start();
});

// Clean shutdown on SIGINT/SIGTERM
['SIGINT', 'SIGTERM'].forEach(signal =>
  process.on(signal, () => {
    console.log('Shutting down...');
    client.reminderScheduler?.stop();
    client.destroy();
    process.exit(0);
  })
);

// Log in
client.login(process.env.BOT_TOKEN);
