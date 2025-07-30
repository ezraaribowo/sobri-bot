// Cloudflare Workers entry point for Discord bot
// Enhanced version to handle Discord interactions properly

// Simple command handler for webhook-based interactions
const commands = {
  remind: {
    description: 'Send a manual reminder for an event (Admin only)',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "✅ Reminder functionality - This would integrate with your reminder system",
          flags: 64 // Ephemeral
        }
      };
    }
  },
  events: {
    description: 'Create a new event',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "📅 Event creation - This would integrate with your event system",
          flags: 64
        }
      };
    }
  },
  status: {
    description: 'Check bot status',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "🟢 Bot is running on Cloudflare Workers!",
          flags: 64
        }
      };
    }
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle Discord webhook verification
    if (request.method === 'POST' && url.pathname === '/discord') {
      try {
        const body = await request.json();
        
        // Handle Discord interaction
        if (body.type === 1) { // PING
          return new Response(JSON.stringify({ type: 1 }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.type === 2) { // APPLICATION_COMMAND
          const commandName = body.data.name;
          const command = commands[commandName];
          
          if (command) {
            try {
              const response = await command.execute(body);
              return new Response(JSON.stringify(response), {
                headers: { 'Content-Type': 'application/json' }
              });
            } catch (error) {
              console.error(`Error executing command ${commandName}:`, error);
              return new Response(JSON.stringify({
                type: 4,
                data: {
                  content: "❌ An error occurred while executing the command.",
                  flags: 64
                }
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } else {
            return new Response(JSON.stringify({
              type: 4,
              data: {
                content: `❌ Command "${commandName}" not found.`,
                flags: 64
              }
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Handle autocomplete
        if (body.type === 3) { // APPLICATION_COMMAND_AUTOCOMPLETE
          const commandName = body.data.name;
          const command = commands[commandName];
          
          if (command && command.autocomplete) {
            try {
              const response = await command.autocomplete(body);
              return new Response(JSON.stringify(response), {
                headers: { 'Content-Type': 'application/json' }
              });
            } catch (error) {
              console.error(`Error in autocomplete for ${commandName}:`, error);
              return new Response(JSON.stringify({
                type: 8,
                data: {
                  choices: []
                }
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
          
          return new Response(JSON.stringify({
            type: 8,
            data: {
              choices: []
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error processing Discord interaction:', error);
        return new Response('Error processing request', { status: 500 });
      }
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: 'Cloudflare Workers',
        commands: Object.keys(commands)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Root endpoint with info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        message: 'Sobri-Bot Discord Bot',
        status: 'Running on Cloudflare Workers',
        endpoints: {
          discord: '/discord',
          health: '/health'
        },
        commands: Object.keys(commands)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
}; 