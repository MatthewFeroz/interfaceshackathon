import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { STATE_FILE } from '../config.js';

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

  setPreviewHtml(html: string): void {
    this.state.previewHtml = html;
    const version: PreviewVersion = {
      version: this.state.previewVersions.length + 1,
      html,
      timestamp: new Date().toISOString(),
    };
    this.state.previewVersions.push(version);
    this.emit('preview:updated', html, version.version);
    this.schedulePersist();
    // Generation is done when preview is set
    this.setStatus('idle');
  }

  revertToVersion(version: number): PreviewVersion | undefined {
    const v = this.state.previewVersions[version - 1];
    if (!v) return undefined;
    this.state.previewHtml = v.html;
    this.emit('preview:updated', v.html, v.version);
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
          this.statusTimer = null;
        }, GENERATION_TIMEOUT_MS);
      }
    }
  }
}

export const store = new Store();
