import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { PtyManager } from './manager.js';

export function setupTerminalWs(server: Server, ptyManager: PtyManager): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[ws/terminal] Client connected');

    const onData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    };

    ptyManager.on('data', onData);

    ws.on('message', (raw: Buffer | string) => {
      const msg = raw.toString();

      // Try to parse as JSON for resize commands
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyManager.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch {
        // Not JSON — raw keystroke, forward to PTY
      }

      ptyManager.write(msg);
    });

    ws.on('close', () => {
      console.log('[ws/terminal] Client disconnected');
      ptyManager.removeListener('data', onData);
    });
  });

  console.log('[ws/terminal] WebSocket server ready');
  return wss;
}
