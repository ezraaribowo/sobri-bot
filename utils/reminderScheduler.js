const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const EventStorage = require('./eventStorage');
const RoleConfigManager = require('./roleConfig');


class ReminderScheduler {
  constructor(client) {
    this.client = client;
    this.eventStorage = new EventStorage();
    this.roleConfig = new RoleConfigManager();
    this.checkInterval = null;
  }

  /**
   * Starts periodic checks for upcoming events and schedules daily cleanups.
   */
  start() {
    // Immediately check for reminders on startup.
    this.checkForReminders();

    // Check every 1 minutes thereafter.
    this.checkInterval = setInterval(
      () => this.checkForReminders(),
      1 * 60 * 1000
    );

    // Run cleanup once per day.
    setInterval(
      () => this.eventStorage.cleanupPastEvents(this.client),
      24 * 60 * 60 * 1000
    );

    console.log('Reminder scheduler started');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('Reminder scheduler stopped');
  }

  /**
   * Looks for events starting within the next hour and sends reminders.
   */
async checkForReminders() {
 // console.log('Checking for reminders...'); // Add this line
  try {
    // Reload events each time we check for reminders so we see new events.
    this.eventStorage = new EventStorage();

    const upcoming = this.eventStorage.getUpcomingEvents();
    for (const [eventId, data] of upcoming) {
      await this.sendReminder(eventId, data);
    }
  } catch (err) {
    console.error('Error checking for reminders:', err);
  }
}

  /**
   * Sends a reminder in the event channel and DMs all RSVP’d attendees.
   */
  async sendReminder(eventId, eventData) {
    try {
      const channel = await this.client.channels.fetch(eventData.channelId);
      if (!channel) {
        // Mark as sent so we don’t keep retrying on a missing channel.
        this.eventStorage.markReminderSent(eventId);
        return;
      }

      // Include eventId so our embed can link back to the original message.
      const dataWithId = { ...eventData, eventId };
      const embed = this.createReminderEmbed(dataWithId);
      const roleMention =
        this.roleConfig.getRoleMentionForCategory(eventData.category);
      const messageOptions = roleMention
        ? { content: roleMention, embeds: [embed] }
        : { embeds: [embed] };

      const sent = await channel.send(messageOptions);

      // Send personal DMs to RSVP’d users.
      await this.sendPersonalReminders(eventId, dataWithId);

      // Mark the event reminder as sent and record the message ID for later cleanup.
      this.eventStorage.markReminderSent(eventId, sent.id);
      console.log(
        `Reminder sent for event "${eventData.title}"` +
          (roleMention ? ' with role mention' : '')
      );
    } catch (err) {
      console.error(`Error sending reminder for event ${eventId}:`, err);
      if (err.code === 10003) {
        // Unknown channel: mark so we don’t retry.
        this.eventStorage.markReminderSent(eventId);
      }
    }
  }

  /**
   * Sends personal DM reminders to all RSVP’d attendees.
   *
   * A new EventStorage instance is created here to ensure the RSVP data is current,
   * since RSVPs might change after the scheduler is constructed.
   */
  async sendPersonalReminders(eventId, eventData) {
    try {
      const freshStore = new EventStorage();
      const rsvp = freshStore.getRSVPUsers(eventId);
      if (!rsvp) return;

      let users = [];
      if (eventData.category === 'guildwars') {
        users = [...(rsvp.yes || []), ...(rsvp.maybe || [])];
      } else {
        users = [
          ...(rsvp.tank || []),
          ...(rsvp.dps || []),
          ...(rsvp.support || [])
        ];
      }

      for (const userId of users) {
        try {
          const user = await this.client.users.fetch(userId);
          const personalEmbed = this.createPersonalReminderEmbed(eventData);
          
          // Build a single “Clear Reminder” button with a unique customId
          const deleteRow = new ActionRowBuilder().addComponents(
         new ButtonBuilder()
        .setCustomId(`deleteReminder_${eventData.eventId}`)
        .setLabel('Clear Reminder 🗑️')
        .setStyle(ButtonStyle.Danger)
    );
          
         await user.send({ embeds: [personalEmbed], components: [deleteRow] });
        } catch (err) {
          console.error(
            `Failed to DM reminder to user ${userId}:`,
            err.message || err
          );
        }
      }

      if (users.length > 0) {
        console.log(
          `Personal reminders sent to ${users.length} RSVP attendees for "${eventData.title}"`
        );
      }
    } catch (err) {
      console.error(`Error sending personal reminders for ${eventId}:`, err);
    }
  }

  /**
   * Builds an embed for the personal (DM) reminder.
   * The title is hyperlinked to the original event message.
   */
  createPersonalReminderEmbed(eventData) {
    const colorMap = {
      public: 0x1abc9c,
      guild: 0x3498db,
      both: 0x9b59b6,
      guildwars: 0xff0000
    };
    const color = colorMap[eventData.category] || 0x00ae86;

    let label;
    if (eventData.category === 'guildwars') {
      label = 'Guild Wars';
    } else if (eventData.category === 'both') {
      label = 'Public + Guild VFS';
    } else if (eventData.category === 'public') {
      label = 'Public VFS';
    } else {
      label = 'Guild VFS';
    }

    const messageId = eventData.messageId || eventData.eventId;
    const link = `https://discord.com/channels/${eventData.guildId}/${eventData.channelId}/${messageId}`;

    return new EmbedBuilder()
      .setTitle(`🔔 [${label}] - ${eventData.title} 🔔`)
      .setURL(link)
      .setDescription(
        `**Starting in <t:${eventData.timestamp}:R>!**\n\n📅 <t:${eventData.timestamp}:F>`
      )
      .setColor(color);
  }

