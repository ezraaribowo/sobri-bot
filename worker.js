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
          content: "🟢 Bot is running on Cloudflare Workers! Status: Online 24/7",
          flags: 64
        }
      };
    }
  },
  gvg: {
    description: 'GvG event management',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "⚔️ GvG functionality - This would integrate with your GvG system",
          flags: 64
        }
      };
    }
  },
  myevents: {
    description: 'View your events',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "📋 Your events - This would show your personal events",
          flags: 64
        }
      };
    }
  },
  setrole: {
    description: 'Set role permissions',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "👑 Role management - This would handle role permissions",
          flags: 64
        }
      };
    }
  },
  vfs: {
    description: 'VFS functionality',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "🎮 VFS functionality - This would handle VFS-related features",
          flags: 64
        }
      };
    }
  },
  delete: {
    description: 'Delete events or data',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "🗑️ Delete functionality - This would handle deletions",
          flags: 64
        }
      };
    }
  },
  testrole: {
    description: 'Test role permissions',
    execute: async (interaction) => {
      return {
        type: 4,
        data: {
          content: "🧪 Role testing - This would test role permissions",
          flags: 64
        }
      };
    }
  }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle Discord webhook verification at root path
    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '/discord')) {
      try {
        // Check if request has content
        const contentType = request.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return new Response('Invalid content type', { status: 400 });
        }

        const body = await request.json();
        
        // Handle Discord interaction
        if (body.type === 1) { // PING
          console.log('Received Discord PING');
          return new Response(JSON.stringify({ type: 1 }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          });
        }
        
        if (body.type === 2) { // APPLICATION_COMMAND
          const commandName = body.data.name;
          const command = commands[commandName];
          
          if (command) {
            try {
              const response = await command.execute(body);
              return new Response(JSON.stringify(response), {
                status: 200,
                headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                }
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
                status: 200,
                headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                }
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
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              }
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
                status: 200,
                headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                }
              });
            } catch (error) {
              console.error(`Error in autocomplete for ${commandName}:`, error);
              return new Response(JSON.stringify({
                type: 8,
                data: {
                  choices: []
                }
              }), {
                status: 200,
                headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type'
                }
              });
            }
          }
          
          return new Response(JSON.stringify({
            type: 8,
            data: {
              choices: []
            }
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            }
          });
        }
        
        return new Response('OK', { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      } catch (error) {
        console.error('Error processing Discord interaction:', error);
        return new Response('Error processing request', { status: 500 });
      }
    }
    
    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS' && (url.pathname === '/' || url.pathname === '/discord')) {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: 'Cloudflare Workers',
        uptime: '24/7',
        commands: Object.keys(commands)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Root endpoint with info (only for GET requests)
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'Sobri-Bot Discord Bot',
        status: 'Running on Cloudflare Workers - 24/7',
        uptime: 'Always Online',
        endpoints: {
          discord: '/',
          health: '/health'
        },
        commands: Object.keys(commands),
        deployment: 'Cloudflare Workers'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
}; 