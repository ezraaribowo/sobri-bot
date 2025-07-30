// Cloudflare KV Storage utilities for Sobri-Bot
// Handles events, role configurations, and user data

export class EventStorage {
  constructor(env) {
    this.env = env;
  }

  async getAllEvents() {
    try {
      const eventsData = await this.env.SOBRI_BOT_KV.get('events', { type: 'json' });
      return eventsData || {};
    } catch (error) {
      console.error('Error getting events:', error);
      return {};
    }
  }

  async saveEvent(eventId, eventData) {
    try {
      const events = await this.getAllEvents();
      events[eventId] = eventData;
      await this.env.SOBRI_BOT_KV.put('events', JSON.stringify(events));
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      return false;
    }
  }

  async deleteEvent(eventId) {
    try {
      const events = await this.getAllEvents();
      if (events[eventId]) {
        delete events[eventId];
        await this.env.SOBRI_BOT_KV.put('events', JSON.stringify(events));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  async getEvent(eventId) {
    try {
      const events = await this.getAllEvents();
      return events[eventId] || null;
    } catch (error) {
      console.error('Error getting event:', error);
      return null;
    }
  }
}

export class RoleConfigStorage {
  constructor(env) {
    this.env = env;
  }

  async getRoleConfig() {
    try {
      const config = await this.env.SOBRI_BOT_KV.get('roleConfig', { type: 'json' });
      return config || {};
    } catch (error) {
      console.error('Error getting role config:', error);
      return {};
    }
  }

  async setRoleConfig(category, roleId) {
    try {
      const config = await this.getRoleConfig();
      config[category] = roleId;
      await this.env.SOBRI_BOT_KV.put('roleConfig', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Error setting role config:', error);
      return false;
    }
  }

  async clearRoleConfig(category) {
    try {
      const config = await this.getRoleConfig();
      delete config[category];
      await this.env.SOBRI_BOT_KV.put('roleConfig', JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Error clearing role config:', error);
      return false;
    }
  }

  async getRoleMentionForCategory(category) {
    try {
      const config = await this.getRoleConfig();
      const roleId = config[category];
      return roleId ? `<@&${roleId}>` : null;
    } catch (error) {
      console.error('Error getting role mention:', error);
      return null;
    }
  }
}

export class UserEventStorage {
  constructor(env) {
    this.env = env;
  }

  async getUserEvents(userId) {
    try {
      const userEvents = await this.env.SOBRI_BOT_KV.get(`userEvents:${userId}`, { type: 'json' });
      return userEvents || [];
    } catch (error) {
      console.error('Error getting user events:', error);
      return [];
    }
  }

  async addUserEvent(userId, eventId) {
    try {
      const userEvents = await this.getUserEvents(userId);
      if (!userEvents.includes(eventId)) {
        userEvents.push(eventId);
        await this.env.SOBRI_BOT_KV.put(`userEvents:${userId}`, JSON.stringify(userEvents));
      }
      return true;
    } catch (error) {
      console.error('Error adding user event:', error);
      return false;
    }
  }

  async removeUserEvent(userId, eventId) {
    try {
      const userEvents = await this.getUserEvents(userId);
      const filteredEvents = userEvents.filter(id => id !== eventId);
      await this.env.SOBRI_BOT_KV.put(`userEvents:${userId}`, JSON.stringify(filteredEvents));
      return true;
    } catch (error) {
      console.error('Error removing user event:', error);
      return false;
    }
  }
} 