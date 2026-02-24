# Akita PRD — Visual Website Builder with AI Agent

## Vision

Non-technical small business owners drag component blocks into a layout and watch Claude Code generate their website in real-time. Split-screen UI: drag-and-drop builder on the left, live Claude Code terminal on the right, bridged by an MCP server.

## Users

- Small business owners who want a website but can't code
- The demo audience at the hackathon

## Core Flow

1. User drags component blocks (navbar, hero, features, pricing, etc.) into a layout
2. User picks a theme, accent color, tech stack, and describes their business
3. User clicks "Generate"
4. Frontend sends layout to backend → backend injects prompt into Claude Code's PTY
5. Claude Code calls `get_layout()` MCP tool → reads layout from backend state
6. Claude generates HTML → calls `show_preview(html)` → backend pushes to frontend via WebSocket
7. Frontend renders HTML in preview iframe
8. User watches the whole process in the terminal panel
9. User types feedback → `POST /api/revise` → Claude revises and calls `show_preview()` again

## Architecture

```
Browser
├── Config Panel (left ~20%)       ──HTTP──→  Backend (Express :3001)
├── Preview iframe (center ~60%)               ├── State Store (in-memory)
├── Feedback bar (bottom of preview)           ├── PTY Manager (node-pty → claude CLI)
└── Terminal Panel (right ~20%)    ──WS──→    ├── Prompt Builder
                                               └── MCP Server (stdio, 3 tools)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express + WS bootstrap, mcp-config gen, CLAUDE.md gen, CORS, all routes |
| `src/config.ts` | Ports (3001), paths (PROJECT_ROOT, WORKSPACE_DIR, MCP_SERVER_DIR), CLAUDE_MODEL |
| `src/state/store.ts` | In-memory state (layout, previewHtml, feedback) + EventEmitter |
| `src/state/routes.ts` | GET/POST `/api/state/{layout,preview,feedback}` |
| `src/pty/manager.ts` | PtyManager: spawn claude CLI, inject prompts, resize, kill |
| `src/pty/ws-bridge.ts` | `/ws/terminal` — WebSocket ↔ PTY pipe for xterm.js (noServer mode) |
| `src/ws/ui.ts` | `/ws/ui` — pushes `preview:updated` to frontend (noServer mode) |
| `src/prompt/builder.ts` | `buildGeneratePrompt()` and `buildRevisionPrompt()` |
| `mcp-server/src/index.ts` | MCP stdio server: get_layout, show_preview, get_user_feedback |
| `test.html` | Standalone test UI (3-panel: config / preview / terminal) |
| `FRONTEND_INTEGRATION.md` | Full API contract + schema docs for the frontend person |

## API Endpoints

| Method | Path | Body | Purpose | Who calls |
|--------|------|------|---------|-----------|
| GET | `/api/health` | — | Health check | Frontend |
| GET | `/api/state/layout` | — | Get layout | MCP server |
| POST | `/api/state/layout` | `PageLayout` JSON | Set layout | Frontend |
| GET | `/api/state/preview` | — | Get preview HTML | Frontend (init) |
| POST | `/api/state/preview` | `{ html }` | Set preview HTML | MCP server |
| GET | `/api/state/feedback` | — | Get feedback | MCP server |
| POST | `/api/state/feedback` | `{ feedback }` | Set feedback | Frontend |
| POST | `/api/pty/start` | — | Start Claude Code PTY | Frontend (on load) |
| POST | `/api/generate` | — | Inject generate prompt into PTY | Frontend |
| POST | `/api/revise` | `{ feedback }` | Store feedback + inject revision prompt | Frontend |
| POST | `/api/save-prompt` | `{ markdown }` | Legacy: save markdown to disk | Frontend |
| GET | `/test` | — | Serve test.html | Browser |

## WebSockets

Both use `noServer` mode with manual `upgrade` routing in `index.ts`.

- `/ws/terminal` — Raw PTY I/O. Server→Browser: terminal escape sequences. Browser→Server: keystrokes or `{ type: "resize", cols, rows }`.
- `/ws/ui` — JSON messages. `{ type: "init", payload: { layout, previewHtml } }` on connect. `{ type: "preview:updated", payload: { html } }` when Claude generates.

## Layout Schema

```typescript
interface PageLayout {
  blocks: Block[];           // required
  theme?: string;            // "Dark", "Light", "Vibrant", "Akita", etc.
  accentColor?: string;      // hex, e.g. "#F7931A"
  techStack?: string[];      // ["React", "Tailwind"]
  businessDescription?: string;
}

