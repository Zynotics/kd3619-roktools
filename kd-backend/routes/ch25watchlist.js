// routes/ch25watchlist.js – Persistent <CH25 watchlist (player_ids that came
// from a Top 1000 upload but should be monitored independently).

const express = require('express');
const { query, all } = require('../db-pg');
const { authenticateToken, requireMigrationListAccess } = require('../middleware/auth');
const { resolveKingdomIdFromRequest } = require('../helpers');
const { logActivity } = require('../helpers/logger');

const router = express.Router();

router.get('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const rows = await all(
      `SELECT player_id, notes, added_at FROM ch25_watchlist WHERE kingdom_id = $1 ORDER BY added_at DESC`,
      [kingdomId]
    );
    res.json(rows.map(row => ({
      playerId: row.player_id,
      notes: row.notes || '',
      addedAt: row.added_at ? row.added_at.toISOString() : null,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load <CH25 watchlist.' });
  }
});

router.post('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const playerId = String(req.body?.playerId || '').trim();
    if (!playerId) return res.status(400).json({ error: 'playerId is required.' });
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : null;

    await query(
      `INSERT INTO ch25_watchlist (kingdom_id, player_id, notes, added_at, added_by_user_id)
         VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (kingdom_id, player_id) DO UPDATE SET notes = EXCLUDED.notes`,
      [kingdomId, playerId, notes, req.user.id]
    );
    logActivity({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: 'ch25_watchlist_add', entityType: 'ch25_watchlist',
      entityId: playerId, kingdomId,
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add to <CH25 watchlist.' });
  }
});

router.put('/:playerId/notes', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const playerId = String(req.params.playerId || '').trim();
    if (!playerId) return res.status(400).json({ error: 'playerId is required.' });
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';
    await query(
      `UPDATE ch25_watchlist SET notes = $1 WHERE kingdom_id = $2 AND player_id = $3`,
      [notes, kingdomId, playerId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update notes.' });
  }
});

router.delete('/:playerId', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const playerId = String(req.params.playerId || '').trim();
    if (!playerId) return res.status(400).json({ error: 'playerId is required.' });
    await query(
      'DELETE FROM ch25_watchlist WHERE kingdom_id = $1 AND player_id = $2',
      [kingdomId, playerId]
    );
    logActivity({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: 'ch25_watchlist_remove', entityType: 'ch25_watchlist',
      entityId: playerId, kingdomId,
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove from <CH25 watchlist.' });
  }
});

module.exports = router;
