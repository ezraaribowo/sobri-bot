module.exports = {
  data: { name: 'deleteReminder' },
  async execute() {
    // This command is only for button handling, not slash commands.
  },
  async handleButton(interaction) {
    try {
      await interaction.message.delete(); // remove the reminder
    } catch {
      // ignore if the message is already gone
    }
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
  }
};