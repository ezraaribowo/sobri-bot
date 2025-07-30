// Command handlers for Sobri-Bot Cloudflare Workers
// Handles all slash command executions

import { EventStorage, RoleConfigStorage, UserEventStorage } from './storage.js';
import { PermissionManager, DateParser, EmbedBuilder, generateEventId } from './utils.js';

export class CommandHandlers {
  constructor(env) {
    this.env = env;
    this.eventStorage = new EventStorage(env);
    this.roleConfigStorage = new RoleConfigStorage(env);
    this.userEventStorage = new UserEventStorage(env);
    this.permissionManager = new PermissionManager();
  }

  async handleEvents(interaction) {
    const eventType = interaction.data.options.find(opt => opt.name === 'type')?.value;
    
    if (!eventType) {
      return {
        type: 4,
        data: {
          content: "❌ Please specify an event type (vfs, gvg, or all).",
          flags: 64
        }
      };
    }

    const allEvents = await this.eventStorage.getAllEvents();
    const now = new Date();
    
    // Filter events based on type and only include future events
    const filteredEvents = Object.entries(allEvents).filter(([eventId, event]) => {
      const eventTime = new Date(event.timestamp * 1000);
      if (eventTime <= now) return false; // skip past events
      
      if (eventType === 'vfs') {
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
      return {
        type: 4,
        data: {
          content: `No ${typeText} events found.`,
          flags: 64
        }
      };
    }

    // Convert to object for embed creation
    const eventsObj = Object.fromEntries(filteredEvents);
    const embed = EmbedBuilder.createEventsListEmbed(eventsObj, eventType);

    return {
      type: 4,
      data: {
        embeds: [embed]
      }
    };
  }

  async handleVFS(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    const title = interaction.data.options.find(opt => opt.name === 'title')?.value;
    const datetimeInput = interaction.data.options.find(opt => opt.name === 'datetime')?.value;
    const category = interaction.data.options.find(opt => opt.name === 'category')?.value;

    if (!title || !datetimeInput || !category) {
      return {
        type: 4,
        data: {
          content: "❌ Missing required parameters.",
          flags: 64
        }
      };
    }

    const parseResult = DateParser.parseDateTime(datetimeInput);
    if (!parseResult.success) {
      return {
        type: 4,
        data: {
          content: `❌ ${parseResult.error}`,
          flags: 64
        }
      };
    }

    const eventId = generateEventId();
    const eventData = {
      title,
      category,
      timestamp: parseResult.timestamp,
      createdBy: interaction.member?.user?.id,
      createdAt: Date.now()
    };

    const success = await this.eventStorage.saveEvent(eventId, eventData);
    if (!success) {
      return {
        type: 4,
        data: {
          content: "❌ Failed to save event.",
          flags: 64
        }
      };
    }

    const embed = EmbedBuilder.createEventEmbed(eventData);
    const roleMention = await this.roleConfigStorage.getRoleMentionForCategory(category);

    return {
      type: 4,
      data: {
        content: roleMention || undefined,
        embeds: [embed]
      }
    };
  }

  async handleGVG(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    const title = interaction.data.options.find(opt => opt.name === 'title')?.value;
    const datetimeInput = interaction.data.options.find(opt => opt.name === 'datetime')?.value;
    const opponent = interaction.data.options.find(opt => opt.name === 'opponent')?.value;
    const description = interaction.data.options.find(opt => opt.name === 'description')?.value;

    if (!title || !datetimeInput || !opponent) {
      return {
        type: 4,
        data: {
          content: "❌ Missing required parameters.",
          flags: 64
        }
      };
    }

    const parseResult = DateParser.parseDateTime(datetimeInput);
    if (!parseResult.success) {
      return {
        type: 4,
        data: {
          content: `❌ ${parseResult.error}`,
          flags: 64
        }
      };
    }

    const eventId = generateEventId();
    const eventData = {
      title,
      category: 'guildwars',
      timestamp: parseResult.timestamp,
      opponent,
      description,
      createdBy: interaction.member?.user?.id,
      createdAt: Date.now()
    };

    const success = await this.eventStorage.saveEvent(eventId, eventData);
    if (!success) {
      return {
        type: 4,
        data: {
          content: "❌ Failed to save event.",
          flags: 64
        }
      };
    }

    const embed = EmbedBuilder.createEventEmbed(eventData);
    const roleMention = await this.roleConfigStorage.getRoleMentionForCategory('gvg');

    return {
      type: 4,
      data: {
        content: roleMention || undefined,
        embeds: [embed]
      }
    };
  }

  async handleMyEvents(interaction) {
    const userId = interaction.member?.user?.id;
    if (!userId) {
      return {
        type: 4,
        data: {
          content: "❌ Could not identify user.",
          flags: 64
        }
      };
    }

    const userEventIds = await this.userEventStorage.getUserEvents(userId);
    const allEvents = await this.eventStorage.getAllEvents();
    
    const userEvents = {};
    for (const eventId of userEventIds) {
      if (allEvents[eventId]) {
        userEvents[eventId] = allEvents[eventId];
      }
    }

    if (Object.keys(userEvents).length === 0) {
      return {
        type: 4,
        data: {
          content: "📋 You don't have any events registered.",
          flags: 64
        }
      };
    }

    const embed = EmbedBuilder.createEventsListEmbed(userEvents, 'all');
    embed.title = '📋 Your Events';

    return {
      type: 4,
      data: {
        embeds: [embed]
      }
    };
  }

  async handleDelete(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    const eventId = interaction.data.options.find(opt => opt.name === 'event_id')?.value;
    if (!eventId) {
      return {
        type: 4,
        data: {
          content: "❌ Please provide an event ID.",
          flags: 64
        }
      };
    }

    const event = await this.eventStorage.getEvent(eventId);
    if (!event) {
      return {
        type: 4,
        data: {
          content: "❌ Event not found.",
          flags: 64
        }
      };
    }

    const success = await this.eventStorage.deleteEvent(eventId);
    if (!success) {
      return {
        type: 4,
        data: {
          content: "❌ Failed to delete event.",
          flags: 64
        }
      };
    }

    return {
      type: 4,
      data: {
        content: `✅ Successfully deleted event: **${event.title}**`,
        flags: 64
      }
    };
  }

  async handleRemind(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    const eventId = interaction.data.options.find(opt => opt.name === 'event_id')?.value;
    if (!eventId) {
      return {
        type: 4,
        data: {
          content: "❌ Please provide an event ID.",
          flags: 64
        }
      };
    }

    const event = await this.eventStorage.getEvent(eventId);
    if (!event) {
      return {
        type: 4,
        data: {
          content: "❌ Event not found.",
          flags: 64
        }
      };
    }

    const embed = EmbedBuilder.createEventEmbed(event);
    const roleMention = await this.roleConfigStorage.getRoleMentionForCategory(event.category);

    return {
      type: 4,
      data: {
        content: `🔔 **REMINDER** ${roleMention || ''}`,
        embeds: [embed]
      }
    };
  }

  async handleSetRole(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    const action = interaction.data.options.find(opt => opt.name === 'action')?.value;
    const category = interaction.data.options.find(opt => opt.name === 'category')?.value;
    const role = interaction.data.options.find(opt => opt.name === 'role')?.value;

    if (!action) {
      return {
        type: 4,
        data: {
          content: "❌ Please specify an action (set, view, or clear).",
          flags: 64
        }
      };
    }

    if (action === 'set') {
      if (!category || !role) {
        return {
          type: 4,
          data: {
            content: "❌ Please provide both category and role.",
            flags: 64
          }
        };
      }

      const success = await this.roleConfigStorage.setRoleConfig(category, role);
      if (!success) {
        return {
          type: 4,
          data: {
            content: "❌ Failed to set role configuration.",
            flags: 64
          }
        };
      }

      return {
        type: 4,
        data: {
          content: `✅ Role configured for ${category} events.`,
          flags: 64
        }
      };
    } else if (action === 'view') {
      const config = await this.roleConfigStorage.getRoleConfig();
      if (Object.keys(config).length === 0) {
        return {
          type: 4,
          data: {
            content: "📋 No role configurations set.",
            flags: 64
          }
        };
      }

      let configText = "📋 **Role Configurations:**\n";
      for (const [cat, roleId] of Object.entries(config)) {
        configText += `• **${cat}**: <@&${roleId}>\n`;
      }

      return {
        type: 4,
        data: {
          content: configText,
          flags: 64
        }
      };
    } else if (action === 'clear') {
      if (!category) {
        return {
          type: 4,
          data: {
            content: "❌ Please specify a category to clear.",
            flags: 64
          }
        };
      }

      const success = await this.roleConfigStorage.clearRoleConfig(category);
      if (!success) {
        return {
          type: 4,
          data: {
            content: "❌ Failed to clear role configuration.",
            flags: 64
          }
        };
      }

      return {
        type: 4,
        data: {
          content: `✅ Role configuration cleared for ${category} events.`,
          flags: 64
        }
      };
    }

    return {
      type: 4,
      data: {
        content: "❌ Invalid action specified.",
        flags: 64
      }
    };
  }

  async handleStatus(interaction) {
    const embed = EmbedBuilder.createStatusEmbed();
    
    return {
      type: 4,
      data: {
        embeds: [embed]
      }
    };
  }

  async handleTestRole(interaction) {
    if (!this.permissionManager.hasAdminPermissions(interaction)) {
      return await this.permissionManager.sendPermissionError(interaction);
    }

    return {
      type: 4,
      data: {
        content: "✅ Role permissions test passed. You have administrator permissions.",
        flags: 64
      }
    };
  }
} 