interface Block {
  id: string;                // unique, e.g. "hero-1"
  type: string;              // "hero", "navbar", "features", "pricing", "footer", "cta", etc.
  props: Record<string, any>; // freeform — Claude reads whatever is there
}
```

Props are freeform. The `type` field is what matters most — it tells Claude what kind of section to generate. Empty props are fine.

## PTY Manager Details

- Spawns `claude` CLI using `node-pty` with full absolute path (resolved via `which claude`)
- Args: `--model sonnet --mcp-config <abs-path>/mcp-config.json --dangerously-skip-permissions`
- CWD: `workspace/` directory (contains auto-generated `CLAUDE.md` system prompt)
- Env: inherits `process.env` but strips all `CLAUDECODE*` and `CLAUDE_CODE*` vars (prevents nested session rejection)
- `injectPrompt(text)`: writes text, then sends `\r` after 500ms delay
- `mcp-config.json` is auto-generated at startup with absolute paths to `mcp-server/dist/index.js`

## MCP Server

Separate TypeScript package in `mcp-server/`. Built with `npx tsc` into `mcp-server/dist/`. Spawned by Claude Code as stdio child process.

| Tool | Input | Action |
|------|-------|--------|
| `get_layout` | none | `GET localhost:3001/api/state/layout` → returns PageLayout JSON |
| `show_preview` | `{ html: string }` | `POST localhost:3001/api/state/preview` → triggers WS push |
| `get_user_feedback` | none | `GET localhost:3001/api/state/feedback` → returns feedback text |

All logging goes to stderr (stdout is MCP protocol).

## Components

### Frontend (from hackathon repo, complete)
- React + Vite, drag-and-drop with @dnd-kit
- 8 component groups, 50+ blocks
- 6 website themes, color picker
- Currently generates markdown spec, NOT structured layout JSON
- **Needs integration**: translate internal state → `PageLayout` JSON, connect WebSockets, render preview
- See `FRONTEND_INTEGRATION.md` for full API contract

### Backend (complete, tested end-to-end)
- Express server on port 3001
- State management with EventEmitter
- PTY Manager with node-pty
- Two WebSocket servers (noServer mode, manual upgrade routing)
- Prompt builder (generate + revision prompts)
- Auto-generates `mcp-config.json` and `workspace/CLAUDE.md` at startup
- CORS enabled, graceful SIGINT/SIGTERM cleanup

### MCP Server (complete, tested end-to-end)
- `@modelcontextprotocol/sdk` + `zod`
- 3 tools, all verified via raw JSON-RPC

### Test UI (complete)
- `test.html` served at `/test`
- 3-panel layout: config (~20% left), preview (~60% center), terminal (~20% right)
- Feedback input bar at bottom of preview (type + Enter to revise)
- xterm.js terminal with font size 11
- Full flow works: Start PTY → Generate → Preview appears → Revise → Preview updates

## Progress

### Done
- [x] Project scaffolding (TypeScript, ESM, both packages)
- [x] State store with EventEmitter
- [x] REST API for layout, preview, feedback, generate, revise
- [x] PTY Manager (spawn, inject, resize, kill)
- [x] Terminal WebSocket bridge (noServer mode)
- [x] UI WebSocket for preview push (noServer mode)
- [x] Manual upgrade routing for multiple WSS on same HTTP server
- [x] Prompt builder (generate + revision prompts)
- [x] MCP server (3 tools)
- [x] Main server bootstrap (mcp-config gen, CLAUDE.md gen, CORS, cleanup)
- [x] node-pty spawn-helper permission fix
- [x] Nested Claude Code env var stripping
- [x] Claude Code statusLine disabled (removed from ~/.claude/settings.json)
- [x] Test UI with 3-panel layout
- [x] `FRONTEND_INTEGRATION.md` with full schema + API docs

### Verified End-to-End (with Playwright)
- [x] Backend starts, health check passes
- [x] MCP server: initialize, tools/list, get_layout, show_preview via JSON-RPC
- [x] State endpoints roundtrip (layout, preview, feedback)
- [x] Claude Code PTY spawns, banner renders in xterm.js
- [x] Generate: prompt injection → Claude calls get_layout → generates HTML → calls show_preview → preview renders in iframe (~1 min)
- [x] Revise: feedback posted → revision prompt injected → Claude revises HTML → show_preview → updated preview renders in iframe
- [x] Full feedback loop: generate → revise → updated preview (tested with "make hero dark blue + add phone number")

### Remaining
- [ ] Frontend (React) integration — translate droppedBlocks/theme/etc. to PageLayout, connect WS, render preview
- [ ] PTY resilience (restart on crash, multiple generate cycles without restart)
- [ ] PTY restart endpoint
- [ ] Error streaming to frontend

## Known Issues & Fixes

| Issue | Status | Fix |
|-------|--------|-----|
| `node-pty` spawn-helper missing +x | Fixed | `chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper` after `npm install` |
| Nested Claude Code rejection | Fixed | Strip `CLAUDECODE*` and `CLAUDE_CODE*` env vars in PtyManager before spawn |
| Prompt not submitting | Fixed | Write text first, then `\r` after 500ms `setTimeout` |
| Claude statusLine breaks xterm | Fixed | Removed `statusLine` key from `~/.claude/settings.json` (renamed to `_statusLine_disabled_for_akita` doesn't work — JSON schema rejects unknown keys; must delete the key entirely) |
| Two WSS on same HTTP server | Fixed | Use `noServer: true` on both WebSocketServer instances + manual `server.on('upgrade')` routing by pathname |
| Workspace settings.json with `null` statusLine | Fixed | Don't create workspace `.claude/settings.json` — just remove statusLine from global settings |

## Running

```bash
# Backend (from project root)
npm run dev          # starts on :3001

