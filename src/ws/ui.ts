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

  wss.on('connection', (ws: WebSocket) => {
    console.log('[ws/ui] Client connected');

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
      console.log('[ws/ui] Client disconnected');
    });
  });

  console.log('[ws/ui] WebSocket server ready');
  return wss;
}
