// Utility functions for Sobri-Bot Cloudflare Workers
// Handles permissions, date parsing, and embed creation

import { parseDate } from 'chrono-node';

export class PermissionManager {
  constructor() {}

  hasAdminPermissions(interaction) {
    // Check if user has administrator permissions
    return interaction.member?.permissions?.has('Administrator') || false;
  }

  async sendPermissionError(interaction) {
    return {
      type: 4,
      data: {
        content: "❌ You don't have permission to use this command. Administrator permissions required.",
        flags: 64 // Ephemeral
      }
    };
  }
}

export class DateParser {
  static parseDateTime(input) {
    try {
      const parsedDate = parseDate(input, new Date(), { forwardDate: true });
      if (!parsedDate) {
        return { success: false, error: 'Could not parse the given date/time.' };
      }
      return { 
        success: true, 
        timestamp: Math.floor(parsedDate.getTime() / 1000),
        date: parsedDate
      };
    } catch (error) {
      return { success: false, error: 'Invalid date/time format.' };
    }
  }
}

export class EmbedBuilder {
  static createEventEmbed(eventData) {
    const { title, category, timestamp, description, opponent } = eventData;
    
    // Determine embed color and label based on category
    const colorMap = { 
      public: 0x1abc9c, 
      guild: 0x3498db, 
      both: 0x9b59b6,
      guildwars: 0xe74c3c
    };
    const embedColor = colorMap[category] || 0x00AE86;
    
    let label;
    if (category === 'guildwars') {
      label = 'Guild Wars';
    } else if (category === 'both') {
      label = 'Public + Guild VFS';
    } else if (category === 'public') {
      label = 'Public VFS';
    } else if (category === 'guild') {
      label = 'Guild VFS';
    } else {
      label = 'Event';
    }

    const embed = {
      title: `[${label}] - ${title}`,
      color: embedColor,
      fields: [
        {
          name: '',
          value: `📅 <t:${timestamp}:F> - ⏰ <t:${timestamp}:R>`,
          inline: false
        }
      ]
    };

    if (description) {
      embed.description = description;
    }

    if (opponent) {
      embed.fields.push({
        name: '⚔️ Opponent',
        value: opponent,
        inline: true
      });
    }

    // Add RSVP fields for VFS events
    if (['public', 'guild', 'both'].includes(category)) {
      embed.fields.push(
        { name: '🛡️ Tank (0)', value: '\u200B', inline: true },
        { name: '⚔️ DPS (0)', value: '\u200B', inline: true },
        { name: '💖 Support (0)', value: '\u200B', inline: true }
      );
    }

    return embed;
  }

  static createEventsListEmbed(events, eventType) {
    const embed = {
      color: eventType === 'vfs' ? 0x00AE86 : eventType === 'gvg' ? 0xFF0000 : 0x5865F2,
      fields: []
    };

    // Set title based on filter type
    if (eventType === 'vfs') {
      embed.title = '🏯 Upcoming VFS Events 🏯';
    } else if (eventType === 'gvg') {
      embed.title = '⚔️ Upcoming GvG Events ⚔️';
    } else {
      embed.title = '⚔️ All Upcoming Events 🏯';
    }

    // Group events by date
    const eventsByDate = {};
    for (const [eventId, event] of Object.entries(events)) {
      const eventDate = new Date(event.timestamp * 1000);
      const dateKey = eventDate.toDateString();
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push({ eventId, event });
    }

    // Add fields for each date
    for (const [dateKey, dayEvents] of Object.entries(eventsByDate)) {
      const date = new Date(dateKey);
      const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      let eventsList = '';
      for (const { eventId, event } of dayEvents) {
        const time = new Date(event.timestamp * 1000).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit' 
        });
        eventsList += `• **${event.title}** - ${time} (ID: \`${eventId}\`)\n`;
      }

      embed.fields.push({
        name: `📅 ${formattedDate}`,
        value: eventsList,
        inline: false
      });
    }

    return embed;
  }

  static createStatusEmbed() {
    return {
      title: '🟢 Sobri-Bot Status',
      color: 0x00FF00,
      fields: [
        {
          name: 'Status',
          value: '🟢 Online 24/7',
          inline: true
        },
        {
          name: 'Platform',
          value: 'Cloudflare Workers',
          inline: true
        },
        {
          name: 'Uptime',
          value: 'Always Available',
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };
  }
}

export function generateEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatTimestamp(timestamp) {
  return `<t:${timestamp}:F> (<t:${timestamp}:R>)`;
} 