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
  private _ready = false;
  private _suppressEcho = false;

  isRunning(): boolean {
    return this.proc !== null;
  }

  isReady(): boolean {
    return this._ready;
  }

  start(): void {
    if (this.proc) {
      console.log('[pty] Already running, skipping start');
      return;
    }

    const claudePath = findClaude();
    console.log('[pty] Spawning claude CLI...');
    console.log('[pty]   binary:', claudePath);
    console.log('[pty]   model:', CLAUDE_MODEL);

    // Strip CLAUDECODE env vars so nested Claude Code doesn't refuse to start
    const env = { ...process.env } as Record<string, string>;
    for (const key of Object.keys(env)) {
      if (key.startsWith('CLAUDECODE') || key.startsWith('CLAUDE_CODE')) {
        delete env[key];
      }
    }

    this._ready = false;

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
      // When suppressing prompt echo, swallow data until suppression ends
      if (!this._suppressEcho) {
        this.emit('data', data);
      }

      // Detect when Claude Code is ready — look for the title sequence or prompt chars
      if (!this._ready && (data.includes('Claude Code') || data.includes('⏵') || data.includes('>'))) {
        this._ready = true;
        this.emit('ready');
        console.log('[pty] Claude Code is ready');
      }
    });

    this.proc.onExit(({ exitCode, signal }) => {
      console.log(`[pty] Process exited (code=${exitCode}, signal=${signal})`);
      this.proc = null;
      this._ready = false;
      this.emit('exit', exitCode, signal);
    });

    console.log('[pty] Claude CLI spawned, pid:', this.proc.pid);
  }

  restart(): void {
    console.log('[pty] Restarting...');
    this.kill();
    // Small delay to let the process fully clean up
    setTimeout(() => this.start(), 500);
  }

  injectPrompt(text: string): void {
    if (!this.proc) {
      throw new Error('PTY not running');
    }
    // Suppress echo so the terminal doesn't show the raw prompt text
    this._suppressEcho = true;

    this.proc.write(text);
    setTimeout(() => {
      if (this.proc) {
        this.proc.write('\r');
      }
      // Stop suppressing ~2s after Enter — echo is done, Claude is working
      setTimeout(() => {
        this._suppressEcho = false;
      }, 2000);
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
      this._ready = false;
    }
  }
}
