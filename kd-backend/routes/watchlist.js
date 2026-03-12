// routes/watchlist.js – Watchlist

const express = require('express');
const { query, all } = require('../db-pg');
const { authenticateToken, requireMigrationListAccess } = require('../middleware/auth');
const { resolveKingdomIdFromRequest } = require('../helpers');

const router = express.Router();

router.get('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    let kingdomId;
    try {
      kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid kingdom context.' });
    }

    const rows = await all(
      `SELECT player_id FROM watchlist_entries WHERE kingdom_id = $1`,
      [kingdomId]
    );
    res.json(rows.map((row) => row.player_id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load watchlist.' });
  }
});

router.put('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  let transactionStarted = false;
  try {
    let kingdomId;
    try {
      kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid kingdom context.' });
    }

    const playerIds = Array.isArray(req.body?.playerIds) ? req.body.playerIds : [];

    await query('BEGIN');
    transactionStarted = true;

    await query('DELETE FROM watchlist_entries WHERE kingdom_id = $1', [kingdomId]);

    if (playerIds.length > 0) {
      const values = playerIds.map((_, i) => `($1, $${i + 2})`).join(',');
      await query(
        `INSERT INTO watchlist_entries (kingdom_id, player_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [kingdomId, ...playerIds.map(String)]
      );
    }

    await query('COMMIT');
    res.json({ success: true, count: playerIds.length });
  } catch (error) {
    console.error(error);
    if (transactionStarted) {
      try { await query('ROLLBACK'); } catch (e) { console.error('Rollback failed:', e); }
    }
    res.status(500).json({ error: 'Failed to save watchlist.' });
  }
});

module.exports = router;
