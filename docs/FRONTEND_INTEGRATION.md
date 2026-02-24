# Frontend Integration Guide for Akita Backend

## Overview

The backend runs on `http://localhost:3001`. The frontend needs to:
1. POST the page layout whenever the user changes it
2. Connect two WebSockets (terminal + UI updates)
3. Call generate/revise endpoints
4. Render the preview HTML and terminal output

## Backend API

Base URL: `http://localhost:3001`

### Layout Schema

The backend expects a `PageLayout` object. This is the **only schema constraint**:

```typescript
interface PageLayout {
  blocks: Block[];         // required, array of component blocks
  theme?: string;          // e.g. "Dark", "Light", "Vibrant", "Warm & Friendly"
  accentColor?: string;    // hex color, e.g. "#F7931A"
  techStack?: string[];    // e.g. ["React", "Tailwind"]
  businessDescription?: string; // free text about the business
}

interface Block {
  id: string;              // unique, e.g. "hero-1", "navbar-2"
  type: string;            // block type (see supported types below)
  props: Record<string, any>; // arbitrary properties — Claude reads these
}
```

**Supported block types:** `hero`, `features`, `pricing`, `testimonials`, `faq`, `contact`, `footer`, `navbar`, `gallery`, `team`, `cta`, `stats`, `logo_cloud`. Unknown types still work — Claude will interpret the name.

**Validation:** The backend validates that `blocks` is an array and each block has `id` (string) and `type` (string). Invalid layouts get a 400 error with a specific message.

**Block props are freeform.** Claude reads them and uses whatever is there. Examples:

```json
{ "id": "hero-1", "type": "hero", "props": { "heading": "Welcome", "subheading": "Best pet store" } }
{ "id": "features-1", "type": "features", "props": { "items": ["Grooming", "Boarding"] } }
{ "id": "pricing-1", "type": "pricing", "props": {} }
{ "id": "footer-1", "type": "footer", "props": { "text": "© 2026 My Business" } }
```

Empty props are fine — Claude will use sensible defaults and produce polished output regardless.

### HTTP Endpoints

#### GET `/api/blocks`
Returns all supported block types with descriptions. Use this to populate the block palette dynamically instead of hardcoding.

```js
const { blocks } = await (await fetch('/api/blocks')).json();
// blocks: [{ type: "hero", description: "full-width hero with headline..." }, ...]
```

#### GET `/api/themes`
Returns all supported themes with descriptions. Use this to populate the theme picker.

```js
const { themes } = await (await fetch('/api/themes')).json();
// themes: [{ name: "Modern", key: "modern", description: "Clean, minimal..." }, ...]
// Use `name` for display, `key` or `name` as the `theme` field in layouts
```

#### GET `/api/templates`
Returns starter layout templates. Each template includes a name, description, theme, accent color, and block list.

```js
const { templates } = await (await fetch('/api/templates')).json();
// templates: [{ id: "saas-landing", name: "SaaS Landing Page", blockCount: 8, blockTypes: [...] }, ...]
```

#### GET `/api/templates/:id`
Returns a full layout for a specific template — ready to POST directly to `/api/state/layout`.

```js
// Load a template and apply it
const layout = await (await fetch('/api/templates/restaurant')).json();
await fetch('/api/state/layout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(layout),
});
// Then call POST /api/generate to build it
```

#### POST `/api/state/layout`
Update the current layout. Call this whenever the user changes anything in the builder.
Returns 400 with error details if the layout is invalid.

```js
const res = await fetch('http://localhost:3001/api/state/layout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    blocks: [
      { id: 'hero-1', type: 'hero', props: { heading: 'My Business' } },
      { id: 'features-1', type: 'features', props: { items: ['Fast', 'Cheap'] } },
    ],
    theme: 'Vibrant',
    accentColor: '#F7931A',
    businessDescription: 'A pet store in Austin, TX.',
  })
});
// On error: { "error": "Block 0: missing or invalid \"type\"" }
```

#### POST `/api/generate`
Trigger website generation. The backend injects a prompt into Claude Code, which calls MCP tools to read the layout and push the preview.

