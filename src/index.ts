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

## HTML Rules — Follow These Exactly
- Complete HTML5 document. ALL CSS in a single \`<style>\` tag in \`<head>\`.
- NO external CSS frameworks (no Tailwind, Bootstrap, etc.). Write all CSS from scratch.
- Link ONE Google Font in \`<head>\` — choose based on theme (e.g., Inter for clean/modern, Playfair Display for elegant, Space Grotesk for tech).
- Use CSS custom properties for colors. Define \`--accent\`, \`--bg\`, \`--text\`, \`--muted\` from the layout's accent color.
- Use the accent color for: primary buttons, links, gradients, highlights, hover states.
- Derive complementary colors from the accent (lighter tints for backgrounds, darker shades for hover).
- Modern CSS: flexbox, grid, \`clamp()\` for fluid typography, smooth transitions.
- Responsive: mobile-first. Use \`max-width: 1200px\` container. Stack on mobile, grid on desktop.
- Use \`https://placehold.co/\` for placeholder images with descriptive dimensions (e.g., 600x400).
- Generous whitespace: sections get \`padding: 5rem 0\` minimum. Cards get \`padding: 2rem\`.
- Clear visual hierarchy: one dominant headline per section, supporting text in muted color.
- Subtle polish: box-shadow on cards, border-radius, hover lift effects, smooth color transitions.
- Scroll smoothly: add \`html { scroll-behavior: smooth; }\`.

## Design Principles — Make Every Output Look Premium
- Your output should look like it was designed by a professional agency, not a template.
- Every section should feel intentional. Even if the user gives minimal input, produce a stunning result.
- White space is your best friend. Sections need room to breathe — never cram content.
- Use ONE dominant visual technique per hero: gradient overlay, subtle pattern, large typography, or image background. Not all at once.

## Section-Specific Design Patterns
- **Hero**: Full-viewport height (\`min-height: 100vh\`). Centered content. Gradient or solid background using accent color. One primary CTA button, optionally one ghost/outline secondary button.
- **Features**: 3-column grid on desktop (2 on tablet, 1 on mobile). Each card: icon/emoji at top, bold title, 1-2 line description. Subtle card background (\`#f8f9fa\` or slight accent tint). Hover: lift with \`transform: translateY(-4px)\` and shadow.
- **Pricing**: Side-by-side cards. Highlight one as "Popular" with accent background or border. Include checkmark lists. Price in large bold text.
- **Testimonials**: Quote marks or stars. Avatar circles (use placehold.co/80x80). Italic quote text. Name and role below.
- **Footer**: Dark background (\`#1a1a2e\` or similar dark tone). Light text. 3-4 columns. Subtle hover on links.
- **CTA banners**: Accent background, white text, centered, single clear action button.
- **Contact**: Split layout — info on left, form on right. Styled inputs with focus states.

## Visual Polish Checklist (apply to every output)
- \`box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)\` on cards
- \`border-radius: 12px\` on cards, \`8px\` on buttons, \`6px\` on inputs
- \`transition: all 0.2s ease\` on interactive elements
- Hover states on ALL buttons and links (color shift or lift)
- \`letter-spacing: -0.02em\` on large headings for tighter feel
- \`line-height: 1.6\` on body text, \`1.2\` on headings
- \`max-width: 1200px; margin: 0 auto; padding: 0 1.5rem\` container pattern
- Subtle separator between sections (border-top or background color alternation)

## Important
- Be fast. Generate and call show_preview() as quickly as possible.
- Use only the user's content — do not invent business names or details not in the layout.
- Do not explain what you're doing. Just call the tools and produce the HTML.
- Keep the HTML under 15KB. Be concise with CSS — avoid redundant rules.
- On revisions: change ONLY what was requested. Do not regenerate from scratch.
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

// Parse PTY output for progress signals
ptyManager.on('data', (data: string) => {
  if (store.getStatus() === 'idle') return;
  const text = data.toLowerCase();
  if (text.includes('get_layout')) {
    store.emitProgress('Reading layout...');
  } else if (text.includes('show_preview')) {
    store.emitProgress('Rendering preview...');
  } else if (text.includes('get_user_feedback')) {
    store.emitProgress('Checking for feedback...');
  } else if (text.includes('thinking') || text.includes('generating')) {
    store.emitProgress('Generating HTML...');
  }
});

// Auto-retry on generation timeout (one attempt)
let retryCount = 0;
const MAX_RETRIES = 1;

store.on('generation:timeout', () => {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(`[retry] Generation timed out, retrying (attempt ${retryCount})...`);
    store.emitProgress('Retrying generation...');

    const layout = store.getLayout();
    if (layout.blocks.length && ptyManager.isReady()) {
      store.setStatus('generating');
      const prompt = buildGeneratePrompt(layout);
      ptyManager.injectPrompt(prompt);
    }
  } else {
    console.log('[retry] Max retries reached, giving up');
    store.emitProgress('Generation failed — try again');
  }
});

// Reset retry count when generation succeeds
store.on('preview:updated', () => {
  retryCount = 0;
});

// Detect errors in PTY output and reset status
ptyManager.on('data', (data: string) => {
  if (store.getStatus() === 'idle') return;
  const text = data.toLowerCase();
  if (text.includes('error') && (text.includes('mcp') || text.includes('tool') || text.includes('failed'))) {
    console.log('[error-detect] Detected error in PTY output, resetting status');
    store.emitProgress('Error detected — ready to retry');
    store.setStatus('idle');
  }
});

// Warm PTY cache — tracks whether warmup has been sent (declared early, used by exit + ready handlers)
let warmupDone = false;

// Auto-restart PTY on crash
ptyManager.on('exit', (exitCode: number, signal: number) => {
  console.log(`[pty] Exited unexpectedly (code=${exitCode}, signal=${signal}), restarting in 2s...`);
  warmupDone = false; // Re-warm after restart
  setTimeout(() => {
    if (!ptyManager.isRunning()) {
      ptyManager.start();
    }
  }, 2000);
});

// Export generated HTML as downloadable file
app.get('/api/export', (_req, res) => {
  const html = store.getPreviewHtml();
  if (!html) {
    res.status(404).json({ error: 'No preview to export — generate first' });
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="website.html"');
  res.send(html);
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

    if (!ptyManager.isReady()) {
      res.status(503).json({ error: 'Claude Code is still starting up — try again in a few seconds' });
      return;
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

    if (!ptyManager.isRunning() || !ptyManager.isReady()) {
      res.status(503).json({ error: 'Claude Code is not ready — generate first' });
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

// ── Warm PTY cache ─────────────────────────────────────────────────────────

// On first ready, inject a lightweight warmup prompt to force MCP tool loading.
// This makes the first real generation faster since tools are already cached.
ptyManager.on('ready', () => {
  if (warmupDone) return;
  warmupDone = true;

  console.log('[warmup] PTY ready — warming up MCP tools...');
  // Small delay to let Claude fully settle after showing the prompt
  setTimeout(() => {
    if (ptyManager.isReady()) {
      ptyManager.injectPrompt('Call get_layout() to verify tools are connected. Just call the tool and say "Ready." Nothing else.');
      console.log('[warmup] Warmup prompt injected');
    }
  }, 1000);
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
