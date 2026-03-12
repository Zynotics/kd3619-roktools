// routes/migration.js – Migration List

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
      `SELECT player_id, reason, contacted, info, manually_added, excluded, migrated_override, zeroed, zeroed_at FROM migration_list_entries WHERE kingdom_id = $1`,
      [kingdomId]
    );
    res.json(rows.map((row) => ({
      playerId: row.player_id,
      reason: row.reason,
      contacted: row.contacted,
      info: row.info,
      manuallyAdded: row.manually_added,
      excluded: row.excluded,
      migratedOverride: row.migrated_override,
      zeroed: row.zeroed || false,
      zeroedAt: row.zeroed_at ? row.zeroed_at.toISOString() : null,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load migration list.' });
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

    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];

    await query('BEGIN');
    transactionStarted = true;

    // Full replace: remove all existing entries for this kingdom first
    await query('DELETE FROM migration_list_entries WHERE kingdom_id = $1', [kingdomId]);

    if (entries.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;

      for (const entry of entries) {
        if (!entry || !entry.playerId) continue;
        const migratedOverride =
          entry.migratedOverride === true ? true : entry.migratedOverride === false ? false : null;

        values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},NOW())`);
        params.push(
          kingdomId,
          String(entry.playerId),
          entry.reason || null,
          entry.contacted || null,
          entry.info || null,
          !!entry.manuallyAdded,
          !!entry.excluded,
          migratedOverride,
          req.user.id,
          !!entry.zeroed,
          entry.zeroedAt || null
        );
      }

      if (values.length > 0) {
        await query(
          `INSERT INTO migration_list_entries
            (kingdom_id, player_id, reason, contacted, info, manually_added, excluded, migrated_override, updated_by_user_id, zeroed, zeroed_at, updated_at)
           VALUES ${values.join(',')}
           ON CONFLICT (kingdom_id, player_id)
           DO UPDATE SET
             reason = EXCLUDED.reason, contacted = EXCLUDED.contacted, info = EXCLUDED.info,
             manually_added = EXCLUDED.manually_added, excluded = EXCLUDED.excluded,
             migrated_override = EXCLUDED.migrated_override,
             zeroed = EXCLUDED.zeroed, zeroed_at = EXCLUDED.zeroed_at,
             updated_by_user_id = EXCLUDED.updated_by_user_id, updated_at = NOW()`,
          params
        );
      }
    }

    await query('COMMIT');
    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error(error);
    if (transactionStarted) {
      try { await query('ROLLBACK'); } catch (e) { console.error('Rollback failed:', e); }
    }
    res.status(500).json({ error: 'Failed to save migration list.' });
  }
});

module.exports = router;
