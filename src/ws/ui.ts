import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { store } from '../state/store.js';

export function setupUiWs(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  const broadcast = (data: object) => {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  store.on('preview:updated', (html: string, version: number) => {
    broadcast({ type: 'preview:updated', payload: { html, version } });
  });

  store.on('status:changed', (status: string) => {
    broadcast({ type: 'status', payload: { status } });
  });

  // Heartbeat: ping every 30s, terminate if no pong within 10s
  const PING_INTERVAL = 30_000;
  const PONG_TIMEOUT = 10_000;
  const aliveMap = new Map<WebSocket, boolean>();

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!aliveMap.get(ws)) {
        console.log('[ws/ui] Client unresponsive, terminating');
        ws.terminate();
        continue;
      }
      aliveMap.set(ws, false);
      ws.ping();
    }
  }, PING_INTERVAL);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: WebSocket) => {
    console.log('[ws/ui] Client connected');
    aliveMap.set(ws, true);

    ws.on('pong', () => {
      aliveMap.set(ws, true);
    });

    // Send current state on connect
    ws.send(JSON.stringify({
      type: 'init',
      payload: {
        layout: store.getLayout(),
        previewHtml: store.getPreviewHtml(),
        status: store.getStatus(),
      },
    }));

    ws.on('close', () => {
      aliveMap.delete(ws);
      console.log('[ws/ui] Client disconnected');
    });
  });

  console.log('[ws/ui] WebSocket server ready');
  return wss;
}
