import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import { PORT, PROJECT_ROOT, WORKSPACE_DIR, MCP_SERVER_DIR, MCP_CONFIG_PATH } from './config.js';
import { store } from './state/store.js';
import { stateRouter } from './state/routes.js';
import { PtyManager } from './pty/manager.js';
import { setupTerminalWs } from './pty/ws-bridge.js';
import { setupUiWs } from './ws/ui.js';
import { buildGeneratePrompt, buildRevisionPrompt, BLOCK_HINTS, THEME_STYLES } from './prompt/builder.js';

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
- get_current_html() — returns your previous HTML output. ALWAYS call this before editing.
- show_preview(html) — sends HTML to the live preview iframe
- get_user_feedback() — returns revision requests from the user

## Workflow — FIRST generation (no existing preview)
1. Call get_layout() to read the page structure.
2. Generate a complete, self-contained HTML document.
3. Call show_preview(html) immediately — speed matters.
4. Call get_user_feedback(). If feedback exists, revise and show_preview() again.

## Workflow — SUBSEQUENT edits (preview already exists)
1. Call get_current_html() to get the existing HTML.
2. Call get_layout() to see what changed.
3. MODIFY the existing HTML — do NOT regenerate from scratch.
4. Call show_preview(html) with the updated HTML.
5. Call get_user_feedback(). If feedback exists, revise and show_preview() again.

## CRITICAL: Always Build on Existing Work
- If a preview already exists, your job is to EDIT it, not replace it.
- Preserve all existing design decisions, colors, spacing, and content.
- Only change what the user explicitly asked to change (or what the layout diff requires).
- This is faster for you and better for the user — they don't lose work.

