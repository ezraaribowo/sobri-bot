require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is required in .env file');
  process.exit(1);
}
if (!process.env.CLIENT_ID) {
  console.error('Error: CLIENT_ID is required in .env file');
  process.exit(1);
}

// Determine the command directory or fall back to the project root.
let commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  commandsPath = __dirname;
  console.warn(
    '[deploy-commands] Commands directory not found; falling back to project root for command discovery.'
  );
}

// Discover all JavaScript files within the chosen directory.
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const rawCommands = [];

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.name && typeof command.data.toJSON === 'function') {
      rawCommands.push(command.data.toJSON());
      console.log(`✓ Loaded command: ${command.data.name}`);
    } else {
      console.warn(
        `⚠️ Skipping invalid command file: ${file} (missing data or toJSON method)`
      );
    }
  } catch (err) {
    console.error(`❌ Error loading command file ${file}:`, err.message);
  }
}

// Remove duplicate command names
const uniqueCommands = [];
const seen = new Set();
for (const cmd of rawCommands) {
  if (seen.has(cmd.name)) {
    console.warn(`⚠️ Duplicate command name detected and skipped: "${cmd.name}"`);
  } else {
    seen.add(cmd.name);
    uniqueCommands.push(cmd);
  }
}

if (uniqueCommands.length === 0) {
  console.warn('No valid commands to deploy after deduplication.');
  process.exit(0);
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${uniqueCommands.length} application (/) commands.`);
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: uniqueCommands }
    );
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Failed to deploy commands:', error);
    process.exit(1);
  }
})();
