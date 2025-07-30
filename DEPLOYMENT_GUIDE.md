# Sobri-Bot Deployment Guide

This guide will walk you through deploying your Sobri-Bot to Cloudflare Workers for 24/7 availability.

## Prerequisites

- A Discord account
- A Cloudflare account (free)
- Node.js installed on your computer

## Step 1: Discord Bot Setup

### 1.1 Create Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "Sobri-Bot" and click "Create"

### 1.2 Create Bot
1. In your application, go to the "Bot" section
2. Click "Add Bot"
3. Copy the **Bot Token** (you'll need this later)
4. Copy the **Application ID** (you'll need this later)

### 1.3 Get Public Key
1. In your application, go to "General Information"
2. Copy the **Public Key** (you'll need this later)

### 1.4 Set Bot Permissions
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Manage Messages
   - Read Message History
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

## Step 2: Cloudflare Setup

### 2.1 Create Cloudflare Account
1. Go to [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Create a free account
3. Note your **Account ID** (found in the right sidebar)

### 2.2 Create KV Namespace
1. In your Cloudflare dashboard, go to "Workers & Pages"
2. Click "KV" in the left sidebar
3. Click "Create a namespace"
4. Name it "sobri-bot-data"
5. Copy the **Namespace ID** (you'll need this later)

### 2.3 Create Preview KV Namespace
1. Create another KV namespace called "sobri-bot-data-preview"
2. Copy the **Preview Namespace ID** (you'll need this later)

## Step 3: Configure Project

### 3.1 Update wrangler.toml
1. Open `wrangler.toml` in your project
2. Replace the placeholder values:
   ```toml
   [[kv_namespaces]]
   binding = "SOBRI_BOT_KV"
   id = "YOUR_KV_NAMESPACE_ID"           # Replace with your namespace ID
   preview_id = "YOUR_PREVIEW_NAMESPACE_ID" # Replace with your preview namespace ID
   ```

### 3.2 Set Environment Variables
Run these commands in your project directory:

```bash
# Set Discord Bot Token
npx wrangler secret put DISCORD_TOKEN
# When prompted, enter your bot token

# Set Discord Public Key
npx wrangler secret put DISCORD_PUBLIC_KEY
# When prompted, enter your public key

# Set Discord Application ID
npx wrangler secret put DISCORD_APPLICATION_ID
# When prompted, enter your application ID
```

## Step 4: Deploy to Cloudflare

### 4.1 Deploy the Worker
```bash
npm run deploy
```

This will deploy your bot to Cloudflare Workers. You'll get a URL like:
`https://sobri-bot.your-subdomain.workers.dev`

### 4.2 Register Discord Commands
```bash
npm run register
```

This registers all slash commands with Discord.

### 4.3 Configure Discord Webhook
1. Go back to your Discord application
2. Go to "General Information"
3. Set the **Interactions Endpoint URL** to your Cloudflare Worker URL
4. Example: `https://sobri-bot.your-subdomain.workers.dev`
5. Click "Save Changes"

## Step 5: Test Your Bot

### 5.1 Test Commands
In your Discord server, try these commands:
- `/status` - Should show bot status
- `/testrole` - Should work if you have admin permissions
- `/events type:all` - Should show no events initially

### 5.2 Create Test Event
Try creating a VFS event:
```
/vfs title:"Test Event" datetime:"tomorrow 5pm" category:"Public VFS"
```

## Troubleshooting

### Commands Not Appearing
1. Make sure you ran `npm run register`
2. Check that the webhook URL is set correctly
3. Wait a few minutes for Discord to update

### Permission Errors
1. Ensure the bot has the required permissions in your server
2. Check that you're using the command in a server where the bot is present

### KV Storage Errors
1. Verify your KV namespace IDs in `wrangler.toml`
2. Make sure the namespaces exist in your Cloudflare account

### Bot Not Responding
1. Check the Cloudflare Workers logs in your dashboard
2. Verify all environment variables are set correctly
3. Test the webhook URL manually

## Development

### Local Development
1. Create a `.dev.vars` file:
   ```
   DISCORD_TOKEN=your_bot_token
   DISCORD_PUBLIC_KEY=your_public_key
   DISCORD_APPLICATION_ID=your_application_id
   ```

2. Run locally:
   ```bash
   npm run dev
   ```

3. Use ngrok for testing:
   ```bash
   npx ngrok http 8787
   ```

4. Set the Discord webhook URL to your ngrok URL

## Next Steps

Once your bot is deployed and working:

1. **Configure Role Mentions**: Use `/setrole` to set up role mentions for events
2. **Create Events**: Start creating VFS and GvG events
3. **Monitor Logs**: Check Cloudflare Workers logs for any issues
4. **Customize**: Modify the code to add new features

## Support

If you encounter issues:

1. Check the Cloudflare Workers logs in your dashboard
2. Verify all environment variables are set correctly
3. Test commands in a server where you have admin permissions
4. Check the Discord Developer Portal for any error messages

---

**Congratulations!** Your Sobri-Bot is now running on Cloudflare Workers with 24/7 uptime! 🚀 