import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import { PORT, PROJECT_ROOT, WORKSPACE_DIR, MCP_SERVER_DIR, MCP_CONFIG_PATH } from './config.js';
import { store } from './state/store.js';
import { stateRouter } from './state/routes.js';
import { PtyManager } from './pty/manager.js';
import { setupTerminalWs } from './pty/ws-bridge.js';
import { setupUiWs } from './ws/ui.js';
import { buildGeneratePrompt, buildRevisionPrompt } from './prompt/builder.js';

// ── MCP config generation ──────────────────────────────────────────────────

function writeMcpConfig(): void {
  const mcpServerEntry = path.join(MCP_SERVER_DIR, 'dist', 'index.js');
  const config = {
    mcpServers: {
      'akita-builder': {
        command: 'node',
        args: [mcpServerEntry],
        env: {
          AKITA_BACKEND_URL: `http://localhost:${PORT}`,
        },
      },
    },
  };
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('[init] Wrote mcp-config.json:', MCP_CONFIG_PATH);
}

// ── System prompt ──────────────────────────────────────────────────────────

function writeSystemPrompt(): void {
  const claudeMd = `You are a website builder assistant working inside a visual drag-and-drop page builder.

You have three MCP tools:
- get_layout(): Returns the current page layout as JSON. Each block has a type, id, and props.
- show_preview(html): Sends HTML to the preview iframe. Call this to show your work.
- get_user_feedback(): Returns text feedback from the user. Check after generating.

Workflow:
1. Call get_layout() to understand the page structure.
2. Generate a complete, self-contained HTML page with inline CSS.
3. Call show_preview(html) to display it.
4. Call get_user_feedback() to check for revisions.
5. If feedback exists, revise and call show_preview() again.

Rules:
- Always produce valid, complete HTML documents.
- Use modern CSS (flexbox, grid, custom properties). All styles inline in a <style> tag.
- Use https://placehold.co/ for placeholder images.
- Make pages responsive.
- Use only the user's content — do not invent business details.
`;
  const outPath = path.join(WORKSPACE_DIR, 'CLAUDE.md');
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(outPath, claudeMd);
  console.log('[init] Wrote system prompt:', outPath);
}

// ── Express app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS for frontend dev server
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Serve test.html at root for dev testing
app.get('/test', (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'test.html'));
});

// State routes
app.use('/api/state', stateRouter);

// PTY manager
const ptyManager = new PtyManager();

// Save prompt endpoint (for frontend compatibility)
app.post('/api/save-prompt', (req, res) => {
  const { markdown } = req.body;
  if (markdown) {
    const promptPath = path.join(PROJECT_ROOT, 'temp-prompt.md');
    fs.writeFileSync(promptPath, markdown);
    console.log('[api] Saved prompt to', promptPath);
  }
  res.json({ ok: true });
});

// PTY start
app.post('/api/pty/start', (_req, res) => {
  try {
    if (!ptyManager.isRunning()) {
      ptyManager.start();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[api] PTY start failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Generate: inject prompt into PTY
app.post('/api/generate', (_req, res) => {
  try {
    const layout = store.getLayout();
    if (!layout.blocks.length) {
      res.status(400).json({ error: 'No blocks in layout' });
      return;
    }

    if (!ptyManager.isRunning()) {
      ptyManager.start();
    }

    // Clear previous feedback
    store.clearFeedback();

    const prompt = buildGeneratePrompt(layout);
    console.log('[generate] Injecting prompt into PTY:\n', prompt.substring(0, 200) + '...');
    ptyManager.injectPrompt(prompt);

    res.json({ ok: true });
  } catch (err) {
    console.error('[api] Generate failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Revise: post feedback and inject revision prompt into PTY
app.post('/api/revise', (req, res) => {
  try {
    const { feedback } = req.body;
    if (!feedback) {
      res.status(400).json({ error: 'No feedback provided' });
      return;
    }

    if (!ptyManager.isRunning()) {
      res.status(400).json({ error: 'PTY not running — start it and generate first' });
      return;
    }

    // Store feedback so MCP tool can also read it
    store.setFeedback(feedback);

    const prompt = buildRevisionPrompt(feedback);
    console.log('[revise] Injecting revision prompt into PTY:\n', prompt.substring(0, 200) + '...');
    ptyManager.injectPrompt(prompt);

    res.json({ ok: true });
  } catch (err) {
    console.error('[api] Revise failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// ── HTTP + WebSocket server ────────────────────────────────────────────────

const server = http.createServer(app);

const terminalWss = setupTerminalWs(server, ptyManager);
const uiWss = setupUiWs(server);

// Route WebSocket upgrades to the correct WSS by path
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);

  if (pathname === '/ws/terminal') {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/ui') {
    uiWss.handleUpgrade(request, socket, head, (ws) => {
      uiWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ── Startup ────────────────────────────────────────────────────────────────

function startup(): void {
  writeMcpConfig();
  writeSystemPrompt();

  server.listen(PORT, () => {
    console.log(`[akita] Backend running on http://localhost:${PORT}`);
    console.log(`[akita] Terminal WS:   ws://localhost:${PORT}/ws/terminal`);
    console.log(`[akita] UI WS:         ws://localhost:${PORT}/ws/ui`);
    console.log(`[akita] Health:        http://localhost:${PORT}/api/health`);
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────

function cleanup(): void {
  console.log('\n[akita] Shutting down...');
  ptyManager.kill();
  server.close();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startup();
