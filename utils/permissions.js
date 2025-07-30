require('dotenv').config();

/**
 * Utility class for handling admin permissions
 */
class PermissionManager {
  constructor() {
    // Load admin user IDs from environment variable
    this.adminUserIds = process.env.ADMIN_USER_IDS
      ? process.env.ADMIN_USER_IDS.split(',').map(id => id.trim())
      : [];
  }

  /**
   * Check if a user is an admin (listed in the env config)
   * @param {string} userId - Discord user ID
   * @returns {boolean} True if user is admin
   */
  isAdmin(userId) {
    return this.adminUserIds.includes(userId);
  }

  /**
   * Check if a user has admin permissions for a given interaction
   * @param {import('discord.js').Interaction} interaction - Discord interaction
   * @returns {boolean} True if user has admin permissions
   */
  hasAdminPermissions(interaction) {
    const userId = interaction.user.id;
    // Check if user is explicitly in the admin list
    if (this.isAdmin(userId)) return true;
    // Or if the user has the Administrator permission in the guild
    if (interaction.member && interaction.member.permissions.has('Administrator')) {
      return true;
    }
    return false;
  }

  /**
   * Send an ephemeral error message for insufficient permissions
   * @param {import('discord.js').Interaction} interaction - Discord interaction
   */
  async sendPermissionError(interaction) {
    try {
      await interaction.reply({
        content: '❌ You do not have permission to use this command. This command is restricted to administrators only.',
        ephemeral: true
      });
    } catch (error) {
      console.error('Could not send permission error message:', error);
    }
  }

  /**
   * (Optional utility) Enforce admin requirement before executing a command
   * @param {import('discord.js').Interaction} interaction
   * @param {Function} executeFunction - The command execute function to run if permitted
   */
  async requireAdmin(interaction, executeFunction) {
    if (!this.hasAdminPermissions(interaction)) {
      await this.sendPermissionError(interaction);
      return;
    }
    // User has admin permissions, proceed with the command
    await executeFunction(interaction);
  }

  /** Get a copy of the admin user ID list */
  getAdminUserIds() {
    return [...this.adminUserIds];
  }

  /** Add a new admin user ID */
  addAdmin(userId) {
    if (!this.adminUserIds.includes(userId)) {
      this.adminUserIds.push(userId);
    }
  }

  /** Remove an admin user ID */
  removeAdmin(userId) {
    const index = this.adminUserIds.indexOf(userId);
    if (index > -1) {
      this.adminUserIds.splice(index, 1);
    }
  }
}

module.exports = PermissionManager;