  /**
   * Builds an embed for the public channel reminder.
   */
  createReminderEmbed(eventData) {
    const colorMap = {
      public: 0x1abc9c,
      guild: 0x3498db,
      both: 0x9b59b6,
      guildwars: 0xff0000
    };
    const color = colorMap[eventData.category] || 0x00ae86;

    let label;
    if (eventData.category === 'guildwars') {
      label = 'Guild Wars';
    } else if (eventData.category === 'both') {
      label = 'Public + Guild VFS';
    } else if (eventData.category === 'public') {
      label = 'Public VFS';
    } else {
      label = 'Guild VFS';
    }

    const messageId = eventData.messageId || eventData.eventId;
    const link = `https://discord.com/channels/${eventData.guildId}/${eventData.channelId}/${messageId}`;

    return new EmbedBuilder()
    .setTitle(`🔔 [${label}] - ${eventData.title} 🔔`)
    .setURL(link)
    .setDescription(
      `**Starting in <t:${eventData.timestamp}:R>!**\n\n📅 <t:${eventData.timestamp}:F>`
    )
      .setColor(color);
  }

  /**
   * Sends a manual reminder (via the /remind slash command).  You can provide
   * an optional attendee list, which will be included in the embed.
   */
  async sendManualReminder(channelId, eventData, attendees = null, eventId = null) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) throw new Error(`Channel ${channelId} not found`);

      const fullData = { ...eventData, eventId };
      const embed = this.createManualReminderEmbed(fullData, attendees);

      // Mention roles only in guild text channels
      const roleMention =
        channel.type === 1 // DM
          ? null
          : this.roleConfig.getRoleMentionForCategory(eventData.category);

      const messageOptions = roleMention
        ? { content: roleMention, embeds: [embed] }
        : { embeds: [embed] };

      const sent = await channel.send(messageOptions);

      // DM RSVP’d users
      await this.sendPersonalReminders(eventId, fullData);

      // Store for cleanup
      this.eventStorage.addReminderMessageId(eventId, sent.id);

      console.log(
        `Manual reminder sent for "${eventData.title}"` +
          (roleMention ? ' with role mention' : '')
      );

      return true;
    } catch (err) {
      console.error('Error sending manual reminder:', err);
      return false;
    }
  }

  /**
   * Builds an embed for manual reminders, optionally showing attendee lists.
   */
  createManualReminderEmbed(eventData, attendees) {
    const colorMap = {
      public: 0x1abc9c,
      guild: 0x3498db,
      both: 0x9b59b6,
      guildwars: 0xff0000
    };
    const color = colorMap[eventData.category] || 0x00ae86;

    let label;
    if (eventData.category === 'guildwars') {
      label = 'Guild Wars';
    } else if (eventData.category === 'both') {
      label = 'Public + Guild VFS';
    } else if (eventData.category === 'public') {
      label = 'Public VFS';
    } else {
      label = 'Guild VFS';
    }

    // Compute ETA
    const now = Date.now();
    const start = eventData.timestamp * 1000;
    const diff = start - now;

    let etaText;
    if (diff <= 0) etaText = 'now';
    else {
      const h = Math.floor(diff / (60 * 60 * 1000));
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      if (h > 0) etaText = m > 0 ? `${h}h ${m}m` : `${h}h`;
      else etaText = `${m}m`;
    }

    const messageId = eventData.messageId || eventData.eventId;
    const link = `https://discord.com/channels/${eventData.guildId}/${eventData.channelId}/${messageId}`;

    const embed = new EmbedBuilder()
    .setTitle(`🔔 [${label}] - ${eventData.title} 🔔`)
    .setURL(link)
    .setDescription(
      `**Starting in <t:${eventData.timestamp}:R>!**\n\n📅 <t:${eventData.timestamp}:F>`
    )
      .setColor(color);

    // Include attendee list if provided
    if (attendees) {
      const fields = [];
      if (attendees.tank?.size) {
        fields.push({
          name: `🛡️ Tank (${attendees.tank.size})`,
          value: Array.from(attendees.tank).join('\n'),
          inline: true
        });
      }
      if (attendees.dps?.size) {
        fields.push({
          name: `⚔️ DPS (${attendees.dps.size})`,
          value: Array.from(attendees.dps).join('\n'),
          inline: true
        });
      }
      if (attendees.support?.size) {
        fields.push({
          name: `💖 Support (${attendees.support.size})`,
          value: Array.from(attendees.support).join('\n'),
          inline: true
        });
      }
      if (fields.length) embed.addFields(fields);
    }

    return embed;
  }
}

module.exports = ReminderScheduler;
