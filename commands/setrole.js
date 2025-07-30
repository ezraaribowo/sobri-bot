const { SlashCommandBuilder } = require('discord.js');
const RoleConfigManager = require('../utils/roleConfig');
const PermissionManager = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Configure role mentions for events (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('vfs')
        .setDescription('Set the role to mention for VFS events')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to mention for VFS events')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('gvg')
        .setDescription('Set the role to mention for GvG events')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('The role to mention for GvG events')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current role configuration'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('clear')
        .setDescription('Clear role mentions')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Which role configuration to clear')
            .setRequired(true)
            .addChoices(
              { name: 'VFS Role', value: 'vfs' },
              { name: 'GvG Role', value: 'gvg' },
              { name: 'All Roles', value: 'all' }
            ))),

  async execute(interaction) {
    try {
      const permissionManager = new PermissionManager();
      // Check admin permissions
      if (!permissionManager.hasAdminPermissions(interaction)) {
        await permissionManager.sendPermissionError(interaction);
        return;
      }

      const roleConfig = new RoleConfigManager();
      const subcommand = interaction.options.getSubcommand();
      // Mapping to format role type names for messages
      const typeDisplay = { vfs: 'VFS', gvg: 'GvG' };

      if (subcommand === 'vfs' || subcommand === 'gvg') {
        const role = interaction.options.getRole('role');
        const configMethod = subcommand === 'vfs' ? 'Vfs' : 'Gvg';  // part of method names
        if (role) {
          // Set the specified role for the event type
          roleConfig[`set${configMethod}Role`](role.id);
          await interaction.reply({
            content: `✅ ${typeDisplay[subcommand]} role set to ${role}. This role will be mentioned in all ${typeDisplay[subcommand]} event announcements and reminders.`,
            ephemeral: true
          });
        } else {
          // No role provided, so just display the current configuration
          const currentRoleId = roleConfig[`get${configMethod}Role`]() || null;
          if (currentRoleId) {
            await interaction.reply({
              content: `Current ${typeDisplay[subcommand]} role: <@&${currentRoleId}>\n\nTo change it, use this command with a role option.\nTo clear it, use \`/setrole clear type:${typeDisplay[subcommand]} Role\`.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `No ${typeDisplay[subcommand]} role is currently configured.\n\nTo set one, rerun this command with a role option specified.`,
              ephemeral: true
            });
          }
        }

      } else if (subcommand === 'view') {
        const config = roleConfig.getAllConfig();
        const vfsRole = config.vfsRoleId ? `<@&${config.vfsRoleId}>` : 'Not configured';
        const gvgRole = config.gvgRoleId ? `<@&${config.gvgRoleId}>` : 'Not configured';
        await interaction.reply({
          content: `**Current Role Configuration:**\n\n🛡️ **VFS Events:** ${vfsRole}\n⚔️ **GvG Events:** ${gvgRole}\n\n*These roles will be mentioned when events are created and in reminders.*`,
          ephemeral: true
        });

      } else if (subcommand === 'clear') {
        const type = interaction.options.getString('type');
        if (type === 'vfs' || type === 'gvg') {
          // Clear the specified role configuration
          if (type === 'vfs') roleConfig.clearVfsRole();
          else roleConfig.clearGvgRole();
          await interaction.reply({
            content: `✅ ${typeDisplay[type]} role configuration cleared. ${typeDisplay[type]} events will no longer mention any role.`,
            ephemeral: true
          });
        } else if (type === 'all') {
          // Clear both VFS and GvG roles
          roleConfig.clearVfsRole();
          roleConfig.clearGvgRole();
          await interaction.reply({
            content: '✅ All role configurations cleared. Events will no longer mention any roles.',
            ephemeral: true
          });
        }
      }
    } catch (error) {
      console.error('Error executing setrole command:', error);
      // Send an ephemeral error message if something goes wrong
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Failed to update role configuration. Please try again.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Failed to update role configuration. Please try again.',
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Failed to send error response for setrole command:', err);
      }
    }
  }
};
