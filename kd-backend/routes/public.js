// routes/public.js – Öffentliche Endpoints (ohne Auth)

const express = require('express');
const { all, getKvkEvents } = require('../db-pg');
const { getOptionalUser } = require('../middleware/auth');
const { findKingdomBySlug, normalizeFileRow } = require('../helpers');

const router = express.Router();

router.get('/kingdom/:slug', async (req, res) => {
  const k = await findKingdomBySlug(req.params.slug);
  if (!k) return res.status(404).json({ error: 'Not found' });
  res.json(k);
});

router.get('/kingdom/:slug/kvk-events', async (req, res) => {
  try {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    const viewer = await getOptionalUser(req);
    const events = await getKvkEvents(k.id);

    let visibleEvents = events.filter((e) => e.isPublic);

    if (viewer) {
      const isPrivileged = viewer.role === 'admin' || viewer.role === 'r4' || (viewer.role === 'r5' && viewer.r5AccessValid);
      const sameKingdom = viewer.role === 'admin' ? true : viewer.kingdomId === k.id;
      if (isPrivileged && sameKingdom) visibleEvents = events;
    }

    res.json(visibleEvents);
  } catch (error) {
    res.status(500).json({ error: 'Error loading events' });
  }
});

router.get('/kingdom/:slug/overview-files', async (req, res) => {
  const k = await findKingdomBySlug(req.params.slug);
  if (!k) return res.status(404).json({ error: 'Not found' });
  const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [k.id]);
  res.json(rows.map(normalizeFileRow));
});

router.get('/kingdom/:slug/honor-files', async (req, res) => {
  const k = await findKingdomBySlug(req.params.slug);
  if (!k) return res.status(404).json({ error: 'Not found' });
  const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [k.id]);
  res.json(rows.map(normalizeFileRow));
});

module.exports = router;
