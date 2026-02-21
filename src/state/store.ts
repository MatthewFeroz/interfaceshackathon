import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { STATE_FILE, PORT } from '../config.js';

export interface BlockProps {
  [key: string]: unknown;
}

export interface Block {
  id: string;
  type: string;
  props: BlockProps;
}

export interface PageLayout {
  blocks: Block[];
  theme?: string;
  accentColor?: string;
  techStack?: string[];
  businessDescription?: string;
}

export type AgentStatus = 'idle' | 'generating' | 'revising';

export interface PreviewVersion {
  version: number;
  html: string;
  timestamp: string;
}

interface State {
  layout: PageLayout;
  previewHtml: string;
  previewVersions: PreviewVersion[];
  feedback: string;
  status: AgentStatus;
}

const GENERATION_TIMEOUT_MS = 90_000;

function buildSectionEditScript(): string {
  return `
<script data-akita-editor>
(function() {
  const API = 'http://localhost:${PORT}';
  let activeSection = null;
  let overlay = null;

  // Styles for the editor UI
  const style = document.createElement('style');
  style.textContent = \`
    [data-block-id] { cursor: pointer; position: relative; transition: outline 0.15s ease; }
    [data-block-id]:hover { outline: 2px dashed rgba(99,102,241,0.4); outline-offset: 4px; }
    [data-block-id].akita-selected { outline: 2px solid #6366F1; outline-offset: 4px; }
    .akita-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.3); z-index: 99998;
    }
    .akita-edit-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 99999;
      background: #fff; border-top: 2px solid #6366F1;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
      padding: 16px 20px; display: flex; gap: 12px; align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .akita-edit-bar label {
      font-size: 13px; font-weight: 600; color: #6366F1; white-space: nowrap;
    }
    .akita-edit-bar input {
      flex: 1; padding: 10px 14px; border: 1.5px solid #e2e8f0;
      border-radius: 8px; font-size: 14px; outline: none;
      transition: border-color 0.15s;
    }
    .akita-edit-bar input:focus { border-color: #6366F1; }
    .akita-edit-bar button {
      padding: 10px 20px; border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s;
    }
    .akita-edit-bar .akita-submit {
      background: #6366F1; color: #fff;
    }
    .akita-edit-bar .akita-submit:hover { background: #4f46e5; }
    .akita-edit-bar .akita-submit:disabled {
      background: #a5b4fc; cursor: not-allowed;
    }
    .akita-edit-bar .akita-cancel {
      background: #f1f5f9; color: #64748b;
    }
    .akita-edit-bar .akita-cancel:hover { background: #e2e8f0; }
    .akita-status {
      font-size: 12px; color: #6366F1; margin-left: 8px;
    }
  \`;
  document.head.appendChild(style);

  function closeEditor() {
    if (activeSection) activeSection.classList.remove('akita-selected');
    activeSection = null;
    if (overlay) { overlay.remove(); overlay = null; }
    const bar = document.querySelector('.akita-edit-bar');
    if (bar) bar.remove();
  }

  function openEditor(section) {
    closeEditor();
    activeSection = section;
    section.classList.add('akita-selected');
    const blockId = section.getAttribute('data-block-id');
    const blockType = blockId.replace(/-\\d+$/, '');

    // Scroll section into view
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Overlay behind the bar
    overlay = document.createElement('div');
    overlay.className = 'akita-overlay';
    overlay.onclick = closeEditor;
    document.body.appendChild(overlay);

    // Edit bar
    const bar = document.createElement('div');
    bar.className = 'akita-edit-bar';
    bar.innerHTML = \`
      <label>Edit \${blockType}:</label>
      <input type="text" placeholder="Describe your changes..." autofocus />
      <button class="akita-submit">Revise</button>
      <button class="akita-cancel">Cancel</button>
    \`;
    document.body.appendChild(bar);

    const input = bar.querySelector('input');
    const submit = bar.querySelector('.akita-submit');
    const cancel = bar.querySelector('.akita-cancel');

    // Stop propagation so clicking the bar doesn't close it
    bar.onclick = (e) => e.stopPropagation();

    cancel.onclick = closeEditor;

    async function doRevise() {
      const feedback = input.value.trim();
      if (!feedback) return;
      submit.disabled = true;
      submit.textContent = 'Revising...';
      input.disabled = true;
      try {
        const res = await fetch(API + '/api/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback, section: blockId }),
        });
        if (res.ok) {
          submit.textContent = 'Sent!';
          setTimeout(closeEditor, 1000);
        } else {
          const data = await res.json().catch(() => ({}));
          submit.textContent = data.error || 'Error';
          submit.disabled = false;
          input.disabled = false;
        }
      } catch (err) {
        submit.textContent = 'Error';
        submit.disabled = false;
        input.disabled = false;
      }
    }

    submit.onclick = doRevise;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doRevise();
      if (e.key === 'Escape') closeEditor();
    });

    // Focus input after a tick (autofocus doesn't always work in iframes)
    setTimeout(() => input.focus(), 50);
  }

  // Delegate clicks on sections
  document.addEventListener('click', (e) => {
    // Don't intercept if editor is open and click is on the bar
    if (e.target.closest('.akita-edit-bar')) return;

    const section = e.target.closest('[data-block-id]');
    if (section) {
      e.preventDefault();
      e.stopPropagation();
      openEditor(section);
    }
  });
})();
</script>`;
}


