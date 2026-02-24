# Akita — Visual Website Builder with AI Agent

Non-technical small business owners drag component blocks into a layout and watch Claude Code generate their website in real-time. Split-screen UI: drag-and-drop builder on the left, live Claude Code terminal on the right, bridged by an MCP server.

## Architecture

```
Browser
├── Builder Panel (left)          ──HTTP──→  Backend (Express :3001)
├── Preview iframe (center)                  ├── State Store (in-memory)
├── Feedback bar (bottom)                    ├── PTY Manager (node-pty → claude CLI)
└── Terminal Panel (right)        ──WS──→    ├── Prompt Builder
                                             └── MCP Server (stdio, 3 tools)
```

**Flow:** User drags blocks → clicks Generate → backend injects prompt into Claude Code PTY → Claude calls `get_layout()` MCP tool → generates HTML → calls `show_preview(html)` → backend pushes to frontend via WebSocket → preview renders in iframe.

## Project Structure

```
akita/
├── src/                    # Backend (Express + WebSocket + PTY)
│   ├── index.ts            # Server bootstrap
│   ├── config.ts           # Ports, paths
│   ├── state/              # In-memory state + REST endpoints
│   ├── pty/                # PTY manager + terminal WebSocket bridge
│   ├── prompt/             # Layout JSON → natural language prompt
│   └── ws/                 # UI WebSocket (preview push)
├── mcp-server/             # MCP stdio server (separate package)
│   └── src/index.ts        # 3 tools: get_layout, show_preview, get_user_feedback
├── frontend/               # React + Vite drag-and-drop builder
├── test.html               # Standalone test UI (no React needed)
├── PRD.md                  # Full project details, API contract, known issues
└── FRONTEND_INTEGRATION.md # API docs for frontend integration
```

## Setup

```bash
# Install backend dependencies
npm install

# Fix node-pty permissions (macOS ARM)
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper

# Build MCP server
cd mcp-server && npm install && npx tsc && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

## Running

```bash
# Terminal 1: Backend
npm run dev              # starts on :3001

# Terminal 2: Frontend
cd frontend && npm run dev   # starts on :5173
```

The MCP server is auto-spawned by Claude Code via `mcp-config.json` (generated at backend startup).

## Test UI

Open http://localhost:3001/test for a standalone test UI with terminal, config panel, and preview iframe. No React frontend needed.

## API

See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md) for the full API contract.

Key endpoints:
- `POST /api/pty/start` — Start Claude Code terminal
- `POST /api/state/layout` — Update page layout
- `POST /api/generate` — Trigger website generation
- `POST /api/revise` — Send feedback and trigger revision
- `ws://localhost:3001/ws/terminal` — Terminal I/O (xterm.js)
- `ws://localhost:3001/ws/ui` — Preview updates (JSON)

## Status

Backend, MCP server, and test UI are complete and tested end-to-end. Frontend React integration is in progress — see [PRD.md](PRD.md) for full status.
