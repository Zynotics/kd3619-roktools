// routes/admin/logs.js – Activity Log Viewer (Superadmin only)

const express = require('express');
const { all, query } = require('../../db-pg');
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

// GET /api/admin/logs
// Query params: userId, username, action, kingdomId, dateFrom, dateTo, page, limit
router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Superadmin only' });
  }

  try {
    const params = [];
    const conditions = [];

    if (req.query.userId) {
      conditions.push(`user_id = $${params.length + 1}`);
      params.push(req.query.userId);
    }

    if (req.query.username) {
      conditions.push(`LOWER(username) LIKE $${params.length + 1}`);
      params.push(`%${req.query.username.toLowerCase()}%`);
    }

    if (req.query.action) {
      conditions.push(`action = $${params.length + 1}`);
      params.push(req.query.action);
    }

    if (req.query.kingdomId) {
      conditions.push(`kingdom_id = $${params.length + 1}`);
      params.push(req.query.kingdomId);
    }

    if (req.query.dateFrom) {
      conditions.push(`created_at >= $${params.length + 1}`);
      params.push(req.query.dateFrom);
    }

    if (req.query.dateTo) {
      conditions.push(`created_at <= $${params.length + 1}`);
      params.push(req.query.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) FROM activity_logs ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    const rows = await all(
      `SELECT id, user_id, username, role, action, entity_type, entity_id, details, kingdom_id, created_at
       FROM activity_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error('Error loading activity logs:', e);
    res.status(500).json({ error: 'Failed to load activity logs' });
  }
});

module.exports = router;
