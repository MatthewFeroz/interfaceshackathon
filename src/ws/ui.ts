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

  store.on('preview:updated', (html: string) => {
    broadcast({ type: 'preview:updated', payload: { html } });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[ws/ui] Client connected');

    // Send current state on connect
    ws.send(JSON.stringify({
      type: 'init',
      payload: {
        layout: store.getLayout(),
        previewHtml: store.getPreviewHtml(),
      },
    }));

    ws.on('close', () => {
      console.log('[ws/ui] Client disconnected');
    });
  });

  console.log('[ws/ui] WebSocket server ready');
  return wss;
}
