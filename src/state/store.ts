import { EventEmitter } from 'node:events';

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

class Store extends EventEmitter {
  private state: State = {
    layout: { blocks: [] },
    previewHtml: '',
    previewVersions: [],
    feedback: '',
    status: 'idle',
  };

  getLayout(): PageLayout {
    return this.state.layout;
  }

  setLayout(layout: PageLayout): void {
    this.state.layout = layout;
    this.emit('layout:updated', layout);
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

  getStatus(): AgentStatus {
    return this.state.status;
  }

  setStatus(status: AgentStatus): void {
    if (this.state.status !== status) {
      this.state.status = status;
      this.emit('status:changed', status);
    }
  }
}

export const store = new Store();
