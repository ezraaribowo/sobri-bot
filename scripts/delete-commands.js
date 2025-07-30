// Script to delete Discord slash commands
// Use this if you need to remove all commands

import { deleteCommands } from '../src/register.js';

// Environment variables (you'll need to set these)
const env = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID
};

if (!env.DISCORD_TOKEN || !env.DISCORD_APPLICATION_ID) {
  console.error('❌ Missing required environment variables:');
  console.error('   DISCORD_TOKEN - Your bot token');
  console.error('   DISCORD_APPLICATION_ID - Your application ID');
  console.error('');
  console.error('Set these in your .env file or environment variables');
  process.exit(1);
}

console.log('🗑️ Deleting Discord slash commands...');

deleteCommands(env)
  .then(success => {
    if (success) {
      console.log('✅ Commands deleted successfully!');
    } else {
      console.error('❌ Failed to delete commands');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Error deleting commands:', error);
    process.exit(1);
  }); 