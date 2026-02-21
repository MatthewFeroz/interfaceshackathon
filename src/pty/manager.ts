import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { WORKSPACE_DIR, MCP_CONFIG_PATH, CLAUDE_MODEL } from '../config.js';

function findClaude(): string {
  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    return 'claude'; // fallback to PATH lookup
  }
}

export class PtyManager extends EventEmitter {
  private proc: pty.IPty | null = null;

  isRunning(): boolean {
    return this.proc !== null;
  }

  start(): void {
    if (this.proc) {
      console.log('[pty] Already running, skipping start');
      return;
    }

    const claudePath = findClaude();
    console.log('[pty] Spawning claude CLI...');
    console.log('[pty]   binary:', claudePath);
    console.log('[pty]   cwd:', WORKSPACE_DIR);
    console.log('[pty]   mcp-config:', MCP_CONFIG_PATH);
    console.log('[pty]   model:', CLAUDE_MODEL);

    // Strip CLAUDECODE env vars so nested Claude Code doesn't refuse to start
    const env = { ...process.env } as Record<string, string>;
    for (const key of Object.keys(env)) {
      if (key.startsWith('CLAUDECODE') || key.startsWith('CLAUDE_CODE')) {
        delete env[key];
      }
    }

    this.proc = pty.spawn(claudePath, [
      '--model', CLAUDE_MODEL,
      '--mcp-config', MCP_CONFIG_PATH,
      '--dangerously-skip-permissions',
    ], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: WORKSPACE_DIR,
      env,
    });

    this.proc.onData((data: string) => {
      // Log first chunk to debug startup issues
      if (this.proc) {
        const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (clean) {
          console.log('[pty:data]', clean.substring(0, 200));
        }
      }
      this.emit('data', data);
    });

    this.proc.onExit(({ exitCode, signal }) => {
      console.log(`[pty] Process exited (code=${exitCode}, signal=${signal})`);
      this.proc = null;
      this.emit('exit', exitCode, signal);
    });

    console.log('[pty] Claude CLI spawned, pid:', this.proc.pid);
  }

  injectPrompt(text: string): void {
    if (!this.proc) {
      throw new Error('PTY not running');
    }
    // Write the prompt text, then send Enter after a brief delay
    // to let the terminal input buffer accept the full text
    this.proc.write(text);
    setTimeout(() => {
      if (this.proc) {
        this.proc.write('\r');
      }
    }, 500);
  }

  write(data: string): void {
    if (this.proc) {
      this.proc.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.proc) {
      this.proc.resize(cols, rows);
    }
  }

  kill(): void {
    if (this.proc) {
      console.log('[pty] Killing process');
      this.proc.kill();
      this.proc = null;
    }
  }
}