**Smart features:**
- **Layout hash dedup**: If the layout hasn't changed since the last generation and a preview exists, returns `{ ok: true, cached: true }` instantly — no Claude call.
- **Diff-aware regeneration**: If the layout changed (blocks added/removed/reordered, theme changed, etc.), the backend tells Claude exactly what changed so it can update the existing HTML instead of regenerating from scratch. This is faster and preserves design continuity.
- **Stateful iteration**: Claude always reads the existing HTML before making changes. Revisions and layout updates modify the existing page — they never regenerate from scratch. This means edits are faster and you never lose a good design.

**Response codes:**
- `200` — generation started (or `{ cached: true }` if unchanged)
- `400` — no blocks in layout
- `409` — generation already in progress (duplicate click)
- `503` — Claude Code is still starting up

```js
const res = await fetch('http://localhost:3001/api/generate', { method: 'POST' });
const data = await res.json();
if (data.cached) {
  // Layout unchanged — preview is already current, no need to wait
}
if (res.status === 409) {
  // Already generating — show spinner or disable button
}
if (res.status === 503) {
  // PTY not ready — show "Loading..." and retry in a few seconds
}
```

#### POST `/api/revise`
Send user feedback and trigger a revision. Claude will revise the HTML and push an updated preview.

Same response codes as generate (200, 409, 503).

```js
await fetch('http://localhost:3001/api/revise', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ feedback: 'Make the header blue and add a phone number' })
});
```

#### GET `/api/health`
Health check. Includes PTY status and generation status.

```js
const { ok, pty, status } = await (await fetch('/api/health')).json();
// pty.running: boolean — PTY process is alive
// pty.ready: boolean — Claude Code has finished loading
// status: "idle" | "generating" | "revising"
```

#### GET `/api/export`
Download the current preview as an HTML file. Returns 404 if no preview exists yet.

```js
// Trigger download in browser
window.open('http://localhost:3001/api/export', '_blank');
// Or fetch programmatically
const res = await fetch('/api/export');
const html = await res.text(); // Complete HTML document
```

#### GET `/api/state/preview`
Get the current preview HTML (for initial page load or polling).

```js
const { html } = await (await fetch('/api/state/preview')).json();
```

#### Preview Versions

```js
// List all versions (metadata only, no HTML)
const { versions, total } = await (await fetch('/api/state/preview/versions')).json();
// versions: [{ version: 1, timestamp: "2026-02-21T..." }, ...]

// Get a specific version (includes HTML)
const { version, html, timestamp } = await (await fetch('/api/state/preview/versions/1')).json();

// Revert to a previous version (updates preview + broadcasts to all clients)
await fetch('/api/state/preview/revert/1', { method: 'POST' });
```

#### POST `/api/pty/start`
Start the Claude Code terminal. **The backend starts the PTY eagerly on boot**, so you typically don't need this. Kept for manual restart scenarios.

#### POST `/api/pty/restart`
Restart the Claude Code terminal. Use if the PTY seems stuck.

### WebSockets

#### `ws://localhost:3001/ws/terminal`
Raw PTY I/O for the Claude Code terminal panel. Has heartbeat (ping/pong every 30s).

**Server → Browser**: Raw terminal output (escape sequences). Feed directly into xterm.js `terminal.write(data)`.

**Browser → Server**: Either raw keystrokes (forwarded to PTY) or JSON resize commands:
```json
{ "type": "resize", "cols": 120, "rows": 40 }
```

**xterm.js setup:**
```js
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const term = new Terminal({ cursorBlink: true });
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal-container'));
fitAddon.fit();

const ws = new WebSocket('ws://localhost:3001/ws/terminal');
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
};
ws.onmessage = (e) => term.write(e.data);
term.onData((data) => ws.send(data));
term.onResize(({ cols, rows }) => {
  ws.send(JSON.stringify({ type: 'resize', cols, rows }));
});
```

#### `ws://localhost:3001/ws/ui`
JSON messages for UI state updates. Has heartbeat (ping/pong every 30s).

**Messages from server:**

| Type | Payload | When |
|------|---------|------|
| `init` | `{ layout, previewHtml, status }` | On connect |
| `preview:updated` | `{ html, version }` | Claude generates new HTML |
| `status` | `{ status }` | Status changes: `"idle"`, `"generating"`, `"revising"` |
| `progress` | `{ message }` | Progress text updates during generation |

**Status values:**
- `"idle"` — ready for commands
- `"generating"` — Claude is building a website
- `"revising"` — Claude is revising based on feedback

