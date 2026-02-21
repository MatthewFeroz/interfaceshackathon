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

interface State {
  layout: PageLayout;
  previewHtml: string;
  feedback: string;
  status: AgentStatus;
}

class Store extends EventEmitter {
  private state: State = {
    layout: { blocks: [] },
    previewHtml: '',
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
    this.emit('preview:updated', html);
    // Generation is done when preview is set
    this.setStatus('idle');
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
