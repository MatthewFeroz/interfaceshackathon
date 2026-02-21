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
  console.log('[init] Wrote mcp-config.json');
}

// ── System prompt ──────────────────────────────────────────────────────────

function writeSystemPrompt(): void {
  const claudeMd = `You are a website builder. Users design layouts visually; you generate the HTML.

## Tools
- get_layout() — returns the page layout as JSON (block types, props, theme, colors)
- show_preview(html) — sends HTML to the live preview iframe
- get_user_feedback() — returns revision requests from the user

## Workflow
1. Call get_layout() to read the page structure.
2. Generate a complete, self-contained HTML document.
3. Call show_preview(html) immediately — speed matters.
4. Call get_user_feedback(). If feedback exists, revise and show_preview() again.

## HTML Quality
- Complete HTML5 document with all CSS in a single <style> tag.
- Use Google Fonts (link in <head>) for professional typography.
- Modern CSS: flexbox, grid, custom properties, smooth transitions.
- Responsive: mobile-first, looks great at all breakpoints.
- Use the accent color from the layout for buttons, links, and highlights.
- Use https://placehold.co/ for any placeholder images.
- Generous whitespace, clear visual hierarchy, polished feel.

## Important
- Be fast. Generate and show_preview() as quickly as possible.
- Use only the user's content — do not invent business details.
- Do not explain what you're doing. Just call the tools and produce the HTML.
`;
  const outPath = path.join(WORKSPACE_DIR, 'CLAUDE.md');
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(outPath, claudeMd);
  console.log('[init] Wrote system prompt');
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

// Health check — includes PTY status
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    pty: {
      running: ptyManager.isRunning(),
      ready: ptyManager.isReady(),
    },
    status: store.getStatus(),
  });
});

// Serve test.html at root for dev testing
app.get('/test', (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'test.html'));
});

// State routes
app.use('/api/state', stateRouter);

// PTY manager
const ptyManager = new PtyManager();

// Auto-restart PTY on crash
ptyManager.on('exit', (exitCode: number, signal: number) => {
  console.log(`[pty] Exited unexpectedly (code=${exitCode}, signal=${signal}), restarting in 2s...`);
  setTimeout(() => {
    if (!ptyManager.isRunning()) {
      ptyManager.start();
    }
  }, 2000);
});

// Save prompt endpoint (for frontend compatibility)
app.post('/api/save-prompt', (req, res) => {
  const { markdown } = req.body;
  if (markdown) {
    const promptPath = path.join(PROJECT_ROOT, 'temp-prompt.md');
    fs.writeFileSync(promptPath, markdown);
  }
  res.json({ ok: true });
});

// PTY start (kept for backward compat — PTY starts eagerly now)
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

// PTY restart
app.post('/api/pty/restart', (_req, res) => {
  try {
    ptyManager.restart();
    res.json({ ok: true });
  } catch (err) {
    console.error('[api] PTY restart failed:', err);
    res.status(500).json({ error: String(err) });
  }
});

// Generate: inject prompt into PTY
app.post('/api/generate', (_req, res) => {
  try {
    if (store.getStatus() !== 'idle') {
      res.status(409).json({ error: 'Generation already in progress' });
      return;
    }

    const layout = store.getLayout();
    if (!layout.blocks.length) {
      res.status(400).json({ error: 'No blocks in layout' });
      return;
    }

    if (!ptyManager.isRunning()) {
      ptyManager.start();
    }

    // Clear previous feedback and set status
    store.clearFeedback();
    store.setStatus('generating');

    const prompt = buildGeneratePrompt(layout);
    console.log('[generate] Injecting prompt (%d chars)', prompt.length);
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
    if (store.getStatus() !== 'idle') {
      res.status(409).json({ error: 'Generation already in progress' });
      return;
    }

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
    store.setStatus('revising');

    const prompt = buildRevisionPrompt(feedback);
    console.log('[revise] Injecting revision (%d chars)', prompt.length);
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
    console.log(`[akita] Backend on http://localhost:${PORT}`);
    console.log(`[akita] Test UI:  http://localhost:${PORT}/test`);

    // Eager PTY startup — Claude Code is ready by the time the user loads the page
    console.log('[akita] Starting Claude Code PTY...');
    ptyManager.start();
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