## HTML Rules
- Complete HTML5 document. ALL CSS in a single \`<style>\` tag in \`<head>\`.
- NO external CSS frameworks. Write all CSS from scratch.
- Link ONE Google Font in \`<head>\` — choose based on theme.
- Use CSS custom properties: \`--accent\`, \`--bg\`, \`--text\`, \`--muted\`.
- Modern CSS: flexbox, grid, \`clamp()\`, smooth transitions.
- Responsive: mobile-first, \`max-width: 1200px\` container.
- Use \`https://placehold.co/\` for placeholder images.
- Generous whitespace. Clear visual hierarchy. Subtle polish (shadows, radius, hover effects).

## Important
- Be fast. Generate and call show_preview() as quickly as possible.
- Use only the user's content — do not invent business names or details not in the layout.
- Do not explain what you're doing. Just call the tools and produce the HTML.
- Keep the HTML under 15KB. Be concise with CSS.
- On revisions: ALWAYS call get_current_html() first. Edit the existing HTML. Never regenerate from scratch.
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    pty: { running: ptyManager.isRunning(), ready: ptyManager.isReady() },
    status: store.getStatus(),
  });
});

// Serve test.html for dev testing
app.get('/test', (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'test.html'));
});

// Block schema
app.get('/api/blocks', (_req, res) => {
  const blocks = Object.entries(BLOCK_HINTS).map(([type, description]) => ({ type, description }));
  res.json({ blocks });
});

// Theme list
app.get('/api/themes', (_req, res) => {
  const themes = Object.entries(THEME_STYLES).map(([name, description]) => ({
    name: name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    key: name,
    description,
  }));
  res.json({ themes });
});

// Layout templates
const TEMPLATES = [
  {
    id: 'saas-landing',
    name: 'SaaS Landing Page',
    description: 'Hero, features, pricing, testimonials, CTA, and footer',
    theme: 'Modern',
    accentColor: '#6366F1',
    blocks: [
      { id: 'navbar-1', type: 'navbar', props: {} },
      { id: 'hero-1', type: 'hero', props: { heading: 'Your Product Name', subheading: 'One line that explains your value proposition' } },
      { id: 'logo_cloud-1', type: 'logo_cloud', props: {} },
      { id: 'features-1', type: 'features', props: {} },
      { id: 'pricing-1', type: 'pricing', props: {} },
      { id: 'testimonials-1', type: 'testimonials', props: {} },
      { id: 'cta-1', type: 'cta', props: {} },
      { id: 'footer-1', type: 'footer', props: {} },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Warm and inviting with menu, gallery, and contact info',
    theme: 'Warm & Friendly',
    accentColor: '#D97706',
    blocks: [
      { id: 'navbar-1', type: 'navbar', props: {} },
      { id: 'hero-1', type: 'hero', props: { heading: 'Restaurant Name', subheading: 'Farm-to-table dining experience' } },
      { id: 'features-1', type: 'features', props: { title: 'Our Specialties' } },
      { id: 'gallery-1', type: 'gallery', props: {} },
      { id: 'testimonials-1', type: 'testimonials', props: {} },
      { id: 'contact-1', type: 'contact', props: {} },
      { id: 'footer-1', type: 'footer', props: {} },
    ],
  },
  {
    id: 'portfolio',
    name: 'Creative Portfolio',
    description: 'Bold showcase for freelancers and agencies',
    theme: 'Bold',
    accentColor: '#EC4899',
    blocks: [
      { id: 'navbar-1', type: 'navbar', props: {} },
      { id: 'hero-1', type: 'hero', props: { heading: 'Your Name', subheading: 'Designer / Developer / Creator' } },
      { id: 'gallery-1', type: 'gallery', props: { title: 'Selected Work' } },
      { id: 'stats-1', type: 'stats', props: {} },
      { id: 'testimonials-1', type: 'testimonials', props: {} },
      { id: 'contact-1', type: 'contact', props: {} },
      { id: 'footer-1', type: 'footer', props: {} },
    ],
  },
  {
    id: 'startup',
    name: 'Tech Startup',
    description: 'Dark, modern, and high-energy with stats and social proof',
    theme: 'Tech Startup',
    accentColor: '#8B5CF6',
    blocks: [
      { id: 'navbar-1', type: 'navbar', props: {} },
      { id: 'hero-1', type: 'hero', props: { heading: 'Product Name', subheading: 'The next generation platform for developers' } },
      { id: 'features-1', type: 'features', props: {} },
      { id: 'stats-1', type: 'stats', props: {} },
      { id: 'pricing-1', type: 'pricing', props: {} },
      { id: 'faq-1', type: 'faq', props: {} },
      { id: 'cta-1', type: 'cta', props: {} },
      { id: 'footer-1', type: 'footer', props: {} },
    ],
  },
];

app.get('/api/templates', (_req, res) => {
  const list = TEMPLATES.map(({ id, name, description, theme, accentColor, blocks }) => ({
    id, name, description, theme, accentColor, blockCount: blocks.length,
    blockTypes: blocks.map(b => b.type),
  }));
  res.json({ templates: list });
});

app.get('/api/templates/:id', (req, res) => {
  const template = TEMPLATES.find(t => t.id === req.params.id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }
  const { id: _id, name: _name, description: _desc, ...layout } = template;
  res.json(layout);
});

// Reset — clear all state and start fresh
app.post('/api/reset', (_req, res) => {
  store.reset();
  lastGeneratedHash = '';
  res.json({ ok: true });
});

// State routes
app.use('/api/state', stateRouter);

// PTY manager
const ptyManager = new PtyManager();

// Parse PTY output for progress signals
ptyManager.on('data', (data: string) => {
  if (store.getStatus() === 'idle') return;
  const text = data.toLowerCase();
  if (text.includes('get_current_html')) {
    store.emitProgress('Reading current page...');
  } else if (text.includes('get_layout')) {
    store.emitProgress('Reading layout...');
  } else if (text.includes('show_preview')) {
    store.emitProgress('Rendering preview...');
  } else if (text.includes('get_user_feedback')) {
    store.emitProgress('Checking for feedback...');
  }
});

// Warm PTY cache — tracks whether warmup has been sent
let warmupDone = false;

// Auto-restart PTY on crash
ptyManager.on('exit', (exitCode: number, signal: number) => {
  console.log(`[pty] Exited unexpectedly (code=${exitCode}, signal=${signal}), restarting in 2s...`);
  warmupDone = false;
  setTimeout(() => {
    if (!ptyManager.isRunning()) ptyManager.start();
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

// PTY start (kept for manual restart scenarios)
app.post('/api/pty/start', (_req, res) => {
  try {
    if (!ptyManager.isRunning()) ptyManager.start();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PTY restart
app.post('/api/pty/restart', (_req, res) => {
  try {
    ptyManager.restart();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Layout hash for deduplication
let lastGeneratedHash = '';

function hashLayout(layout: import('./state/store.js').PageLayout): string {
  return crypto.createHash('md5').update(JSON.stringify(layout)).digest('hex');
}

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

    // Skip if layout unchanged and preview exists
    const layoutHash = hashLayout(layout);
    if (layoutHash === lastGeneratedHash && store.getPreviewHtml()) {
      res.json({ ok: true, cached: true });
      return;
    }

    if (!ptyManager.isRunning()) ptyManager.start();
    if (!ptyManager.isReady()) {
      res.status(503).json({ error: 'Claude Code is still starting up — try again in a few seconds' });
      return;
    }

    store.clearFeedback();
    store.setStatus('generating');
    lastGeneratedHash = layoutHash;

    const prompt = buildGeneratePrompt(layout, !!store.getPreviewHtml());
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

ptyManager.on('ready', () => {
  if (warmupDone) return;
  warmupDone = true;
  console.log('[warmup] PTY ready — warming up MCP tools...');
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
  store.restore();

  server.listen(PORT, () => {
    console.log(`[akita] Backend on http://localhost:${PORT}`);
    console.log(`[akita] Test UI:  http://localhost:${PORT}/test`);
    console.log('[akita] Starting Claude Code PTY...');
    ptyManager.start();
  });
}

function cleanup(): void {
  console.log('\n[akita] Shutting down...');
  ptyManager.kill();
  server.close();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startup();
