// Main Discord bot server for Sobri-Bot Cloudflare Workers
// Handles all Discord interactions and routes to appropriate handlers

import { CommandHandlers } from './commandHandlers.js';
import { registerCommands } from './register.js';

// Verify Discord request signature
async function verifySignature(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();

  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.DISCORD_PUBLIC_KEY);
  const message = encoder.encode(timestamp + body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
    false,
    ['verify']
  );

  const signatureData = new Uint8Array(signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const isValid = await crypto.subtle.verify('NODE-ED25519', cryptoKey, signatureData, message);

  return isValid;
}

// Handle Discord interactions
async function handleInteraction(interaction, env) {
  const commandHandlers = new CommandHandlers(env);
  
  switch (interaction.data.name) {
    case 'events':
      return await commandHandlers.handleEvents(interaction);
    case 'vfs':
      return await commandHandlers.handleVFS(interaction);
    case 'gvg':
      return await commandHandlers.handleGVG(interaction);
    case 'myevents':
      return await commandHandlers.handleMyEvents(interaction);
    case 'delete':
      return await commandHandlers.handleDelete(interaction);
    case 'remind':
      return await commandHandlers.handleRemind(interaction);
    case 'setrole':
      return await commandHandlers.handleSetRole(interaction);
    case 'status':
      return await commandHandlers.handleStatus(interaction);
    case 'testrole':
      return await commandHandlers.handleTestRole(interaction);
    default:
      return {
        type: 4,
        data: {
          content: "❌ Unknown command.",
          flags: 64
        }
      };
  }
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only handle POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Verify the request is from Discord
      const isValid = await verifySignature(request, env);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      // Parse the interaction
      const interaction = await request.json();
      
      // Handle ping (Discord health check)
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle slash commands
      if (interaction.type === 2) {
        const response = await handleInteraction(interaction, env);
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle other interaction types (buttons, select menus, etc.)
      if (interaction.type === 3) {
        // For now, return a simple response
        return new Response(JSON.stringify({
          type: 4,
          data: {
            content: "This interaction type is not yet implemented.",
            flags: 64
          }
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Unknown interaction type', { status: 400 });

    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },

  // Scheduled function for reminders (optional)
  async scheduled(event, env, ctx) {
    // This can be used for scheduled reminders
    // For now, we'll leave it empty
    console.log('Scheduled function called');
  }
}; 