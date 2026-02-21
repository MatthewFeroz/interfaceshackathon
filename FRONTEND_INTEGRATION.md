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
  theme?: string;          // e.g. "Dark", "Light", "Vibrant", "Akita"
  accentColor?: string;    // hex color, e.g. "#F7931A"
  techStack?: string[];    // e.g. ["React", "Tailwind"]
  businessDescription?: string; // free text about the business
}

interface Block {
  id: string;              // unique, e.g. "hero-1", "navbar-2"
  type: string;            // block type, e.g. "hero", "navbar", "features", "pricing", "footer", "cta", "testimonials"
  props: Record<string, any>; // arbitrary properties — Claude reads these to understand what to build
}
```

**Block props are freeform.** Claude reads them and uses whatever is there. Examples:

```json
{ "id": "hero-1", "type": "hero", "props": { "heading": "Welcome", "subheading": "Best pet store" } }
{ "id": "features-1", "type": "features", "props": { "items": ["Grooming", "Boarding"] } }
{ "id": "navbar-1", "type": "navbar", "props": { "brand": "Paws & Claws", "links": ["Home", "About"] } }
{ "id": "pricing-1", "type": "pricing", "props": {} }
{ "id": "footer-1", "type": "footer", "props": { "text": "© 2026 My Business" } }
```

The `type` field is the most important — it tells Claude what kind of section to generate. Props give it details to work with, but empty props are fine (Claude will use sensible defaults).

### HTTP Endpoints

#### POST `/api/state/layout`
Update the current layout. Call this whenever the user changes anything in the builder.

```js
await fetch('http://localhost:3001/api/state/layout', {
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
```

#### POST `/api/pty/start`
Start the Claude Code terminal. Call once on app load.

```js
await fetch('http://localhost:3001/api/pty/start', { method: 'POST' });
```

#### POST `/api/generate`
Trigger website generation. Posts latest layout to state first, then call this. The backend injects a prompt into Claude Code, which calls MCP tools to read the layout and push the preview.

```js
await fetch('http://localhost:3001/api/generate', { method: 'POST' });
```

#### POST `/api/revise`
Send user feedback and trigger a revision. Claude will re-read the layout, revise the HTML, and push an updated preview.

```js
await fetch('http://localhost:3001/api/revise', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ feedback: 'Make the header blue and add a phone number' })
});
```

#### GET `/api/state/preview`
Get the current preview HTML (for initial page load).

```js
const res = await fetch('http://localhost:3001/api/state/preview');
const { html } = await res.json(); // html is a complete HTML document string
```

#### GET `/api/health`
Health check.

### WebSockets

#### `ws://localhost:3001/ws/terminal`
Raw PTY I/O for the Claude Code terminal panel.

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
JSON messages for UI state updates.

**Messages from server:**

`init` — sent on connect with current state:
```json
{ "type": "init", "payload": { "layout": { ... }, "previewHtml": "<html>..." } }
```

`preview:updated` — sent whenever Claude generates new HTML:
```json
{ "type": "preview:updated", "payload": { "html": "<html>..." } }
```

**Rendering the preview:**
```js
const uiWs = new WebSocket('ws://localhost:3001/ws/ui');
uiWs.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'preview:updated' || msg.type === 'init') {
    const html = msg.payload.html || msg.payload.previewHtml;
    if (html) {
      document.getElementById('preview-iframe').srcdoc = html;
    }
  }
};
```

## Typical User Flow

1. **App loads** → `POST /api/pty/start` (spawns Claude Code terminal)
2. **User drags blocks** → `POST /api/state/layout` (update layout on every change)
3. **User clicks Generate** → `POST /api/generate` (injects prompt into Claude)
4. **Claude works** → visible in terminal via `/ws/terminal`
5. **Claude finishes** → `preview:updated` fires on `/ws/ui` → render in iframe
6. **User types feedback** → `POST /api/revise` (injects revision prompt)
7. **Claude revises** → another `preview:updated` → iframe updates

## Mapping the Current Frontend to the Backend

The current frontend generates a markdown spec. To integrate with the backend, the frontend needs to translate its internal state into a `PageLayout` object. Here's the mapping:

| Frontend State | Backend Field |
|---|---|
| `droppedBlocks` (all sections merged) | `blocks[]` — each dropped block becomes `{ id, type, props }` |
| `selectedTheme` / `FUNNEL_THEMES` | `theme` — the theme name string |
| `accentColor` | `accentColor` |
| `selectedTech` | `techStack` |
| `productDetails` | `businessDescription` |

The `COMPONENT_GROUPS` block IDs in the frontend (like `'navbar'`, `'hero'`, `'pricing'`) map directly to block `type` values.

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
