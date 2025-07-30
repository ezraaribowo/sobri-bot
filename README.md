# Sobri-Bot v1.0 - Cloudflare Workers Edition

A Discord bot for event management, VFS scheduling, and GvG coordination, now running on Cloudflare Workers for 24/7 availability.

## Features

- **Event Management**: Create and manage VFS and GvG events
- **Role-based Notifications**: Configure role mentions for different event types
- **User Event Tracking**: Users can view their personal events
- **Admin Controls**: Comprehensive admin tools for event management
- **24/7 Uptime**: Runs on Cloudflare Workers with 99.9% uptime
- **Free Hosting**: No server costs with Cloudflare's generous free tier

## Commands

- `/events` - Display upcoming events (VFS, GvG, or all)
- `/vfs` - Create VFS events (Admin only)
- `/gvg` - Create GvG events (Admin only)
- `/myevents` - View your personal events
- `/delete` - Delete an event (Admin only)
- `/remind` - Send manual reminders (Admin only)
- `/setrole` - Configure role mentions (Admin only)
- `/status` - Check bot status
- `/testrole` - Test admin permissions (Admin only)

## Setup Instructions

### 1. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy your bot token and application ID
5. Go to "OAuth2" → "URL Generator"
6. Select scopes: `bot` and `applications.commands`
7. Select bot permissions: `Send Messages`, `Use Slash Commands`, `Manage Messages`
8. Use the generated URL to invite the bot to your server

### 2. Cloudflare Setup

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. Go to Workers & Pages
3. Create a new Worker
4. Note your Account ID (found in the right sidebar)

### 3. KV Namespace Setup

1. In your Cloudflare dashboard, go to Workers & Pages
2. Click on "KV" in the left sidebar
3. Create a new namespace called "sobri-bot-data"
4. Copy the namespace ID

### 4. Project Setup

1. Clone or download this project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Update `wrangler.toml`:
   - Replace `your-kv-namespace-id` with your actual KV namespace ID
   - Replace `your-preview-kv-namespace-id` with your preview namespace ID (create another KV namespace for this)

4. Set up environment variables:
   ```bash
   # Set Discord secrets
   npx wrangler secret put DISCORD_TOKEN
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put DISCORD_APPLICATION_ID
   ```

### 5. Deploy to Cloudflare

1. Deploy the worker:
   ```bash
   npm run deploy
   ```

2. Register Discord commands:
   ```bash
   npm run register
   ```

3. Configure Discord webhook:
   - Go to your Discord application settings
   - Set the "Interactions Endpoint URL" to your Cloudflare Worker URL
   - Example: `https://sobri-bot.your-subdomain.workers.dev`

## Environment Variables

Set these in your Cloudflare Worker:

- `DISCORD_TOKEN` - Your bot token
- `DISCORD_PUBLIC_KEY` - Your application's public key
- `DISCORD_APPLICATION_ID` - Your application ID

## Development

### Local Development

1. Create a `.dev.vars` file with your environment variables:
   ```
   DISCORD_TOKEN=your_bot_token
   DISCORD_PUBLIC_KEY=your_public_key
   DISCORD_APPLICATION_ID=your_application_id
   ```

2. Run locally:
   ```bash
   npm run dev
   ```

3. Use ngrok to expose your local server:
   ```bash
   npx ngrok http 8787
   ```

4. Set the Discord webhook URL to your ngrok URL

### Project Structure

```
src/
├── commands.js          # Discord slash command definitions
├── commandHandlers.js   # Command execution logic
├── server.js           # Main request handler
├── storage.js          # Cloudflare KV storage utilities
├── utils.js            # Utility functions
└── register.js         # Command registration

scripts/
├── register-commands.js # Register commands script
└── delete-commands.js  # Delete commands script

wrangler.toml           # Cloudflare Workers configuration
package.json            # Dependencies and scripts
```

## Usage Examples

### Creating a VFS Event
```
/vfs title:"Daily VFS" datetime:"today 5pm" category:"Public VFS"
```

### Creating a GvG Event
```
/gvg title:"War vs Enemy Guild" datetime:"tomorrow 7pm" opponent:"Enemy Guild" description:"Important war!"
```

### Viewing Events
```
/events type:"vfs"    # View VFS events
/events type:"gvg"    # View GvG events
/events type:"all"    # View all events
```

### Setting Role Mentions
```
/setrole action:"set" category:"vfs" role:@VFS-Role
/setrole action:"view"              # View current config
/setrole action:"clear" category:"vfs" # Clear role config
```

## Troubleshooting

### Common Issues

1. **Commands not appearing**: Make sure you've registered commands and set the correct webhook URL
2. **Permission errors**: Ensure the bot has the required permissions in your Discord server
3. **KV storage errors**: Verify your KV namespace is properly configured in `wrangler.toml`

### Debugging

- Check Cloudflare Workers logs in the dashboard
- Use `npm run dev` for local development with hot reloading
- Verify environment variables are set correctly

## Migration from Node.js Version

If you're migrating from the Node.js version:

1. Your event data will need to be migrated to Cloudflare KV
2. Role configurations will be stored in KV instead of local files
3. The bot will be available 24/7 without server maintenance

## Support

For issues or questions:
1. Check the Cloudflare Workers logs
2. Verify your Discord bot permissions
3. Ensure all environment variables are set correctly

## License

ISC License - See LICENSE file for details.

---

**Sobri-Bot v1.0** - Now running on Cloudflare Workers for maximum uptime and reliability! 🚀 