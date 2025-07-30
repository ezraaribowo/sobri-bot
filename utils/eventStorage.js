const fs = require('fs');
const path = require('path');

/**
 * Simple JSON-backed event storage.  Each event has an ID (the message ID),
 * metadata (timestamp, title, category, etc.), and RSVP lists.
 */
class EventStorage {
  constructor() {
    this.eventsFile = path.join(__dirname, 'data', 'events.json');
    this.ensureDataDirectory();
    this.events = this.loadEvents();
  }

  ensureDataDirectory() {
    const dir = path.dirname(this.eventsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadEvents() {
    try {
      if (fs.existsSync(this.eventsFile)) {
        const raw = fs.readFileSync(this.eventsFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error loading events:', err);
    }
    return {};
  }

  saveEvents() {
    try {
      fs.writeFileSync(this.eventsFile, JSON.stringify(this.events, null, 2));
    } catch (err) {
      console.error('Error saving events:', err);
    }
  }

  addEvent(eventId, eventData) {
    // Initialize RSVP lists depending on category
    let rsvpUsers;
    if (eventData.category === 'guildwars') {
      rsvpUsers = { yes: [], maybe: [], no: [] };
    } else {
      rsvpUsers = { tank: [], dps: [], support: [] };
    }

    this.events[eventId] = {
      ...eventData,
      createdAt: new Date().toISOString(),
      reminderSent: false,
      reminderMessageIds: [],
      rsvpUsers
    };
    this.saveEvents();
  }

  getEvent(eventId) {
    return this.events[eventId];
  }

  getAllEvents() {
    return this.events;
  }

  markReminderSent(eventId, reminderMessageId = null) {
    if (!this.events[eventId]) return;
    this.events[eventId].reminderSent = true;
    if (reminderMessageId) {
      this.events[eventId].reminderMessageIds =
        this.events[eventId].reminderMessageIds || [];
      this.events[eventId].reminderMessageIds.push(reminderMessageId);
    }
    this.saveEvents();
  }

  addReminderMessageId(eventId, messageId) {
    if (!this.events[eventId]) return;
    this.events[eventId].reminderMessageIds =
      this.events[eventId].reminderMessageIds || [];
    this.events[eventId].reminderMessageIds.push(messageId);
    this.saveEvents();
  }

  removeEvent(eventId) {
    if (this.events[eventId]) {
      delete this.events[eventId];
      this.saveEvents();
    }
  }

  addUserToRSVP(eventId, userId, role) {
    const event = this.events[eventId];
    if (!event) return false;

    const rsvp = event.rsvpUsers;

    if (event.category === 'guildwars') {
      rsvp.yes = rsvp.yes || [];
      rsvp.maybe = rsvp.maybe || [];
      rsvp.no = rsvp.no || [];

      // Remove the user from all GvG lists before assigning
      rsvp.yes = rsvp.yes.filter(id => id !== userId);
      rsvp.maybe = rsvp.maybe.filter(id => id !== userId);
      rsvp.no = rsvp.no.filter(id => id !== userId);

      if (role === 'yes') rsvp.yes.push(userId);
      else if (role === 'maybe') rsvp.maybe.push(userId);
      else if (role === 'no') rsvp.no.push(userId);
    } else {
      // VFS: tank/dps/support
      rsvp.tank = rsvp.tank || [];
      rsvp.dps = rsvp.dps || [];
      rsvp.support = rsvp.support || [];

      rsvp.tank = rsvp.tank.filter(id => id !== userId);
      rsvp.dps = rsvp.dps.filter(id => id !== userId);
      rsvp.support = rsvp.support.filter(id => id !== userId);

      if (role === 'tank') rsvp.tank.push(userId);
      else if (role === 'dps') rsvp.dps.push(userId);
      else if (role === 'support') rsvp.support.push(userId);
    }

    this.saveEvents();
    return true;
  }

  removeUserFromRSVP(eventId, userId) {
    const event = this.events[eventId];
    if (!event) return false;

    const rsvp = event.rsvpUsers;

    if (event.category === 'guildwars') {
      rsvp.yes = rsvp.yes || [];
      rsvp.maybe = rsvp.maybe || [];
      rsvp.no = rsvp.no || [];

      rsvp.yes = rsvp.yes.filter(id => id !== userId);
      rsvp.maybe = rsvp.maybe.filter(id => id !== userId);
      rsvp.no = rsvp.no.filter(id => id !== userId);
    } else {
      rsvp.tank = rsvp.tank || [];
      rsvp.dps = rsvp.dps || [];
      rsvp.support = rsvp.support || [];

      rsvp.tank = rsvp.tank.filter(id => id !== userId);
      rsvp.dps = rsvp.dps.filter(id => id !== userId);
      rsvp.support = rsvp.support.filter(id => id !== userId);
    }

    this.saveEvents();
    return true;
  }

  /**
   * Returns RSVP users by category.
   * - For Guild Wars: returns yes/maybe/no.
   * - For VFS: returns tank/dps/support.
   */
  getRSVPUsers(eventId) {
    const event = this.events[eventId];
    if (!event) return null;
    const rsvp = event.rsvpUsers || {};

    if (event.category === 'guildwars') {
      return {
        yes: Array.isArray(rsvp.yes) ? rsvp.yes : [],
        maybe: Array.isArray(rsvp.maybe) ? rsvp.maybe : [],
        no: Array.isArray(rsvp.no) ? rsvp.no : []
      };
    }

    return {
      tank: Array.isArray(rsvp.tank) ? rsvp.tank : [],
      dps: Array.isArray(rsvp.dps) ? rsvp.dps : [],
      support: Array.isArray(rsvp.support) ? rsvp.support : []
    };
  }

  /**
   * Returns events that will start within the next hour and haven’t had a reminder sent.
   */
  getUpcomingEvents() {
    const now = Date.now();
    return Object.entries(this.events).filter(
      ([id, event]) =>
        !event.reminderSent &&
        event.timestamp * 1000 - now <= 3600000 &&
        event.timestamp * 1000 > now
    );
  }

  /**
   * Clean up expired events. If a message was sent for a reminder,
   * delete those reminder messages (if still present in the channel).
   */
  cleanupPastEvents(client) {
    const now = Date.now();
    for (const [id, event] of Object.entries(this.events)) {
      if (event.timestamp * 1000 < now) {
        // Try deleting any leftover reminder messages
        if (event.reminderMessageIds) {
          for (const msgId of event.reminderMessageIds) {
            try {
              const channel = client.channels.cache.get(event.channelId);
              channel?.messages.delete(msgId).catch(() => {});
            } catch {
              /* noop */
            }
          }
        }
        delete this.events[id];
      }
    }
    this.saveEvents();
  }
}

module.exports = EventStorage;
