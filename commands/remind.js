const { SlashCommandBuilder } = require('discord.js');
const EventStorage = require('../utils/eventStorage');
const PermissionManager = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Send a manual reminder for an event (Admin only)')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Select an event to remind about')
        .setRequired(true)
        .setAutocomplete(true))
    .addBooleanOption(option =>
      option.setName('include_attendees')
        .setDescription('Include current attendee list in the reminder')
        .setRequired(false)),

  async execute(interaction) {
    const permissionManager = new PermissionManager();
    // Check admin permissions
    if (!permissionManager.hasAdminPermissions(interaction)) {
      await permissionManager.sendPermissionError(interaction);
      return;
    }

    const eventId = interaction.options.getString('event');
    const includeAttendees = interaction.options.getBoolean('include_attendees') || false;
    const eventStorage = new EventStorage();
    const eventData = eventStorage.getEvent(eventId);

    if (!eventData) {
      // Event not found in storage (may have been deleted)
      return interaction.reply({
        content: '❌ Event not found or has been deleted.',
        ephemeral: true
      });
    }

    try {
      // Defer the reply to give time for sending reminders (ephemeral since it's admin-only feedback)
      await interaction.deferReply({ ephemeral: true });

      // If requested, gather current attendee status from the event message
      let attendees = null;
      if (includeAttendees) {
        try {
          const channel = await interaction.client.channels.fetch(eventData.channelId);
          const message = await channel.messages.fetch(eventId);
          // Extract current attendees from the event message's reactions
          attendees = await this.extractAttendeesFromMessage(message);
        } catch (error) {
          console.error('Error fetching attendees for reminder:', error);
          // If we fail to fetch the message or reactions, proceed without attendee details
          attendees = null;
        }
      }

      // Send the manual reminder via the ReminderScheduler utility
      const reminderScheduler = interaction.client.reminderScheduler;
      const success = await reminderScheduler.sendManualReminder(
        interaction.channelId,
        eventData,
        attendees,
        eventId
      );

      if (success) {
        // Confirmation message to admin (ephemeral)
        await interaction.editReply({
          content: '✅ Reminder sent successfully!'
        });
      } else {
        await interaction.editReply({
          content: '❌ Failed to send reminder. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error sending manual reminder:', error);
      // Inform the admin that the reminder failed
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ An error occurred while sending the reminder.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ An error occurred while sending the reminder.',
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('Failed to send error response for remind command:', replyError);
      }
    }
  },

  async autocomplete(interaction) {
    try {
      const focusedValue = interaction.options.getFocused();
      const eventStorage = new EventStorage();
      const allEvents = eventStorage.getAllEvents();
      const now = new Date();
      // Only suggest events that are in the future
      const futureEvents = Object.entries(allEvents).filter(([id, data]) => {
        try {
          return new Date(data.timestamp * 1000) > now;
        } catch {
          return false;
        }
      });

      // Build choices (up to 25) for autocomplete suggestions
      const choices = futureEvents.slice(0, 25).map(([eventId, eventData]) => {
        try {
          const eventTime = new Date(eventData.timestamp * 1000);
          // Determine category label for display
          let categoryLabel;
          if (eventData.category === 'guildwars') {
            categoryLabel = 'Guild Wars';
          } else if (eventData.category === 'both') {
            categoryLabel = 'Public + Guild VFS';
          } else if (eventData.category === 'public') {
            categoryLabel = 'Public VFS';
          } else {
            categoryLabel = 'Guild VFS';
          }
          // Format event time for suggestion text
          const dateStr = eventTime.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          return {
            name: `[${categoryLabel}] ${eventData.title} - ${dateStr}`,
            value: eventId
          };
        } catch (error) {
          console.error(`Error processing event ${eventId} for autocomplete:`, error);
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
    } catch (error) {
      console.error('Error in remind autocomplete:', error);
      // On error, return no suggestions to avoid interaction timeout
      try {
        await interaction.respond([]);
      } catch (err) {
        console.error('Failed to respond with empty autocomplete suggestions:', err);
      }
    }
  },

  async handleSelectMenu(interaction) {
    // Custom ID format: remind_select_includeAttendees_true/false
    const [, , includeAttendeesStr] = interaction.customId.split('_');
    const includeAttendees = includeAttendeesStr === 'true';
    const eventId = interaction.values[0];

    const eventStorage = new EventStorage();
    const eventData = eventStorage.getEvent(eventId);

    if (!eventData) {
      return interaction.update({
        content: '❌ Event not found or has been deleted.',
        components: [],
        ephemeral: true
      });
    }

    try {
      // If requested, fetch current attendees from the event message
      let attendees = null;
      if (includeAttendees) {
        try {
          const channel = await interaction.client.channels.fetch(eventData.channelId);
          const message = await channel.messages.fetch(eventId);
          attendees = await this.extractAttendeesFromMessage(message);
        } catch (error) {
          console.error('Error fetching attendees for manual reminder select:', error);
          attendees = null;
        }
      }

      // Send the manual reminder using ReminderScheduler
      const reminderScheduler = interaction.client.reminderScheduler;
      const success = await reminderScheduler.sendManualReminder(
        interaction.channelId,
        eventData,
        attendees,
        eventId
      );

      if (success) {
        await interaction.update({
          content: '✅ Reminder sent successfully!',
          components: [],
          ephemeral: true
        });
      } else {
        await interaction.update({
          content: '❌ Failed to send reminder. Please try again.',
          components: [],
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error sending manual reminder (select menu):', error);
      try {
        await interaction.update({
          content: '❌ An error occurred while sending the reminder.',
          components: [],
          ephemeral: true
        });
      } catch (updateError) {
        console.error('Failed to send error response for reminder select:', updateError);
      }
    }
  },

  async extractAttendeesFromMessage(message) {
    // Determine if this is a Guild Wars (Yes/Maybe/No) event or a VFS (Tank/DPS/Support) event
    const hasVfsReactions = message.reactions.cache.has('🛡️') || message.reactions.cache.has('⚔️') || message.reactions.cache.has('💖');
    const hasGvgReactions = message.reactions.cache.has('✅') || message.reactions.cache.has('❓') || message.reactions.cache.has('❌');

    if (hasGvgReactions) {
      // Guild Wars event – collect Yes/Maybe/No attendees
      const attendees = { yes: new Set(), maybe: new Set(), no: new Set() };
      try {
        const yesReaction = message.reactions.cache.get('✅');
        const maybeReaction = message.reactions.cache.get('❓');
        const noReaction = message.reactions.cache.get('❌');
        if (yesReaction) {
          const users = await yesReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.yes.add(`<@${user.id}>`);
          });
        }
        if (maybeReaction) {
          const users = await maybeReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.maybe.add(`<@${user.id}>`);
          });
        }
        if (noReaction) {
          const users = await noReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.no.add(`<@${user.id}>`);
            // We ignore "No" responses when sending personal reminders, but still collect them here if needed
          });
        }
      } catch (error) {
        console.error('Error extracting Guild Wars attendees:', error);
      }
      return attendees;
    } else {
      // VFS event – collect Tank/DPS/Support attendees
      const attendees = { tank: new Set(), dps: new Set(), support: new Set() };
      try {
        const tankReaction = message.reactions.cache.get('🛡️');
        const dpsReaction = message.reactions.cache.get('⚔️');
        const supportReaction = message.reactions.cache.get('💖');
        if (tankReaction) {
          const users = await tankReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.tank.add(`<@${user.id}>`);
          });
        }
        if (dpsReaction) {
          const users = await dpsReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.dps.add(`<@${user.id}>`);
          });
        }
        if (supportReaction) {
          const users = await supportReaction.users.fetch();
          users.forEach(user => {
            if (!user.bot) attendees.support.add(`<@${user.id}>`);
          });
        }
      } catch (error) {
        console.error('Error extracting VFS attendees:', error);
      }
      return attendees;
    }
  }
};
