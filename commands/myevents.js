const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventStorage = require('../utils/eventStorage');

// Maps for category icons and labels for formatting the event list
const categoryIcons = {
  public: '🌐',
  guild: '🏰',
  both: '🏯',
  guildwars: '⚔️'
};
const categoryLabels = {
  public: 'Public VFS',
  guild: 'Guild VFS',
  both: 'Public + Guild VFS',
  guildwars: 'Guild Wars'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myevents')
    .setDescription('Check which upcoming events you are registered for'),

  async execute(interaction) {
    try {
      const eventStorage = new EventStorage();
      const allEvents = eventStorage.getAllEvents();
      const userId = interaction.user.id;
      const now = new Date();

      // Gather all future events where this user has an RSVP (excluding "No")
      const userEvents = [];
      for (const [eventId, event] of Object.entries(allEvents)) {
        const eventTime = new Date(event.timestamp * 1000);
        if (eventTime <= now) continue; // skip past events

        const rsvpUsers = event.rsvpUsers || {};
        let userRole = null;
        let userResponse = null;
        // Check VFS roles (tank, dps, support)
        if (rsvpUsers.tank && rsvpUsers.tank.includes(userId)) {
          userRole = 'Tank';
        } else if (rsvpUsers.dps && rsvpUsers.dps.includes(userId)) {
          userRole = 'DPS';
        } else if (rsvpUsers.support && rsvpUsers.support.includes(userId)) {
          userRole = 'Support';
        }
        // Check GvG responses (yes, maybe) but ignore "no"
        if (rsvpUsers.yes && rsvpUsers.yes.includes(userId)) {
          userResponse = 'Yes';
        } else if (rsvpUsers.maybe && rsvpUsers.maybe.includes(userId)) {
          userResponse = 'Maybe';
        }
        // If the user has any positive RSVP (role or yes/maybe), include the event
        if (userRole || userResponse) {
          userEvents.push({ eventId, event, userRole, userResponse });
        }
      }

      if (userEvents.length === 0) {
        // User isn't registered for any upcoming events
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply({
            content: 'You are not registered for any upcoming events.',
            ephemeral: true
          });
        } else {
          return interaction.editReply({
            content: 'You are not registered for any upcoming events.'
          });
        }
      }

      // Sort the user's events by time
      userEvents.sort((a, b) => a.event.timestamp - b.event.timestamp);

      // Group events by date
      const eventsByDate = {};
      for (const { eventId, event, userRole, userResponse } of userEvents) {
        const eventDate = new Date(event.timestamp * 1000);
        const dateKey = eventDate.toDateString();
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push({ eventId, event, userRole, userResponse });
      }

      // Build an embed listing the events the user is registered for
      const embed = new EmbedBuilder()
        .setTitle('⚔️ Your Registered Events 🏯')
        .setColor(0x5865F2);

      for (const [dateKey, events] of Object.entries(eventsByDate)) {
        const date = new Date(dateKey);
        const dateFormatted = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        let eventList = '';
        for (const { eventId, event, userRole, userResponse } of events) {
          const eventTime = new Date(event.timestamp * 1000);
          const timeFormatted = `<t:${event.timestamp}:t>`;
          const messageLink = `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`;
          // Determine category icon/label
          const icon = categoryIcons[event.category] || '';
          const label = categoryLabels[event.category] || event.category;
          // Determine the user's registration info for this event (role or response)
          let registrationInfo = '';
          if (userRole) {
            const roleIcons = { Tank: '🛡️', DPS: '⚔️', Support: '💖' };
           // registrationInfo = ` - ${roleIcons[userRole] || ''} ${userRole}`;
           registrationInfo = ` - ✅ Registered`;
          } else if (userResponse) {
            const responseIcons = { Yes: '✅', Maybe: '❓' };
            registrationInfo = ` - ${responseIcons[userResponse] || ''} ${userResponse}`;
          } 
          eventList += `> ${timeFormatted} - **${icon ? icon + ' ' : ''}[${label} ${event.title}](${messageLink})** (<t:${event.timestamp}:R>)${registrationInfo}\n`;
        }

        embed.addFields({
          name: `📅 ${dateFormatted}`,
          value: eventList.trim(),
          inline: false
        });
      }

      // Footer shows the total number of events the user is registered in
      embed.setFooter({
        text: `${userEvents.length} registered event${userEvents.length !== 1 ? 's' : ''}`
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in myevents command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Failed to retrieve your event registrations. Please try again later.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Failed to retrieve your event registrations. Please try again later.',
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Failed to send error response for myevents command:', err);
      }
    }
  }
};