class Store extends EventEmitter {
  private state: State = {
    layout: { blocks: [] },
    previewHtml: '',
    previewVersions: [],
    feedback: '',
    status: 'idle',
  };
  private statusTimer: ReturnType<typeof setTimeout> | null = null;

  getLayout(): PageLayout {
    return this.state.layout;
  }

  setLayout(layout: PageLayout): void {
    this.state.layout = layout;
    this.emit('layout:updated', layout);
    this.schedulePersist();
  }

  getPreviewHtml(): string {
    return this.state.previewHtml;
  }

  getPreviewHtmlLive(): string {
    if (!this.state.previewHtml) return '';
    return this.injectEditor(this.state.previewHtml);
  }

  private injectEditor(html: string): string {
    const script = buildSectionEditScript();
    // Insert before </body> if present, otherwise append
    if (html.includes('</body>')) {
      return html.replace('</body>', script + '\n</body>');
    }
    return html + script;
  }

  private stripEditor(html: string): string {
    return html.replace(/<script data-akita-editor>[\s\S]*?<\/script>/, '');
  }

  setPreviewHtml(html: string): void {
    // Store clean HTML (without editor script)
    const cleanHtml = this.stripEditor(html);
    this.state.previewHtml = cleanHtml;
    const version: PreviewVersion = {
      version: this.state.previewVersions.length + 1,
      html: cleanHtml,
      timestamp: new Date().toISOString(),
    };
    this.state.previewVersions.push(version);
    // Emit with editor script injected for the live preview
    const liveHtml = this.injectEditor(cleanHtml);
    this.emit('preview:updated', liveHtml, version.version);
    this.schedulePersist();
    // Generation is done when preview is set
    this.setStatus('idle');
  }

  revertToVersion(version: number): PreviewVersion | undefined {
    const v = this.state.previewVersions[version - 1];
    if (!v) return undefined;
    this.state.previewHtml = v.html;
    this.emit('preview:updated', this.injectEditor(v.html), v.version);
    return v;
  }

  getPreviewVersions(): PreviewVersion[] {
    return this.state.previewVersions;
  }

  getPreviewVersion(version: number): PreviewVersion | undefined {
    return this.state.previewVersions[version - 1];
  }

  getFeedback(): string {
    return this.state.feedback;
  }

  setFeedback(feedback: string): void {
    this.state.feedback = feedback;
  }

  clearFeedback(): void {
    this.state.feedback = '';
  }

  private lastProgress = '';

  emitPreviewProgress(html: string): void {
    this.emit('preview:progress', this.injectEditor(html));
  }

  emitProgress(message: string): void {
    if (message !== this.lastProgress) {
      this.lastProgress = message;
      this.emit('progress', message);
    }
  }

  getStatus(): AgentStatus {
    return this.state.status;
  }

  // ── Persistence ─────────────────────────────────────────

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  private schedulePersist(): void {
    // Debounce writes to avoid thrashing disk on rapid changes
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistNow();
    }, 500);
  }

  private persistNow(): void {
    try {
      const data = {
        layout: this.state.layout,
        previewHtml: this.state.previewHtml,
        previewVersions: this.state.previewVersions,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(data));
    } catch (err) {
      console.error('[store] Failed to persist state:', err);
    }
  }

  restore(): void {
    try {
      if (!fs.existsSync(STATE_FILE)) return;
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.layout?.blocks) this.state.layout = data.layout;
      if (data.previewHtml) this.state.previewHtml = data.previewHtml;
      if (Array.isArray(data.previewVersions)) this.state.previewVersions = data.previewVersions;
      console.log('[store] Restored state (%d versions, %d blocks)',
        this.state.previewVersions.length, this.state.layout.blocks.length);
    } catch (err) {
      console.error('[store] Failed to restore state:', err);
    }
  }

  setStatus(status: AgentStatus): void {
    if (this.state.status !== status) {
      this.state.status = status;
      this.emit('status:changed', status);
      if (status === 'idle') this.lastProgress = '';

      // Clear any existing timeout
      if (this.statusTimer) {
        clearTimeout(this.statusTimer);
        this.statusTimer = null;
      }

      // Start timeout when entering a busy state
      if (status !== 'idle') {
        this.statusTimer = setTimeout(() => {
          console.log(`[store] Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s, resetting to idle`);
          this.state.status = 'idle';
          this.emit('status:changed', 'idle');
          this.emit('generation:timeout');
          this.statusTimer = null;
        }, GENERATION_TIMEOUT_MS);
      }
    }
  }
}

export const store = new Store();
