# Akita 🐕 — Prompt Builder

A drag-and-drop frontend prompt builder for non-technical users. Fill out a funnel, get a markdown spec that a Claude Code agent can use to one-shot generate a website.

---

## What it does

1. **Drag component blocks** from the sidebar (navbar, hero, product card, tokenomics, etc.) into the funnel
2. **Pick a tech stack, theme, and accent color** for your website
3. **Describe your business** in plain English
4. **Add reference images** via upload or URL
5. **Generate** — optionally calls Claude API to expand the spec, then outputs a `akita-prompt.md` file

---

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## App themes

Switch between three UI themes in the top-right:

| Theme | Description |
|-------|-------------|
| 🌙 Dark | Indigo/purple dark (default) |
| ☀️ Light | Clean white |
| 🐕 Akita | Orange/gold memecoin style |

---

## Claude API (optional)

Enter your `sk-ant-api03-…` key in the header. Without it the app still generates a local markdown spec. With it, Claude expands the spec into a detailed developer-ready prompt.

---

## Teammate integration

The teammate runs a **Claude Agents SDK** backend that receives the generated prompt and builds the UI.

### Integration point

In `frontend/src/App.jsx`, set the endpoint:

```js
const SAVE_ENDPOINT = 'http://localhost:3001/api/save-prompt'
```

The frontend will `POST { markdown }` to that URL on every generate. The backend writes it to `/tmp/akita-prompt.md`.

### Claude Code — Ctrl+G

A custom command and keybinding are pre-configured:

- **`~/.claude/commands/generate-ui.md`** — `/generate-ui <path>` tells Claude to build a full UI from the spec file
- **`~/.claude/keybindings.json`** — **Ctrl+G** fires `/generate-ui /tmp/akita-prompt.md`

Teammate workflow:
1. User generates prompt in Akita → saved to `/tmp/akita-prompt.md`
2. Teammate presses **Ctrl+G** in Claude Code → Claude builds the UI

---

## Project structure

```
interfaceshackathon/
├── frontend/               # Vite + React app
│   ├── src/
│   │   ├── App.jsx         # Main app — SAVE_ENDPOINT integration hook here
│   │   └── App.css         # CSS custom properties for all 3 themes
│   └── vite.config.js
├── task.md                 # Original requirements
└── README.md
```
