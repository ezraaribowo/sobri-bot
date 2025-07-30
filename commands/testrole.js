const { SlashCommandBuilder } = require('discord.js');
const RoleConfigManager = require('../utils/roleConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('testrole')
    .setDescription('Test role mentions'),

  async execute(interaction) {
    const roleConfig = new RoleConfigManager();
    
    const vfsMention = roleConfig.getVfsRoleMention();
    const gvgMention = roleConfig.getGvgRoleMention();
    
    await interaction.reply({
      content: `VFS Role: ${vfsMention || 'Not set'}\nGVG Role: ${gvgMention || 'Not set'}`,
      ephemeral: true
    });
  }
}; 