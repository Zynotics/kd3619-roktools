// routes/ch25watchlist.js – Persistent <CH25 watchlist (player_ids that came
// from a Top 1000 upload but should be monitored independently). Mirrors the
// regular Watchlist feature: tracks location, zeroed state, and a baseline
// snapshot of power/troops/CH so Δ Power can be derived without needing
// historical Top 1000 uploads.

const express = require('express');
const { query, all } = require('../db-pg');
const { authenticateToken, requireMigrationListAccess } = require('../middleware/auth');
const { resolveKingdomIdFromRequest } = require('../helpers');
const { logActivity } = require('../helpers/logger');

const router = express.Router();

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
}

router.get('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const rows = await all(
      `SELECT player_id, notes, added_at, location, zeroed, zeroed_at,
              base_power, base_troops_power, base_name, base_alliance, base_ch
         FROM ch25_watchlist
        WHERE kingdom_id = $1
        ORDER BY added_at DESC`,
      [kingdomId]
    );
    res.json(rows.map(row => ({
      playerId: row.player_id,
      notes: row.notes || '',
      addedAt: row.added_at ? row.added_at.toISOString() : null,
      location: row.location || '',
      zeroed: !!row.zeroed,
      zeroedAt: row.zeroed_at ? row.zeroed_at.toISOString() : null,
      basePower: row.base_power !== null ? Number(row.base_power) : null,
      baseTroopsPower: row.base_troops_power !== null ? Number(row.base_troops_power) : null,
      baseName: row.base_name || '',
      baseAlliance: row.base_alliance || '',
      baseCh: row.base_ch !== null ? Number(row.base_ch) : null,
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
    const basePower = toIntOrNull(req.body?.basePower);
    const baseTroopsPower = toIntOrNull(req.body?.baseTroopsPower);
    const baseName = typeof req.body?.baseName === 'string' ? req.body.baseName : null;
    const baseAlliance = typeof req.body?.baseAlliance === 'string' ? req.body.baseAlliance : null;
    const baseCh = toIntOrNull(req.body?.baseCh);

    await query(
      `INSERT INTO ch25_watchlist
         (kingdom_id, player_id, notes, added_at, added_by_user_id,
          base_power, base_troops_power, base_name, base_alliance, base_ch)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
       ON CONFLICT (kingdom_id, player_id) DO UPDATE SET
         notes = COALESCE(EXCLUDED.notes, ch25_watchlist.notes),
         base_power = COALESCE(EXCLUDED.base_power, ch25_watchlist.base_power),
         base_troops_power = COALESCE(EXCLUDED.base_troops_power, ch25_watchlist.base_troops_power),
         base_name = COALESCE(EXCLUDED.base_name, ch25_watchlist.base_name),
         base_alliance = COALESCE(EXCLUDED.base_alliance, ch25_watchlist.base_alliance),
         base_ch = COALESCE(EXCLUDED.base_ch, ch25_watchlist.base_ch)`,
      [kingdomId, playerId, notes, req.user.id, basePower, baseTroopsPower, baseName, baseAlliance, baseCh]
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

// Unified partial update — accepts any subset of {location, zeroed, notes}.
router.patch('/:playerId', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const playerId = String(req.params.playerId || '').trim();
    if (!playerId) return res.status(400).json({ error: 'playerId is required.' });

    const sets = [];
    const params = [];
    let i = 1;

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'location')) {
      sets.push(`location = $${i++}`);
      params.push(typeof req.body.location === 'string' ? req.body.location : null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      sets.push(`notes = $${i++}`);
      params.push(typeof req.body.notes === 'string' ? req.body.notes : null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'zeroed')) {
      const next = !!req.body.zeroed;
      sets.push(`zeroed = $${i++}`);
      params.push(next);
      // When flipping zeroed on, stamp now; when off, clear. Clients can
      // override by sending zeroedAt explicitly.
      if (Object.prototype.hasOwnProperty.call(req.body, 'zeroedAt')) {
        sets.push(`zeroed_at = $${i++}`);
        params.push(req.body.zeroedAt || null);
      } else {
        sets.push(`zeroed_at = ${next ? 'NOW()' : 'NULL'}`);
      }
    }

    if (sets.length === 0) return res.json({ success: true });

    params.push(kingdomId);
    params.push(playerId);
    await query(
      `UPDATE ch25_watchlist SET ${sets.join(', ')} WHERE kingdom_id = $${i++} AND player_id = $${i}`,
      params
    );
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// Legacy single-field route kept for backward compat.
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
