// Discord slash command definitions for Sobri-Bot
// Adapted for Cloudflare Workers environment

export const commands = [
  {
    name: 'events',
    description: 'Display upcoming events list',
    options: [
      {
        name: 'type',
        description: 'Filter events by type',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'VFS Events', value: 'vfs' },
          { name: 'GvG Events', value: 'gvg' },
          { name: 'All Events', value: 'all' }
        ]
      }
    ]
  },
  {
    name: 'vfs',
    description: 'Set up VFS schedule (Admin only)',
    options: [
      {
        name: 'title',
        description: 'Title of the event',
        type: 3, // STRING
        required: true
      },
      {
        name: 'datetime',
        description: 'Date & time (e.g., "today 5pm", "tomorrow 17:00")',
        type: 3, // STRING
        required: true
      },
      {
        name: 'category',
        description: 'Select event category',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Public VFS', value: 'public' },
          { name: 'Guild VFS', value: 'guild' },
          { name: 'Public + Guild VFS', value: 'both' }
        ]
      }
    ]
  },
  {
    name: 'gvg',
    description: 'Set up GvG event (Admin only)',
    options: [
      {
        name: 'title',
        description: 'Title of the GvG event',
        type: 3, // STRING
        required: true
      },
      {
        name: 'datetime',
        description: 'Date & time (e.g., "today 5pm", "tomorrow 17:00")',
        type: 3, // STRING
        required: true
      },
      {
        name: 'opponent',
        description: 'Opponent guild name',
        type: 3, // STRING
        required: true
      },
      {
        name: 'description',
        description: 'Event description',
        type: 3, // STRING
        required: false
      }
    ]
  },
  {
    name: 'myevents',
    description: 'View your personal events',
    options: []
  },
  {
    name: 'delete',
    description: 'Delete an event (Admin only)',
    options: [
      {
        name: 'event_id',
        description: 'Event ID to delete',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'remind',
    description: 'Send a manual reminder for an event (Admin only)',
    options: [
      {
        name: 'event_id',
        description: 'Event ID to remind about',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'setrole',
    description: 'Configure role mentions for events (Admin only)',
    options: [
      {
        name: 'action',
        description: 'Action to perform',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Set Role', value: 'set' },
          { name: 'View Config', value: 'view' },
          { name: 'Clear Role', value: 'clear' }
        ]
      },
      {
        name: 'category',
        description: 'Event category',
        type: 3, // STRING
        required: false,
        choices: [
          { name: 'VFS Events', value: 'vfs' },
          { name: 'GvG Events', value: 'gvg' }
        ]
      },
      {
        name: 'role',
        description: 'Role to mention (for set action)',
        type: 8, // ROLE
        required: false
      }
    ]
  },
  {
    name: 'status',
    description: 'Check bot status and statistics',
    options: []
  },
  {
    name: 'testrole',
    description: 'Test role permissions (Admin only)',
    options: []
  }
]; 