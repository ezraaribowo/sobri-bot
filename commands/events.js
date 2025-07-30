const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventStorage = require('../utils/eventStorage');

// Maps for category icons and labels to format event listings uniformly
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
    .setName('events')
    .setDescription('Display upcoming events list')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Filter events by type')
        .addChoices(
          { name: 'VFS Events', value: 'vfs' },
          { name: 'GvG Events', value: 'gvg' },
          { name: 'All Events', value: 'all' }
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const eventType = interaction.options.getString('type');
      const eventStorage = new EventStorage();
      const allEvents = eventStorage.getAllEvents();

      // Filter events based on type and only include future events
      const now = new Date();
      const filteredEvents = Object.entries(allEvents).filter(([eventId, event]) => {
        const eventTime = new Date(event.timestamp * 1000);
        if (eventTime <= now) return false; // skip past events
        if (eventType === 'vfs') {
          // Include public, guild, or both (VFS-related events)
          return ['public', 'guild', 'both'].includes(event.category);
        } else if (eventType === 'gvg') {
          return event.category === 'guildwars';
        } else if (eventType === 'all') {
          return true;
        }
        return false;
      });

      if (filteredEvents.length === 0) {
        const typeText = eventType === 'vfs' ? 'VFS' : eventType === 'gvg' ? 'GvG' : 'upcoming';
        // No events of this type, reply with an ephemeral notice
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            content: `No ${typeText} events found.`,
            ephemeral: true
          });
        } else {
          return await interaction.editReply({
            content: `No ${typeText} events found.`
          });
        }
      }

      // Defer the reply to handle formatting without timing out (public since this is a visible event list)
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }
      // Sort events by start timestamp
      filteredEvents.sort(([, a], [, b]) => a.timestamp - b.timestamp);

      // Group events by date (year-month-day)
      const eventsByDate = {};
      for (const [eventId, event] of filteredEvents) {
        const eventDate = new Date(event.timestamp * 1000);
        const dateKey = eventDate.toDateString();
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push({ eventId, event });
      }

      // Create an embed listing the events
      const embed = new EmbedBuilder()
        .setColor(eventType === 'vfs' ? 0x00AE86 : eventType === 'gvg' ? 0xFF0000 : 0x5865F2);
      // Set an appropriate title based on the filter type
      if (eventType === 'vfs') {
        embed.setTitle('🏯 Upcoming VFS Events 🏯');
      } else if (eventType === 'gvg') {
        embed.setTitle('⚔️ Upcoming GvG Events ⚔️');
      } else {
        embed.setTitle('⚔️ All Upcoming Events 🏯');
      }

      // Add a field for each date grouping, listing events of that date
      for (const [dateKey, events] of Object.entries(eventsByDate)) {
        const date = new Date(dateKey);
        const dateFormatted = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        let eventList = '';
        for (const { eventId, event } of events) {
          const eventTime = new Date(event.timestamp * 1000);
          const timeFormatted = `<t:${event.timestamp}:t>`;
          // Create a link to the original event message in Discord
          const messageLink = `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`;
          // Determine category icon and label for this event
          const icon = categoryIcons[event.category] || '';
          const label = categoryLabels[event.category] || event.category;
          // Format each event entry: time, category label, title, and relative time
          eventList += `> ${timeFormatted} - **${icon ? icon + ' ' : ''}[${label} ${event.title}](${messageLink})** (<t:${event.timestamp}:R>)\n`;
        }

        embed.addFields({
          name: `📅 ${dateFormatted}`,
          value: eventList.trim(),
          inline: false
        });
      }

      // Add a footer indicating the total number of events listed
      embed.setFooter({
        text: `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''} found`
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing events command:', error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: '❌ Failed to display the events list. Please try again later.',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Failed to display the events list. Please try again later.',
            ephemeral: true
          });
        }
      } catch (err) {
        console.error('Failed to send error response for events command:', err);
      }
    }
  }
};
