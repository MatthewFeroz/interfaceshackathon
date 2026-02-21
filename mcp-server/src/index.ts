import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BACKEND_URL = process.env.AKITA_BACKEND_URL || 'http://localhost:3001';

function log(...args: unknown[]): void {
  console.error('[mcp-server]', ...args);
}

async function fetchJson(path: string, options?: RequestInit): Promise<unknown> {
  const url = `${BACKEND_URL}${path}`;
  log(`${options?.method || 'GET'} ${url}`);
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const server = new McpServer({
  name: 'akita-builder',
  version: '1.0.0',
});

// Tool: get_layout
server.tool(
  'get_layout',
  'Returns the current page layout as JSON. Each block has a type, id, and props.',
  {},
  async () => {
    try {
      const layout = await fetchJson('/api/state/layout');
      return {
        content: [{ type: 'text', text: JSON.stringify(layout, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching layout: ${err}` }],
        isError: true,
      };
    }
  },
);

// Tool: show_preview
server.tool(
  'show_preview',
  'Sends HTML to the preview iframe. Call this to show your generated website.',
  { html: z.string().describe('The complete HTML document to preview') },
  async ({ html }) => {
    try {
      await fetchJson('/api/state/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });
      return {
        content: [{ type: 'text', text: 'Preview updated successfully.' }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error updating preview: ${err}` }],
        isError: true,
      };
    }
  },
);

// Tool: get_current_html
server.tool(
  'get_current_html',
  'Returns the current preview HTML. Use this to read your previous output before making edits.',
  {},
  async () => {
    try {
      const data = await fetchJson('/api/state/preview') as { html: string };
      const html = data.html || '';
      return {
        content: [{
          type: 'text',
          text: html
            ? html
            : 'No preview exists yet. Generate from scratch.',
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching preview: ${err}` }],
        isError: true,
      };
    }
  },
);

// Tool: get_user_feedback
server.tool(
  'get_user_feedback',
  'Returns text feedback from the user. Check after generating to see if revisions are needed.',
  {},
  async () => {
    try {
      const data = await fetchJson('/api/state/feedback') as { feedback: string };
      const feedback = data.feedback || '';
      return {
        content: [{
          type: 'text',
          text: feedback
            ? `User feedback: ${feedback}`
            : 'No feedback from user yet.',
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error fetching feedback: ${err}` }],
        isError: true,
      };
    }
  },
);

async function main() {
  log('Starting akita-builder MCP server...');
  log('Backend URL:', BACKEND_URL);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('MCP server connected via stdio');
}

main().catch((err) => {
  log('Fatal error:', err);
  process.exit(1);
});
