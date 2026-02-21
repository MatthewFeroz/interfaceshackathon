import { Router } from 'express';
import { store } from './store.js';

export const stateRouter = Router();

// Layout
stateRouter.get('/layout', (_req, res) => {
  res.json(store.getLayout());
});

stateRouter.post('/layout', (req, res) => {
  store.setLayout(req.body);
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
