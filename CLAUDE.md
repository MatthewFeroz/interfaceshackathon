# Akita — Agent Layer for Visual Website Builder

## What This Is

Hackathon project. A web app where small business owners drag component blocks into a layout and Claude Code generates their website in real-time. Split-screen UI: drag-and-drop builder on the left, live Claude Code terminal on the right, bridged by an MCP server.

## Architecture

- **Frontend** (`frontend/`): React + Vite drag-and-drop builder. Runs on `:5173`.
- **Backend** (`src/`): Express + WebSocket server. Runs on `:3001`.
- **MCP Server** (`mcp-server/`): Stdio MCP server spawned by Claude Code. 4 tools: `get_layout`, `get_current_html`, `show_preview`, `get_user_feedback`.
- **Workspace** (`workspace/`): Working directory for Claude Code. `CLAUDE.md` is auto-generated at startup.

## Running

```bash
# Backend (from root)
npm run dev

# Frontend (separate terminal)
cd frontend && npm run dev

# MCP server is auto-spawned by Claude Code via mcp-config.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express + WS bootstrap |
| `src/config.ts` | Ports, paths, constants |
| `src/state/store.ts` | In-memory state + EventEmitter |
| `src/state/routes.ts` | REST endpoints for state |
| `src/pty/manager.ts` | PtyManager: spawn claude, inject prompts |
| `src/pty/ws-bridge.ts` | WebSocket ↔ PTY pipe for xterm.js |
| `src/prompt/builder.ts` | Layout JSON → natural language prompt |
| `src/ws/ui.ts` | Push preview updates to frontend |
| `mcp-server/src/index.ts` | MCP stdio server with 4 tools |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/state/layout` | Page layout (blocks, theme, etc.) |
| GET/POST | `/api/state/preview` | Generated HTML preview |
| GET/POST | `/api/state/feedback` | User feedback for revisions |
| POST | `/api/generate` | Trigger Claude to generate/update from layout |
| POST | `/api/revise` | Send feedback, Claude edits existing HTML |
| GET | `/api/export` | Download current preview as HTML file |
| GET | `/api/blocks` | List supported block types |
| GET | `/api/themes` | List supported themes |
| GET | `/api/templates` | List starter templates |
| GET | `/api/templates/:id` | Get full template layout |
| POST | `/api/pty/start` | Start Claude Code PTY |
| POST | `/api/save-prompt` | Legacy: save markdown prompt to disk |

## WebSockets

- `/ws/terminal` — Raw PTY I/O for xterm.js
- `/ws/ui` — JSON messages: `init`, `preview:updated`

## Build

```bash
# Root backend (TypeScript)
npx tsc

# MCP server (separate TypeScript project)
cd mcp-server && npx tsc
```

## Conventions

- TypeScript with ES modules (`"type": "module"`)
- `.js` extensions in imports (required for ESM)
- MCP server logs to stderr only (stdout is MCP protocol)
- All state is in-memory, persisted to workspace/state.json
- Revisions are stateful: Claude reads existing HTML before editing (never rebuilds from scratch)
