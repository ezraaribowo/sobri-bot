# Event Reminder System

This bot now includes an automatic reminder system for VFS events that will notify users 1 hour before events start, plus a manual reminder command.

## Features

### 1. Automatic Reminders
- **Timing**: Automatically sends reminders 1 hour before each event starts
- **Frequency**: Checks every 5 minutes for upcoming events
- **Target**: Sends reminders to the same channel where the event was originally created
- **Content**: Beautiful embed with event details and countdown

### 2. Manual Reminders
- **Command**: `/remind`
- **Purpose**: Allows event organizers to send reminders at any time
- **Options**: Can include current attendee list in the reminder

## How It Works

### Automatic System
1. When you create a VFS event using `/vfs`, the bot automatically stores the event details
2. The reminder scheduler runs in the background, checking every 5 minutes
3. When an event is 1 hour away (or less), it sends a reminder embed
4. Each event only gets one automatic reminder to avoid spam

### Manual Reminders
1. Use `/remind` command with the message ID of the original event
2. Optionally include current attendees by setting `include_attendees` to `true`
3. The reminder will be sent to the current channel

## Commands

### `/vfs` (Enhanced)
- **What's New**: Now automatically stores events for the reminder system
- **Usage**: Same as before - create events with title, description, datetime, and category
- **Storage**: Event details are saved automatically for reminders

### `/remind` (New)
- **Parameters**:
  - `event_id` (required): The message ID of the original VFS event
  - `include_attendees` (optional): Whether to include current attendee list
- **Usage Examples**:
  - `/remind event_id:1234567890123456789`
  - `/remind event_id:1234567890123456789 include_attendees:true`

## Getting Event IDs

To use the `/remind` command, you need the message ID of the original event:

1. **Desktop Discord**: Right-click the event message → Copy Message ID
2. **Mobile Discord**: Long-press the event message → Copy Message ID
3. **Developer Mode**: Must be enabled in Discord settings to see this option

## Reminder Content

### Automatic Reminders
```
[Event Title] is starting in 1 hour!

📅 [Formatted timestamp]
```
*The event title is a clickable hyperlink that redirects to the original event message*

### Manual Reminders
```
📢 [Event Title] reminder!

📅 [Formatted timestamp]

[Optional: Current attendee lists with roles]

Reminder sent by event organizer
```
*The event title is a clickable hyperlink that redirects to the original event message*

## Data Storage

- Events are stored in `data/events.json`
- Automatic cleanup removes events older than 24 hours
- Storage includes: title, description, timestamp, category, channel info, and reminder status

## System Requirements

- The bot must remain online for automatic reminders to work
- Events are checked every 5 minutes, so reminders may arrive up to 5 minutes early
- Past events are automatically cleaned up daily

## Troubleshooting

### Common Issues

1. **"Event not found" error**:
   - Make sure you're using the correct message ID
   - The event must have been created after the reminder system was installed

2. **No automatic reminders**:
   - Check that the bot is online and running
   - Verify the event was created using `/vfs` command
   - Ensure the event time is in the future

3. **Permission errors**:
   - Bot needs permission to send messages in the event channel
   - Bot needs permission to read message history for attendee extraction

### Getting Help

If you encounter issues:
1. Check the bot's console logs for error messages
2. Verify all required permissions are granted
3. Ensure the bot has been restarted after installing the reminder system

## Technical Details

- **Check Interval**: 5 minutes
- **Reminder Window**: 1 hour before event start
- **Storage Format**: JSON file with event metadata
- **Cleanup Schedule**: Daily removal of events older than 24 hours
- **Error Handling**: Graceful failure with console logging