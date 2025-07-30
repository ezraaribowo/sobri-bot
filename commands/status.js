const { SlashCommandBuilder, ActivityType } = require('discord.js');
const PermissionManager = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Update the bot's Discord profile status (Admin only)")
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of activity status')
        .addChoices(
          { name: 'Playing', value: 'playing' },
          { name: 'Listening', value: 'listening' },
          { name: 'Watching', value: 'watching' },
          { name: 'Competing', value: 'competing' },
          { name: 'Streaming', value: 'streaming' },
          { name: 'Custom', value: 'custom' }
        )
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Status message to display')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Twitch/YT URL for streaming status (required if type is streaming)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('presence')
        .setDescription("Bot's online presence (e.g., online, idle)")
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' }
        )
        .setRequired(false)),

  async execute(interaction) {
    try {
      const permissionManager = new PermissionManager();
      if (!permissionManager.hasAdminPermissions(interaction)) {
        await permissionManager.sendPermissionError(interaction);
        return;
      }

      const activityType = interaction.options.getString('type');
      const message = interaction.options.getString('message');
      const url = interaction.options.getString('url');
      const presence = interaction.options.getString('presence') || 'online';

      // Map the chosen type string to the corresponding Discord ActivityType
      const activityTypeMap = {
        playing: ActivityType.Playing,
        listening: ActivityType.Listening,
        watching: ActivityType.Watching,
        competing: ActivityType.Competing,
        streaming: ActivityType.Streaming,
        custom: ActivityType.Custom
      };
      const discordActivityType = activityTypeMap[activityType];

      // Build the activity object for the presence
      const activityOptions = { name: message, type: discordActivityType };
      if (activityType === 'streaming') {
        if (url) {
          activityOptions.url = url;
        } else {
          // If streaming and no URL provided, warn and use default
          console.warn('Streaming status selected without a URL; proceeding without URL.');
        }
      }

      // Update the bot's presence on Discord
      await interaction.client.user.setPresence({
        activities: [activityOptions],
        status: presence
      });

      // Construct a friendly status description for confirmation
      let statusText = '';
      switch (activityType) {
        case 'playing':
          statusText = `Playing ${message}`;
          break;
        case 'listening':
          statusText = `Listening to ${message}`;
          break;
        case 'watching':
          statusText = `Watching ${message}`;
          break;
        case 'competing':
          statusText = `Competing in ${message}`;
          break;
        case 'streaming':
          statusText = `Streaming ${message}` + (url ? ` (${url})` : '');
          break;
        case 'custom':
          statusText = message;
          break;
      }
      const presenceText = presence.charAt(0).toUpperCase() + presence.slice(1);

      await interaction.reply({
        content: `✅ Bot status updated successfully!\n\n**Status:** ${presenceText}\n**Activity:** ${statusText}`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Error updating bot status:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Failed to update bot status. Please try again.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Failed to update bot status. Please try again.',
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Failed to send error response for status command:', err);
      }
    }
  }
};
