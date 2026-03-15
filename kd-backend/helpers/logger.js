// helpers/logger.js – Activity Logger

const { query } = require('../db-pg');

async function logActivity({ userId, username, role, action, entityType, entityId, details, kingdomId }) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, username, role, action, entity_type, entity_id, details, kingdom_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        username || null,
        role || null,
        action,
        entityType || null,
        entityId || null,
        details ? JSON.stringify(details) : null,
        kingdomId || null,
      ]
    );
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

module.exports = { logActivity };