# Frontend (separate terminal)
cd frontend && npm run dev   # starts on :5173

# Test UI (no frontend needed)
# Open http://localhost:3001/test

# MCP server is auto-spawned by Claude Code via mcp-config.json
# mcp-config.json and workspace/CLAUDE.md are auto-generated on backend startup
```

### First-time setup after npm install
```bash
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
```

### To re-enable statusLine after hackathon
Add back to `~/.claude/settings.json`:
```json
"statusLine": {
  "type": "command",
  "command": "bash -c '\"$HOME/.nvm/versions/node/v22.15.0/bin/node\" \"$(ls -td ~/.claude/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | head -1)dist/index.js\"'"
}
```

## Dependencies

**Root**: `express`, `ws`, `node-pty`, `tsx`, `typescript`, `@types/express`, `@types/ws`, `@types/node`

**mcp-server/**: `@modelcontextprotocol/sdk`, `zod`, `typescript`

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `node-pty` native prebuild missing +x | `chmod +x` after install |
| Claude prompts for permission | `--dangerously-skip-permissions` flag |
| MCP server stdout pollution | All logging to stderr |
| Long system prompt escaping | `CLAUDE.md` file instead of CLI flag |
| PTY orphan processes | SIGTERM handler + ws close cleanup |
| Nested Claude Code detection | Strip `CLAUDECODE*` env vars on PTY spawn |
| Claude statusLine garbles xterm | Remove `statusLine` from settings before demo |
| Sandbox container incompatible | Run on host for demo (container needs port mapping + entrypoint changes) |
