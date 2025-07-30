const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const EventStorage = require('../utils/eventStorage');
const PermissionManager = require('../utils/permissions');

// Map event categories to readable labels for reuse in messages
const categoryLabels = {
  guildwars: 'Guild Wars',
  public: 'Public VFS',
  guild: 'Guild VFS',
  both: 'Public + Guild VFS'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete events from storage (Admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('event')
        .setDescription('Delete a specific event')
        .addStringOption(option =>
          option.setName('event')
            .setDescription('Select an event to delete')
            .setRequired(true)
            .setAutocomplete(true))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Delete all events')
    ),

  async execute(interaction) {
    try {
      // Add timeout protection by racing the command execution with a short timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), 5000);
      });
      const executePromise = this.executeCommand(interaction);
      await Promise.race([executePromise, timeoutPromise]);
    } catch (error) {
      console.error('Error executing delete command:', error);
      // If the command failed or timed out, send an ephemeral error reply
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Command timed out or failed. Please try again.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Command timed out or failed. Please try again.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Failed to send error response for delete command:', replyError);
      }
    }
  },

  async executeCommand(interaction) {
    const permissionManager = new PermissionManager();
    // Check admin permissions
    if (!permissionManager.hasAdminPermissions(interaction)) {
      await permissionManager.sendPermissionError(interaction);
      return;
    }

    // Defer reply as ephemeral to prevent timeout while processing (only visible to the admin)
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const eventStorage = new EventStorage();

    if (subcommand === 'all') {
      const allEvents = eventStorage.getAllEvents();
      const eventCount = Object.keys(allEvents).length;

      if (eventCount === 0) {
        return interaction.editReply({
          content: '❌ No events found to delete.'
        });
      }

      // Create confirmation buttons for deleting all events
      const confirmButton = new ButtonBuilder()
        .setCustomId('delete_all_confirm')
        .setLabel(`Delete All ${eventCount} Events`)
        .setStyle(ButtonStyle.Danger);
      const cancelButton = new ButtonBuilder()
        .setCustomId('delete_all_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        content: `⚠️ **Warning:** This will permanently delete all ${eventCount} events from storage. This action cannot be undone.`,
        components: [row]
      });

    } else if (subcommand === 'event') {
      const eventId = interaction.options.getString('event');
      const eventData = eventStorage.getEvent(eventId);

      if (!eventData) {
        return interaction.editReply({
          content: '❌ Event not found or has already been deleted.'
        });
      }

      // Determine readable category label for the event
      const categoryLabel = categoryLabels[eventData.category] || 'Guild VFS';

      // Create confirmation buttons for deleting a specific event
      const confirmButton = new ButtonBuilder()
        .setCustomId(`delete_event_confirm_${eventId}`)
        .setLabel('Delete Event')
        .setStyle(ButtonStyle.Danger);
      const cancelButton = new ButtonBuilder()
        .setCustomId('delete_event_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.editReply({
        content: `⚠️ **Confirm Deletion**\n\nAre you sure you want to delete:\n**[${categoryLabel}] ${eventData.title}**\n\nThis action cannot be undone.`,
        components: [row]
      });
    }
  },

  async autocomplete(interaction) {
    try {
      // Timeout protection for autocomplete
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Autocomplete timeout')), 5000);
      });
      const autocompletePromise = this.executeAutocomplete(interaction);
      await Promise.race([autocompletePromise, timeoutPromise]);
    } catch (error) {
      console.error('Error in delete autocomplete:', error);
      // On error, respond with an empty choices array to gracefully handle the failure
      try {
        if (!interaction.responded) {
          await interaction.respond([]);
        }
      } catch (respondError) {
        console.error('Failed to respond to autocomplete:', respondError);
      }
    }
  },

  async executeAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const eventStorage = new EventStorage();
    const allEvents = eventStorage.getAllEvents();

    const eventEntries = Object.entries(allEvents);
    // Build a list of up to 25 upcoming events for autocomplete suggestions
    const choices = eventEntries.slice(0, 25).map(([eventId, eventData]) => {
      try {
        const eventTime = new Date(eventData.timestamp * 1000);
        // Determine category label for display in suggestion
        const categoryLabel = categoryLabels[eventData.category] || 'Guild VFS';
        // Format event date for display
        const dateStr = eventTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        // Indicate if event is in the past
        const isPast = eventTime < new Date();
        const statusText = isPast ? ' (Past)' : '';

        return {
          name: `[${categoryLabel}] ${eventData.title}${statusText} - ${dateStr}`,
          value: eventId
        };
      } catch (error) {
        console.error(`Error processing event ${eventId}:`, error);
        return {
          name: `Error loading event: ${eventData.title || 'Unknown'}`,
          value: eventId
        };
      }
    });

    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().includes(focusedValue.toLowerCase())
    );

    await interaction.respond(
      filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.value }))
    );
  },

  async handleSelectMenu(interaction) {
    // Prevent handling if already responded (to avoid duplicate processing)
    if (interaction.replied || interaction.deferred) {
      console.log('Interaction already handled, skipping.');
      return;
    }

    if (interaction.customId === 'delete_event_select') {
      const eventId = interaction.values[0];
      const eventStorage = new EventStorage();
      const eventData = eventStorage.getEvent(eventId);

      if (!eventData) {
        return interaction.update({
          content: '❌ Event not found or has already been deleted.',
          components: []
        });
      }

      const categoryLabel = categoryLabels[eventData.category] || 'Guild VFS';
      // Create confirmation buttons for the selected event
      const confirmButton = new ButtonBuilder()
        .setCustomId(`delete_event_confirm_${eventId}`)
        .setLabel('Delete Event')
        .setStyle(ButtonStyle.Danger);
      const cancelButton = new ButtonBuilder()
        .setCustomId('delete_event_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.update({
        content: `⚠️ **Confirm Deletion**\n\nAre you sure you want to delete:\n**[${categoryLabel}] ${eventData.title}**\n\nThis action cannot be undone.`,
        components: [row]
      });
    }
  },

  async handleButton(interaction) {
    try {
      // Timeout protection for button interactions
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Button timeout')), 10000);
      });
      const buttonPromise = this.executeButton(interaction);
      await Promise.race([buttonPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error handling delete button:', error);
      // If the button interaction failed or timed out, update the message to show error and remove components
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.update({
            content: '❌ Button interaction timed out or failed. Please try again.',
            components: []
          });
        } catch (updateError) {
          console.error('Could not respond to interaction (likely expired):', updateError.message);
        }
      }
    }
  },

  async executeButton(interaction) {
    // Ignore if already handled
    if (interaction.replied || interaction.deferred) {
      console.log('Interaction already handled, skipping...');
      return;
    }

    // Immediately acknowledge the interaction to prevent timeout
    await interaction.deferUpdate();

    const eventStorage = new EventStorage();

    if (interaction.customId === 'delete_all_confirm') {
      const allEvents = eventStorage.getAllEvents();
      const eventCount = Object.keys(allEvents).length;

      // Purge all events from storage first (bypass potential Discord message deletion errors)
      eventStorage.events = {};
      eventStorage.saveEvents();

      // Attempt to delete all associated Discord messages (don't fail if they were already deleted)
      let deletedMessages = 0;
      let failedMessages = 0;
      for (const [eventId, eventData] of Object.entries(allEvents)) {
        try {
          const channel = await interaction.client.channels.fetch(eventData.channelId);
          // Delete the original event message if possible
          try {
            const msg = await channel.messages.fetch(eventId);
            await msg.delete();
            deletedMessages++;
            console.log(`Deleted original event message ${eventId} for: ${eventData.title}`);
          } catch (error) {
            failedMessages++;
            console.log(`Could not delete original event message ${eventId} (likely already deleted): ${error.message}`);
          }
          // Delete any reminder messages for this event
          if (eventData.reminderMessageIds && eventData.reminderMessageIds.length > 0) {
            for (const reminderMessageId of eventData.reminderMessageIds) {
              try {
                const reminderMsg = await channel.messages.fetch(reminderMessageId);
                await reminderMsg.delete();
                deletedMessages++;
                console.log(`Deleted reminder message ${reminderMessageId} for event: ${eventData.title}`);
              } catch (error) {
                failedMessages++;
                console.log(`Could not delete reminder message ${reminderMessageId} (likely already deleted): ${error.message}`);
              }
            }
          }
        } catch (error) {
          failedMessages++;
          console.log(`Could not access channel ${eventData.channelId} (likely deleted or no access): ${error.message}`);
        }
      }

      const statusMessage = (deletedMessages > 0 || failedMessages > 0)
        ? `\n\nDiscord cleanup: ${deletedMessages} messages deleted, ${failedMessages} messages not found/already deleted.`
        : '';

      await interaction.editReply({
        content: `✅ **Force purged all ${eventCount} events from storage.**${statusMessage}\n\nAll events have been completely removed regardless of Discord message status.`,
        components: []
      });

    } else if (interaction.customId === 'delete_all_cancel') {
      await interaction.editReply({
        content: '❌ Deletion cancelled. No events were deleted.',
        components: []
      });

    } else if (interaction.customId.startsWith('delete_event_confirm_')) {
      const eventId = interaction.customId.replace('delete_event_confirm_', '');
      const eventData = eventStorage.getEvent(eventId);

      if (!eventData) {
        return interaction.editReply({
          content: '❌ Event not found or has already been deleted.',
          components: []
        });
      }

      const categoryLabel = categoryLabels[eventData.category] || 'Guild VFS';

      // Remove the event from storage before attempting to delete Discord messages
      eventStorage.removeEvent(eventId);

      // Attempt to delete the event's Discord messages (if they exist)
      let deletedMessages = 0;
      let failedMessages = 0;
      try {
        const channel = await interaction.client.channels.fetch(eventData.channelId);
        // Delete the original event announcement message
        try {
          const msg = await channel.messages.fetch(eventId);
          await msg.delete();
          deletedMessages++;
          console.log(`Deleted original event message ${eventId} for: ${eventData.title}`);
        } catch (error) {
          failedMessages++;
          console.log(`Could not delete original event message ${eventId} (likely already deleted): ${error.message}`);
        }
        // Delete any reminder messages for this event
        if (eventData.reminderMessageIds && eventData.reminderMessageIds.length > 0) {
          for (const reminderMessageId of eventData.reminderMessageIds) {
            try {
              const rMsg = await channel.messages.fetch(reminderMessageId);
              await rMsg.delete();
              deletedMessages++;
              console.log(`Deleted reminder message ${reminderMessageId} for event: ${eventData.title}`);
            } catch (error) {
              failedMessages++;
              console.log(`Could not delete reminder message ${reminderMessageId} (likely already deleted): ${error.message}`);
            }
          }
        }
      } catch (error) {
        failedMessages++;
        console.log(`Could not access channel for reminder cleanup (likely deleted or no access): ${error.message}`);
      }

      const statusMessage = (deletedMessages > 0 || failedMessages > 0)
        ? `\n\nDiscord cleanup: ${deletedMessages} messages deleted, ${failedMessages} messages not found/already deleted.`
        : '';

      await interaction.editReply({
        content: `✅ **Force deleted event: [${categoryLabel}] ${eventData.title}**${statusMessage}\n\nEvent has been completely removed from storage regardless of Discord message status.`,
        components: []
      });

    } else if (interaction.customId === 'delete_event_cancel') {
      await interaction.editReply({
        content: '❌ Deletion cancelled. No events were deleted.',
        components: []
      });
    }
  }
};
