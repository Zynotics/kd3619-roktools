// routes/watchlist.js – Watchlist

const express = require('express');
const { query, all } = require('../db-pg');
const { authenticateToken, requireWatchlistAccess } = require('../middleware/auth');
const { resolveKingdomIdFromRequest } = require('../helpers');
const { logActivity } = require('../helpers/logger');

const router = express.Router();

router.get('/', authenticateToken, requireWatchlistAccess, async (req, res) => {
  try {
    let kingdomId;
    try {
      kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid kingdom context.' });
    }

    const rows = await all(
      `SELECT player_id, location FROM watchlist_entries WHERE kingdom_id = $1`,
      [kingdomId]
    );
    res.json(rows.map((row) => ({ id: row.player_id, location: row.location || '' })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load watchlist.' });
  }
});

router.put('/', authenticateToken, requireWatchlistAccess, async (req, res) => {
  let transactionStarted = false;
  try {
    let kingdomId;
    try {
      kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid kingdom context.' });
    }

    const players = Array.isArray(req.body?.players) ? req.body.players : [];

    await query('BEGIN');
    transactionStarted = true;

    await query('DELETE FROM watchlist_entries WHERE kingdom_id = $1', [kingdomId]);

    if (players.length > 0) {
      const values = players.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(',');
      const params = [kingdomId];
      for (const p of players) {
        params.push(String(p.id), p.location || null);
      }
      await query(
        `INSERT INTO watchlist_entries (kingdom_id, player_id, location) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }

    await query('COMMIT');
    logActivity({ userId: req.user.id, username: req.user.username, role: req.user.role, action: 'watchlist_save', entityType: 'watchlist', details: { count: players.length }, kingdomId });
    res.json({ success: true, count: players.length });
  } catch (error) {
    console.error(error);
    if (transactionStarted) {
      try { await query('ROLLBACK'); } catch (e) { console.error('Rollback failed:', e); }
    }
    res.status(500).json({ error: 'Failed to save watchlist.' });
  }
});

module.exports = router;
