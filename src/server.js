// Main Discord bot server for Sobri‑Bot Cloudflare Workers
// Handles all Discord interactions and routes to appropriate handlers

import { CommandHandlers } from './commandHandlers.js';
import { registerCommands } from './register.js';

/**
 * Verify Discord request signature.
 *
 * We accept the signature, timestamp and raw body here so the request
 * body only needs to be read once in the fetch handler.  The Discord
 * public key is provided as a hex string; we convert it to bytes.
 */
async function verifySignature(signature, timestamp, body, env) {
  // Convert hex‑encoded public key into a Uint8Array
  const keyData = new Uint8Array(
    env.DISCORD_PUBLIC_KEY.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

  // Encode the timestamp and body into bytes
  const encoder = new TextEncoder();
  const message = encoder.encode(timestamp + body);

  // Import the public key into the Web Crypto API
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
    false,
    ['verify']
  );

  // Convert the hex signature into bytes
  const signatureData = new Uint8Array(
    signature.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  );

  // Verify the Ed25519 signature
  return crypto.subtle.verify('NODE-ED25519', cryptoKey, signatureData, message);
}

/**
 * Execute the appropriate command handler based on the slash command name.
 */
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
          content: '❌ Unknown command.',
          flags: 64
        }
      };
  }
}

export default {
  async fetch(request, env, ctx) {
    // Respond to a GET request (e.g., visiting the worker URL in a browser)
    if (request.method === 'GET') {
      return new Response('Sobri‑Bot worker is up!', { status: 200 });
    }

    // Only handle POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Extract signature headers
      const signature = request.headers.get('x-signature-ed25519');
      const timestamp = request.headers.get('x-signature-timestamp');

      // Read the body ONCE
      const body = await request.text();

      // Verify the signature
      const isValid = await verifySignature(signature, timestamp, body, env);
      if (!isValid) {
     	 return new Response('Invalid signature', { status: 401 });
      }

      // Parse the interaction from the already-read body
      const interaction = JSON.parse(body);

      // Respond to Discord's health check (PING)
      if (interaction.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Respond to slash commands
      if (interaction.type === 2) {
        const response = await handleInteraction(interaction, env);
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Respond to other interaction types (buttons, selects, etc.)
      if (interaction.type === 3) {
        return new Response(
          JSON.stringify({
            type: 4,
            data: {
              content: 'This interaction type is not yet implemented.',
              flags: 64
            }
          }),
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response('Unknown interaction type', { status: 400 });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },

  // Optional scheduled handler for reminders
  async scheduled(event, env, ctx) {
    console.log('Scheduled function called');
    // Implement scheduled tasks here if desired
  }
};
