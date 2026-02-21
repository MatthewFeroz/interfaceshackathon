import { Router } from 'express';
import { store } from './store.js';
import type { PageLayout } from './store.js';

export const stateRouter = Router();

function validateLayout(body: unknown): { ok: true; layout: PageLayout } | { ok: false; error: string } {
  const layout = body as Record<string, unknown>;
  if (!layout || typeof layout !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  if (!Array.isArray(layout.blocks)) {
    return { ok: false, error: 'Missing "blocks" array' };
  }
  for (let i = 0; i < layout.blocks.length; i++) {
    const block = layout.blocks[i] as Record<string, unknown>;
    if (!block.id || typeof block.id !== 'string') {
      return { ok: false, error: `Block ${i}: missing or invalid "id"` };
    }
    if (!block.type || typeof block.type !== 'string') {
      return { ok: false, error: `Block ${i}: missing or invalid "type"` };
    }
  }
  return { ok: true, layout: layout as unknown as PageLayout };
}

// Layout
stateRouter.get('/layout', (_req, res) => {
  res.json(store.getLayout());
});

stateRouter.post('/layout', (req, res) => {
  const result = validateLayout(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  store.setLayout(result.layout);
  res.json({ ok: true });
});

// Preview
stateRouter.get('/preview', (_req, res) => {
  res.json({ html: store.getPreviewHtml() });
});

stateRouter.post('/preview', (req, res) => {
  store.setPreviewHtml(req.body.html);
  res.json({ ok: true });
});

// Progress preview — work-in-progress HTML that doesn't create a version
stateRouter.post('/preview/progress', (req, res) => {
  const { html } = req.body;
  if (!html) {
    res.status(400).json({ error: 'Missing html' });
    return;
  }
  store.emitPreviewProgress(html);
  res.json({ ok: true });
});

// Preview versions
stateRouter.get('/preview/versions', (_req, res) => {
  const versions = store.getPreviewVersions().map(({ version, timestamp }) => ({
    version,
    timestamp,
  }));
  res.json({ versions, total: versions.length });
});

stateRouter.get('/preview/versions/:version', (req, res) => {
  const v = store.getPreviewVersion(parseInt(req.params.version, 10));
  if (!v) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  res.json(v);
});

stateRouter.post('/preview/revert/:version', (req, res) => {
  const v = store.revertToVersion(parseInt(req.params.version, 10));
  if (!v) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  res.json({ ok: true, version: v.version });
});

// Feedback
stateRouter.get('/feedback', (_req, res) => {
  res.json({ feedback: store.getFeedback() });
});

stateRouter.post('/feedback', (req, res) => {
  store.setFeedback(req.body.feedback);
  res.json({ ok: true });
});
