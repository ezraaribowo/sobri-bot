const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const chrono = require('chrono-node');
const EventStorage = require('../utils/eventStorage');
const PermissionManager = require('../utils/permissions');
const RoleConfigManager = require('../utils/roleConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vfs')
    .setDescription('Set up VFS schedule (Admin only)')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Title of the event')
        .setRequired(true))
    //.addStringOption(option =>
   //   option.setName('description')
     //   .setDescription('Short description of the event')
     //   .setRequired(true))
    .addStringOption(option =>
      option.setName('datetime')
        .setDescription('Date & time (e.g., "today 5pm", "tomorrow 17:00")')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Select event category')
        .addChoices(
          { name: 'Public VFS', value: 'public' },
          { name: 'Guild VFS', value: 'guild' },
          { name: 'Public + Guild VFS', value: 'both' }
        )
        .setRequired(true)),

  async execute(interaction) {
    try {
      // Avoid reprocessing if the interaction was already handled
      if (interaction.replied || interaction.deferred) {
        console.log(`VFS interaction ${interaction.id} already handled, skipping...`);
        return;
      }

      const permissionManager = new PermissionManager();
      if (!permissionManager.hasAdminPermissions(interaction)) {
        await permissionManager.sendPermissionError(interaction);
        return;
      }

      const title = interaction.options.getString('title');
     // const description = interaction.options.getString('description');
      const datetimeInput = interaction.options.getString('datetime');
      const category = interaction.options.getString('category');

      // Parse the date/time input using chrono-node
      const parsedDate = chrono.parseDate(datetimeInput, new Date(), { forwardDate: true });
      if (!parsedDate) {
        return interaction.reply({ content: '❌ Could not parse the given date/time.', ephemeral: true });
      }
      const timestamp = Math.floor(parsedDate.getTime() / 1000);

      // Determine embed color and label based on category
      const colorMap = { public: 0x1abc9c, guild: 0x3498db, both: 0x9b59b6 };
      const embedColor = colorMap[category] || 0x00AE86;
      const label = category === 'both'
        ? 'Public + Guild VFS'
        : (category === 'public' ? 'Public VFS' : 'Guild VFS');

      // Build the event announcement embed
      const embed = new EmbedBuilder()
        .setTitle(`[${label}] - ${title}`)
        //.setDescription(description)
        .addFields(
          { name: '', value: `📅 <t:${timestamp}:F> - ⏰ <t:${timestamp}:R>`, inline: false },
          { name: '🛡️ Tank (0)', value: '\u200B', inline: true },
          { name: '⚔️ DPS (0)', value: '\u200B', inline: true },
          { name: '💖 Support (0)', value: '\u200B', inline: true },
        )
        .setColor(embedColor);

      // Determine if a role mention is configured for this category (VFS events)
      const roleConfig = new RoleConfigManager();
      const roleMention = roleConfig.getRoleMentionForCategory(category);
      const replyContent = roleMention || undefined;

      // Defer the reply to avoid timing out while sending the message
      await interaction.deferReply();
      // Send the event announcement message with the embed
      const message = await interaction.editReply({
        content: replyContent,
        embeds: [embed]
      });

      // If no role mention was included (none configured), alert the admin
      if (!roleMention && permissionManager.hasAdminPermissions(interaction)) {
        await interaction.followUp({
          content: "⚠️ **Admin Notice:** No role mention is configured for VFS events. Use `/setrole vfs` to set one.",
          ephemeral: true
        });
      }

      // Store the new event in persistent storage
      const eventStorage = new EventStorage();
      eventStorage.addEvent(message.id, {
        title,
       // description,
        timestamp,
        category,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        messageId: message.id,
        createdBy: interaction.user.id
      });

      // Add reactions for Tank/DPS/Support roles
      try {
        await message.react('🛡️');
        await message.react('⚔️');
        await message.react('💖');
      } catch (error) {
        console.error('Failed to add reactions:', error);
        // Notify admin that adding reactions failed
        await interaction.followUp({ content: '❌ Failed to set up reactions for this event.', ephemeral: true });
        return;  // Stop here if we can't add reactions
      }

      // Set up a reaction collector to track RSVPs
      const attendees = { tank: new Set(), dps: new Set(), support: new Set() };
      const filter = (reaction, user) => !user.bot && ['🛡️', '⚔️', '💖'].includes(reaction.emoji.name);
      const collector = message.createReactionCollector({ filter, dispose: true, time: 3600000 }); // auto-stop after 1 hour

      const updateFields = () => {
        embed.setTitle(`[${label}] - ${title}`);
        embed.setFields(
          { name: '', value: `📅 <t:${timestamp}:F> - ⏰ <t:${timestamp}:R>`, inline: false },
          { name: `🛡️ Tank (${attendees.tank.size})`, value: attendees.tank.size ? Array.from(attendees.tank).map(u => `> ${u}`).join('\n') : '\u200B', inline: true },
          { name: `⚔️ DPS (${attendees.dps.size})`, value: attendees.dps.size ? Array.from(attendees.dps).map(u => `> ${u}`).join('\n') : '\u200B', inline: true },
          { name: `💖 Support (${attendees.support.size})`, value: attendees.support.size ? Array.from(attendees.support).map(u => `> ${u}`).join('\n') : '\u200B', inline: true }
        );
      };

      const updateMessage = async () => {
        try {
          updateFields();
          await message.edit({ embeds: [embed] });
        } catch (error) {
          console.error('Failed to update VFS message:', error);
          // If updating the message fails, stop the collector to prevent further errors
          collector.stop('message_update_failed');
        }
      };

      // Reaction event handlers:
      collector.on('collect', async (reaction, user) => {
        const mention = `<@${user.id}>`;
        // Remove user from all categories, then add to the one they reacted with
        attendees.tank.delete(mention);
        attendees.dps.delete(mention);
        attendees.support.delete(mention);
        let role = '';
        if (reaction.emoji.name === '🛡️') {
          attendees.tank.add(mention);
          role = 'tank';
        } else if (reaction.emoji.name === '⚔️') {
          attendees.dps.add(mention);
          role = 'dps';
        } else if (reaction.emoji.name === '💖') {
          attendees.support.add(mention);
          role = 'support';
        }
        // Update persistent storage
        try {
          const freshStorage = new EventStorage();
          const success = freshStorage.addUserToRSVP(message.id, user.id, role);
          if (!success) {
            console.error(`Failed to add user ${user.id} as ${role} to event ${message.id}`);
          } else {
            console.log(`✅ User ${user.id} RSVP'd as ${role} for event ${message.id}`);
          }
        } catch (error) {
          console.error('Error updating RSVP storage:', error);
        }
        // Send confirmation DM to the user for their registration
        try {
          const roleNames = { 'tank': 'Tank', 'dps': 'DPS', 'support': 'Support' };
          const roleName = roleNames[role] || 'Unknown';
          const eventLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${message.id}`;
          const dmEmbed = new EmbedBuilder()
            .setTitle(`🏯 Registered for [${label}] - ${title} ✅`)
            .setURL(eventLink)
            //.setDescription(`You have successfully registered for **[${title}](<${eventLink}>)** as **${roleName}**.`)
            .addFields(
              { name: '', value: `📅 <t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false },
              //{ name: '⏰ ', value: `<t:${timestamp}:R>`, inline: false }
            )
            .setColor(0x00ff00)
            .setFooter({ text: "Don't be late and see you there!" });
            //.setTimestamp();
          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error(`Failed to send registration DM to ${user.tag}:`, error);
        }
        await updateMessage();
      });

      collector.on('remove', async (reaction, user) => {
        const mention = `<@${user.id}>`;
        const wasRegistered = attendees.tank.has(mention) || attendees.dps.has(mention) || attendees.support.has(mention);
        // Remove user from the corresponding role set
        if (reaction.emoji.name === '🛡️') attendees.tank.delete(mention);
        if (reaction.emoji.name === '⚔️') attendees.dps.delete(mention);
        if (reaction.emoji.name === '💖') attendees.support.delete(mention);
        const stillRegistered = attendees.tank.has(mention) || attendees.dps.has(mention) || attendees.support.has(mention);
        try {
          const freshStorage = new EventStorage();
          if (wasRegistered && !stillRegistered) {
            // User removed their last reaction (fully unregistered)
            const success = freshStorage.removeUserFromRSVP(message.id, user.id);
            if (success) {
              // Send an unregistration DM
              try {
                const eventLink = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${message.id}`;
                const dmEmbed = new EmbedBuilder()
                  .setTitle(`🏯 Unregistered from [${label}] - ${title} ❌`)
                  .setURL(eventLink)
                  //.setDescription(`You have unregistered from **[${title}](<${eventLink}>)**.`)
                  .setColor(0xff0000)
                  //.setFooter({ text: 'Maybe next time!' })
                 // .setTimestamp();
                await user.send({ embeds: [dmEmbed] });
              } catch (error) {
                console.error(`Failed to send unregistration DM to ${user.tag}:`, error);
              }
            }
          } else if (wasRegistered) {
            // User still has another role reaction; update their role in storage
            let newRole = '';
            if (attendees.tank.has(mention)) newRole = 'tank';
            else if (attendees.dps.has(mention)) newRole = 'dps';
            else if (attendees.support.has(mention)) newRole = 'support';
            if (newRole) {
              const success = freshStorage.addUserToRSVP(message.id, user.id, newRole);
              if (!success) {
                console.error(`Failed to update user ${user.id} role to ${newRole} for event ${message.id}`);
              }
            }
          }
        } catch (error) {
          console.error('Error updating RSVP storage on reaction remove:', error);
        }
        await updateMessage();
      });

      collector.on('end', (collected, reason) => {
        console.log(`VFS collector ended: ${reason} (collected ${collected.size} reactions)`);
      });
    } catch (error) {
      console.error('Error in VFS command:', error);
      let errorContent = '❌ There was an error creating this event.';
      if (error.message && error.message.includes('Unknown interaction')) {
        errorContent = '❌ Command timed out. Please try again.';
      } else if (error.message && error.message.includes('Interaction has already been acknowledged')) {
        console.log('Interaction already acknowledged, skipping error response');
        return;
      }
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorContent, ephemeral: true });
        } else {
          await interaction.reply({ content: errorContent, ephemeral: true });
        }
      } catch (err) {
        console.error('Failed to send error response for VFS command:', err);
      }
    }
  }
};