**Progress messages** (sent during generation):
- `"Reading current page..."` — Claude is calling get_current_html()
- `"Reading layout..."` — Claude is calling get_layout()
- `"Generating HTML..."` — Claude is writing code
- `"Rendering preview..."` — Claude is calling show_preview()
- `"Checking for feedback..."` — Claude is calling get_user_feedback()
- `"Retrying generation..."` — Auto-retry after timeout
- `"Error detected — ready to retry"` — MCP error detected

**Full WebSocket handler:**
```js
const uiWs = new WebSocket('ws://localhost:3001/ws/ui');

uiWs.onmessage = (e) => {
  const msg = JSON.parse(e.data);

  switch (msg.type) {
    case 'init':
      // Set initial state (restored from disk on server restart)
      if (msg.payload.previewHtml) {
        iframe.srcdoc = msg.payload.previewHtml;
      }
      updateStatus(msg.payload.status);
      break;

    case 'preview:progress':
      // Work-in-progress HTML — show partial results building up
      iframe.srcdoc = msg.payload.html;
      break;

    case 'preview:updated':
      // Final complete HTML — generation done
      iframe.srcdoc = msg.payload.html;
      // msg.payload.version is the version number
      break;

    case 'status':
      updateStatus(msg.payload.status);
      // "idle" → enable Generate button
      // "generating"/"revising" → show spinner, disable button
      break;

    case 'progress':
      showProgressMessage(msg.payload.message);
      // Show under the preview or in a status bar
      break;
  }
};
```

## Typical User Flow

1. **App loads** → PTY is already running + MCP tools are pre-warmed. Connect `/ws/terminal` for terminal panel. `/ws/ui` sends `init` with current state (restored from previous session if server restarted).
2. **User picks a template** (optional) → `GET /api/templates/saas-landing` → `POST /api/state/layout` with the result
3. **User drags blocks** → `POST /api/state/layout` on every change
4. **User clicks Generate** → `POST /api/generate`
   - If `{ cached: true }`: layout unchanged, preview already current — no wait needed
   - If 409: already generating (disable button based on status WS messages)
   - If 503: PTY not ready (show loading, retry)
5. **Claude works** → `status` WS: `"generating"`. `progress` messages show what's happening. `preview:progress` shows partial HTML building up. Terminal shows Claude working.
6. **Claude finishes** → `preview:updated` on `/ws/ui` → render in iframe. `status` → `"idle"`.
7. **User types feedback** → `POST /api/revise`
8. **Claude revises** → `status` → `"revising"`, then `preview:updated` → iframe updates
9. **User clicks Export** → `GET /api/export` downloads `website.html`
10. **User clicks Undo** → `POST /api/state/preview/revert/:version` restores previous version

## Error Handling

- **Generation timeout**: If Claude takes >90s, the backend auto-retries once, then resets to idle. The frontend will see `status: "idle"` and a progress message `"Generation failed — try again"`.
- **PTY crash**: The backend auto-restarts the PTY after 2s and re-warms MCP tools. The frontend can poll `/api/health` to check `pty.ready`.
- **Duplicate requests**: The 409 response prevents stacking. Use the `status` WS messages to disable the Generate button during generation.
- **State persistence**: Layout and preview versions are saved to disk. If the backend restarts, state is automatically restored. The `init` WS message includes the restored state.

## Mapping the Current Frontend to the Backend

| Frontend State | Backend Field |
|---|---|
| `droppedBlocks` (all sections merged) | `blocks[]` — each dropped block becomes `{ id, type, props }` |
| `selectedTheme` / `FUNNEL_THEMES` | `theme` — the theme name string |
| `accentColor` | `accentColor` |
| `selectedTech` | `techStack` |
| `productDetails` | `businessDescription` |

The `COMPONENT_GROUPS` block IDs in the frontend (like `'navbar'`, `'hero'`, `'pricing'`) map directly to block `type` values.

**Instead of hardcoding these**, use the dynamic endpoints:
- `GET /api/blocks` → populate the block palette
- `GET /api/themes` → populate the theme picker
- `GET /api/templates` → populate a "Start from template" selector

## Running

```bash
# Terminal 1: Backend
cd /path/to/akita
npm run dev

# Terminal 2: Frontend
cd /path/to/akita/frontend
npm run dev
```

Backend: http://localhost:3001
Frontend: http://localhost:5173

## Test UI

Open http://localhost:3001/test for a minimal test UI with terminal, controls, and preview iframe. Use this to verify the backend works independently of the React frontend.
