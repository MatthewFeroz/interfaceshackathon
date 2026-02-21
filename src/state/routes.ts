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

// Feedback
stateRouter.get('/feedback', (_req, res) => {
  res.json({ feedback: store.getFeedback() });
});

stateRouter.post('/feedback', (req, res) => {
  store.setFeedback(req.body.feedback);
  res.json({ ok: true });
});

// Status reset — use when status is stuck
stateRouter.post('/reset-status', (_req, res) => {
  store.setStatus('idle');
  res.json({ ok: true });
});
