const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventStorage = require('../utils/eventStorage');
const PermissionManager = require('../utils/permissions');
const RoleConfigManager = require('../utils/roleConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gvg')
    .setDescription('Set up Guild Wars schedule (Admin only)')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Select Guild Wars round')
        .addChoices(
          { name: 'Round 1', value: 'round1' },
          { name: 'Semifinals', value: 'semifinals' },
          { name: 'Finals', value: 'finals' }
        )
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Select time for Round 1 (only required for Round 1)')
        .addChoices(
          { name: '3:00 PM', value: '15:00' },
          { name: '5:00 PM', value: '17:00' }
        )
        .setRequired(false)),

  async execute(interaction) {
    try {
      // Prevent double handling if the interaction was already responded to
      if (interaction.replied || interaction.deferred) {
        console.log(`GvG interaction ${interaction.id} already handled, skipping...`);
        return;
      }

      const permissionManager = new PermissionManager();
      // Check admin permissions
      if (!permissionManager.hasAdminPermissions(interaction)) {
        await permissionManager.sendPermissionError(interaction);
        return;
      }

      const titleSelection = interaction.options.getString('title');
      const timeSelection = interaction.options.getString('time');

      // Validate title selection
      if (!titleSelection || !['round1', 'semifinals', 'finals'].includes(titleSelection)) {
        return interaction.reply({
          content: '❌ Invalid title selection. Please choose Round 1, Semifinals, or Finals.',
          ephemeral: true
        });
      }

      // Determine event title, base time, and day for Guild Wars based on selection
      let title, eventTime, eventDate;
      if (titleSelection === 'round1') {
        title = 'Round 1';
        eventDate = 'saturday';
        // Require time selection for Round 1
        if (!timeSelection) {
          return interaction.reply({
            content: '❌ Please select a time for Round 1 (3:00 PM or 5:00 PM).',
            ephemeral: true
          });
        }
        if (!['15:00', '17:00'].includes(timeSelection)) {
          return interaction.reply({
            content: '❌ Invalid time selection for Round 1. Please choose 3:00 PM or 5:00 PM.',
            ephemeral: true
          });
        }
        eventTime = timeSelection;
      } else if (titleSelection === 'semifinals') {
        title = 'Semifinals';
        eventTime = '15:00'; // Sunday 3 PM for Semifinals
        eventDate = 'sunday';
      } else if (titleSelection === 'finals') {
        title = 'Finals';
        eventTime = '17:00'; // Sunday 5 PM for Finals
        eventDate = 'sunday';
      }

      // Compute the next occurrence of the target day/time for the event
      const now = new Date();
      const currentDay = now.getDay();
      const targetDay = eventDate === 'saturday' ? 6 : 0; // Saturday=6, Sunday=0
      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
      }
      // Safety check for eventTime (should be set by above logic)
      if (!eventTime) {
        return interaction.reply({
          content: '❌ There was an error determining the event time. Please try again.',
          ephemeral: true
        });
      }
      const [hours, minutes] = eventTime.split(':').map(Number);
      // If target day is today but the time has already passed, schedule for next week
      if (daysUntilTarget === 0) {
        const todayAtTime = new Date(now);
        todayAtTime.setHours(hours, minutes, 0, 0);
        if (now >= todayAtTime) {
          daysUntilTarget = 7;
        }
      }
      const eventDateObj = new Date(now);
      eventDateObj.setDate(now.getDate() + daysUntilTarget);
      eventDateObj.setHours(hours, minutes, 0, 0);
      const timestamp = Math.floor(eventDateObj.getTime() / 1000);

      // Prepare the embed for the Guild Wars event announcement
      const embedColor = 0xFF0000; // Red for Guild Wars events
      const roleConfig = new RoleConfigManager();
      const roleMention = roleConfig.getRoleMentionForCategory('guildwars');
      const replyContent = roleMention || undefined; // mention configured role if available

      const embed = new EmbedBuilder()
        .setTitle(`[GvG] - ${title}`)
        .addFields(
          { name: '', value: `📅 <t:${timestamp}:F> - ⏰ <t:${timestamp}:R>`, inline: false },
          { name: '✅ Yes (0)', value: '\u200B', inline: true },
          { name: '❓ Maybe (0)', value: '\u200B', inline: true },
          { name: '❌ No (0)', value: '\u200B', inline: true }
        )
        .setColor(embedColor);

      // Defer the reply to avoid timeout while sending the message
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }
      // Send the event announcement message (with role mention if configured)
      const message = await interaction.editReply({
        content: replyContent,
        embeds: [embed]
      });

      // If no role was mentioned because none is configured, inform the admin privately
      if (!replyContent && permissionManager.hasAdminPermissions(interaction)) {
        await interaction.followUp({
          content: "⚠️ **Admin Notice:** No role mention is configured for GvG events. Use `/setrole gvg` to set one.",
          ephemeral: true
        });
      }

      // Store the event in persistent storage for reminders and tracking
      const eventStorage = new EventStorage();
      eventStorage.addEvent(message.id, {
        title,
        timestamp,
        category: 'guildwars',
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        messageId: message.id,
        createdBy: interaction.user.id
      });

      // Add reaction options for Yes/Maybe/No RSVPs
      try {
        await message.react('✅');
        await message.react('❓');
        await message.react('❌');
      } catch (error) {
        console.error('Failed to add reactions:', error);
        // Notify the admin that adding reactions failed, but do not abort the command
        await interaction.followUp({ content: '❌ Failed to set up reactions for this event.', ephemeral: true });
        // We return here to avoid setting up collectors without reactions
        return;
      }

      // Use a reaction collector to track RSVP changes in real time
      const attendees = { yes: new Set(), maybe: new Set(), no: new Set() };
      const filter = (reaction, user) => !user.bot && ['✅', '❓', '❌'].includes(reaction.emoji.name);
      const collector = message.createReactionCollector({ filter, dispose: true });

      // Helper to update the embed fields based on current RSVP counts
      const updateFields = () => {
        embed.setTitle(`[GvG] - ${title}`); // update relative time
        embed.setFields(
          { name: '', value: `📅 <t:${timestamp}:F> - ⏰ <t:${timestamp}:R>`, inline: false },
          { name: `✅ Yes (${attendees.yes.size})`, value: attendees.yes.size ? Array.from(attendees.yes).map(u => `> ${u}`).join('\n') : '\u200B', inline: true },
          { name: `❓ Maybe (${attendees.maybe.size})`, value: attendees.maybe.size ? Array.from(attendees.maybe).map(u => `> ${u}`).join('\n') : '\u200B', inline: true },
          { name: `❌ No (${attendees.no.size})`, value: attendees.no.size ? Array.from(attendees.no).map(u => `> ${u}`).join('\n') : '\u200B', inline: true }
        );
      };

      const updateMessage = async () => {
        try {
          updateFields();
          await message.edit({ embeds: [embed] });
        } catch (error) {
          console.error('Failed to update GvG message:', error);
          collector.stop('message_update_failed');
        }
      };

      // DM notification helpers for registrations/unregistrations
      const sendRegistrationDM = async (user, reactionEmoji) => {
        try {
          const responseNames = { '✅': 'Yes', '❓': 'Maybe', '❌': 'No' };
          const responseName = responseNames[reactionEmoji] || 'Unknown';
          const eventLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${message.id}`;
          const dmEmbed = new EmbedBuilder()
            .setTitle(`⚔️ Registered for GvG - [${title}] ✅`)
            .setURL(eventLink)
            //.setDescription(`**[${title}](<${eventLink}>)**`)
            .addFields(
              { name: '', value: `📅 <t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false },
              //{ name: '', value: `⏰ <t:${timestamp}:R>`, inline: false }
            )
            .setColor(0x00ff00)
            .setFooter({ text: "Don't be late and see you there!" });
          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error(`Failed to send registration DM to ${user.tag}:`, error);
        }
      };

      const sendUnregistrationDM = async (user) => {
        try {
          const eventLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${message.id}`;
          const dmEmbed = new EmbedBuilder()
            .setTitle(`⚔️ Unregistered from GvG - [${title}] ❌`)
            .setURL(eventLink)
            //.setDescription(`You have unregistered from **[Guild Wars ${title}](<${eventLink}>)**.`)
            .addFields(
              { name: '', value: `📅 <t:${timestamp}:F>`, inline: false }
            )
            .setColor(0xff0000)
            .setFooter({ text: 'Hope to see you join next time!' })
            //.setTimestamp();
          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error(`Failed to send unregistration DM to ${user.tag}:`, error);
        }
      };

      // Handle a user reacting (joining Yes/Maybe/No)
      collector.on('collect', async (reaction, user) => {
        const mention = `<@${user.id}>`;
        // Remove user from all categories, then add to the selected one
        attendees.yes.delete(mention);
        attendees.maybe.delete(mention);
        attendees.no.delete(mention);
        let responseCategory = '';
        if (reaction.emoji.name === '✅') {
          attendees.yes.add(mention);
          responseCategory = 'yes';
        } else if (reaction.emoji.name === '❓') {
          attendees.maybe.add(mention);
          responseCategory = 'maybe';
        } else if (reaction.emoji.name === '❌') {
          attendees.no.add(mention);
          responseCategory = 'no';
        }
        // Update persistent storage for RSVP
        try {
          const freshStorage = new EventStorage();
          const success = freshStorage.addUserToRSVP(message.id, user.id, responseCategory);
          if (!success) {
            console.error(`Failed to add user ${user.id} to RSVP for event ${message.id}`);
          } else {
            console.log(`✅ Successfully added user ${user.id} as ${responseCategory} to event ${message.id}`);
          }
        } catch (error) {
          console.error('Error updating RSVP storage:', error);
        }
        // Send a confirmation DM for Yes/Maybe responses (skip DM for "No")
        if (reaction.emoji.name === '✅') {
          await sendRegistrationDM(user, reaction.emoji.name);
        }
        await updateMessage();
      });

      // Handle a user removing their reaction (or switching choices)
      collector.on('remove', async (reaction, user) => {
        const mention = `<@${user.id}>`;
        const wasRegistered = attendees.yes.has(mention) || attendees.maybe.has(mention) || attendees.no.has(mention);
        // Remove user from the category corresponding to the removed reaction
        if (reaction.emoji.name === '✅') attendees.yes.delete(mention);
        if (reaction.emoji.name === '❓') attendees.maybe.delete(mention);
        if (reaction.emoji.name === '❌') attendees.no.delete(mention);
        // Check if user is still registered in any category after this removal
        const stillRegistered = attendees.yes.has(mention) || attendees.maybe.has(mention) || attendees.no.has(mention);
        try {
          const freshStorage = new EventStorage();
          if (wasRegistered && !stillRegistered) {
            // User fully unregistered from the event
            const success = freshStorage.removeUserFromRSVP(message.id, user.id);
            if (success) {
              // If they had a Yes/Maybe before (and removed it), send an unregistration DM (No reactions don't trigger a registration DM in the first place)
              if (reaction.emoji.name === '✅' ) {
                await sendUnregistrationDM(user);
              }
            }
          } else if (wasRegistered) {
            // User changed their response (removed one reaction but still has another)
            let newResponse = '';
            if (attendees.yes.has(mention)) newResponse = 'yes';
            else if (attendees.maybe.has(mention)) newResponse = 'maybe';
            else if (attendees.no.has(mention)) newResponse = 'no';
            if (newResponse) {
              const success = freshStorage.addUserToRSVP(message.id, user.id, newResponse);
              if (!success) {
                console.error(`Failed to update user ${user.id} response to ${newResponse} for event ${message.id}`);
              }
            }
          }
        } catch (error) {
          console.error('Error updating RSVP storage on remove:', error);
        }
        await updateMessage();
      });

      collector.on('end', (collected, reason) => {
        console.log(`Guild Wars collector ended: ${reason} (collected ${collected.size} reactions)`);
      });
    } catch (error) {
      console.error('Error in GvG command:', error);
      // Determine an appropriate error message
      let errorContent = '❌ There was an error creating this Guild Wars event.';
      if (error.message && error.message.includes('Unknown interaction')) {
        errorContent = '❌ Command timed out. Please try again.';
      } else if (error.message && error.message.includes('Interaction has already been acknowledged')) {
        // If the interaction was already acknowledged, we avoid sending another reply
        console.log('Interaction already acknowledged, skipping error response');
        return;
      }
      // Send an ephemeral error message to the admin
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorContent, ephemeral: true });
        } else {
          await interaction.reply({ content: errorContent, ephemeral: true });
        }
      } catch (responseError) {
        console.error('Failed to send error response:', responseError);
      }
    }
  }
};
