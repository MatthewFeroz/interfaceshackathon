# Akita Demo Script

## What It Does (Simple Version)

Akita lets anyone build a professional website by dragging blocks into a layout. Behind the scenes, Claude — an AI — watches what you build and generates real code for it, live.

The left side is you: picking sections, choosing colors, describing your business. The right side is Claude: you can literally watch it think, read your layout, write HTML and CSS, and push it to the preview — all in real time.

## What's Happening Under the Hood

1. **You drag blocks** (hero, features, pricing, etc.) into the builder. Every change gets sent to the backend as structured JSON — block types, order, theme, colors, business description.

2. **You hit Generate.** The backend takes your layout and writes a prompt in plain English: "Build a website with a hero, then features, then pricing. Theme is Modern. Accent color is indigo." That prompt gets injected into Claude Code's terminal — like a human typing it.

3. **Claude reads your layout** by calling a tool (`get_layout`). It sees exactly what blocks you picked and any details you added. Then it writes a complete HTML page — no templates, no frameworks, just hand-crafted HTML and CSS.

4. **You see the result.** Claude pushes the finished page to the preview iframe. A complete, polished website appears.

5. **You iterate.** Type feedback like "make the header blue" or "add a phone number" and Claude reads back its own previous HTML, edits only what you asked for, and pushes the updated version. It never starts over — your good design stays intact.

6. **You change the layout.** Add a pricing section, switch the theme, rearrange blocks. Hit Generate again. Claude reads the existing page and the updated layout, then modifies the HTML to match — preserving everything that didn't change.

7. **Every version is saved.** You can undo, revert to any previous version, or export the final HTML as a standalone file.

## Key Technical Points (For Judges)

- **No templates.** Claude generates every pixel of CSS. Different themes produce genuinely different designs — dark mode with neon accents, warm tones with rounded corners, minimal with zero decoration.

- **MCP tools bridge the UI and the AI.** Four tools (`get_layout`, `get_current_html`, `show_preview`, `get_user_feedback`) let Claude read the layout, read its own previous output, push HTML to the preview, and check for revision requests. The AI is a real participant in the app, not just an API call.

- **Stateful iteration.** Claude always reads the existing HTML before making changes. Revisions and layout updates modify the existing page — never regenerate from scratch. This is faster and means you never lose a good design.

- **The terminal is real.** Users watch Claude work — calling tools, generating code, responding to feedback. It's not a fake loading spinner. It's the actual AI thinking out loud.

- **Instant when possible.** If you click Generate and nothing changed, the backend returns the cached result instantly — no AI call needed.

- **Starter templates.** Four pre-built templates (SaaS, Restaurant, Portfolio, Tech Startup) give users a starting point with theme, colors, and block layout pre-configured.

## Demo Flow (Suggested)

1. Open the app. Show the empty builder and the live Claude terminal.
2. Pick the "SaaS Landing Page" template — blocks auto-populate.
3. Set the theme to "Tech Startup" and pick a purple accent color.
4. Type a business description: "AI-powered code review for engineering teams."
5. Click Generate. Watch Claude work in the terminal. The preview appears.
6. Type feedback: "make the hero more dramatic with a gradient background."
7. Click Revise. Watch Claude update the design without starting over.
8. Drag a new "FAQ" block into the layout. Click Generate again. Claude adds just the FAQ section to the existing page.
9. Click Export to download the HTML. Open it in a browser — it's a real, responsive website.
