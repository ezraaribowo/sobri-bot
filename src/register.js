// Discord slash command registration for Sobri-Bot
// Registers all commands with Discord API

import { commands } from './commands.js';

export async function registerCommands(env) {
  const url = `https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    method: 'PUT',
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log('Successfully registered commands');
    return true;
  } else {
    console.error('Error registering commands:', await response.text());
    return false;
  }
}

export async function deleteCommands(env) {
  const url = `https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    method: 'PUT',
    body: JSON.stringify([]),
  });

  if (response.ok) {
    console.log('Successfully deleted all commands');
    return true;
  } else {
    console.error('Error deleting commands:', await response.text());
    return false;
  }
} 