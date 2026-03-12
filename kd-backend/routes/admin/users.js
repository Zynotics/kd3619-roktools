// routes/admin/users.js – User-Verwaltung durch Admin/R5

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, get, all, assignR5, activateR5Code } = require('../../db-pg');
const { authenticateToken, requireAdmin, getKingdomId } = require('../../middleware/auth');

const router = express.Router();

// Admin-Benutzer anlegen (Setup-Endpoint)
router.post('/create-admin', async (req, res) => {
  try {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      ['admin-001', 'admin@kd3619.com', 'Stadmin', adminPasswordHash, true, 'admin', null, true, true, true, true, true, true]
    );
    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    isApproved: !!user.is_approved,
    role: user.role,
    createdAt: user.created_at,
    kingdomId: user.kingdom_id || null,
    governorId: user.governor_id || null,
    canAccessHonor: !!user.can_access_honor,
    canAccessAnalytics: !!user.can_access_analytics,
    canAccessOverview: !!user.can_access_overview,
    canManageOverviewFiles: !!user.can_manage_overview_files,
    canManageHonorFiles: !!user.can_manage_honor_files,
    canManageActivityFiles: !!user.can_manage_activity_files,
    canManageAnalyticsFiles: !!user.can_manage_analytics_files,
    canAccessKvkManager: !!user.can_access_kvk_manager,
    canAccessMigrationList: !!user.can_access_migration_list,
  };
}

// Alle User abrufen
// Query params: ?search=xxx &role=r4 &approved=true|false &page=1 &limit=20
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userKingdomId = getKingdomId(req);
    const params = [];
    const conditions = [];

    if (userKingdomId) {
      conditions.push(`kingdom_id = $${params.length + 1}`);
      params.push(userKingdomId);
    }

    // Serverseitige Suche: username, email oder governor_id
    if (req.query.search) {
      const term = `%${req.query.search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(username) LIKE $${params.length + 1} OR LOWER(email) LIKE $${params.length + 2} OR LOWER(COALESCE(governor_id,'')) LIKE $${params.length + 3})`);
      params.push(term, term, term);
    }

    if (req.query.role && req.query.role !== 'all') {
      conditions.push(`role = $${params.length + 1}`);
      params.push(req.query.role);
    }

    if (req.query.approved === 'true') {
      conditions.push(`is_approved = TRUE`);
    } else if (req.query.approved === 'false') {
      conditions.push(`is_approved = FALSE`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseQuery = `SELECT id, email, username, is_approved, role, created_at, kingdom_id, governor_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list FROM users ${whereClause}`;

    // Pagination (opt-in)
    if (req.query.page) {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const countRes = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count);

      const rows = await all(
        `${baseQuery} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return res.json({
        data: rows.map(formatUser),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const users = await all(`${baseQuery} ORDER BY created_at DESC`, params);
    res.json(users.map(formatUser));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// User genehmigen/ablehnen
router.post('/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, approved } = req.body;
    const currentUserKingdomId = getKingdomId(req);

    if (!userId || typeof approved !== 'boolean') return res.status(400).json({ error: 'Invalid input' });

    if (currentUserKingdomId) {
      const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
      if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Access denied' });
      if (target.role === 'admin') return res.status(403).json({ error: 'No access to admin' });
    }

    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [approved, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user approval' });
  }
});

// Feature-Zugriff setzen (Honor, Analytics, Overview)
router.post('/access', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, canAccessHonor, canAccessAnalytics, canAccessOverview } = req.body;
    const currentUserKingdomId = getKingdomId(req);

    if (currentUserKingdomId) {
      const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
      if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Access denied' });
    }

    await query(
      `UPDATE users SET can_access_honor=$1, can_access_analytics=$2, can_access_overview=$3 WHERE id=$4`,
      [!!canAccessHonor, !!canAccessAnalytics, !!canAccessOverview, userId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user access' });
  }
});

// Datei-Verwaltungsrechte setzen
router.post('/access-files', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, canManageActivityFiles, canManageAnalyticsFiles, canAccessKvkManager, canAccessMigrationList } = req.body;
    const currentUserKingdomId = getKingdomId(req);

    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const targetUser = await get('SELECT role, kingdom_id FROM users WHERE id = $1', [userId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin' || userId === req.user.id) {
      return res.status(403).json({ error: 'No access to change these user rights.' });
    }

    if (currentUserKingdomId) {
      if (!targetUser.kingdom_id || targetUser.kingdom_id !== currentUserKingdomId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const analyticsFlag = !!canManageAnalyticsFiles;
    await query(
      `UPDATE users SET can_manage_overview_files=$1, can_manage_honor_files=$2, can_manage_activity_files=$3, can_manage_analytics_files=$4, can_access_kvk_manager=$5, can_access_migration_list=$6 WHERE id=$7`,
      [analyticsFlag, analyticsFlag, !!canManageActivityFiles, analyticsFlag, !!canAccessKvkManager, !!canAccessMigrationList, userId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Error in /access-files:', e);
    res.status(500).json({ error: 'Failed to update file access rights' });
  }
});

// Rolle ändern
router.post('/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, role, accessCode, kingdomId: requestedKingdomId } = req.body;
    const currentUserRole = req.user.role;
    const currentUserKingdomId = getKingdomId(req);

    if (currentUserRole === 'r5' && !['user', 'r4', 'r5'].includes(role)) {
      return res.status(403).json({ error: 'R5 can only assign user/r4/r5.' });
    }

    if (currentUserKingdomId) {
      const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
      if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Access denied' });
      if (currentUserRole === 'r5' && target.role === 'admin') return res.status(403).json({ error: 'No access to admin.' });
    }

    if (role === 'r5') {
      if (currentUserRole !== 'admin') return res.status(403).json({ error: 'R5 roles can only be assigned by the superadmin.' });

      const targetK = requestedKingdomId || currentUserKingdomId || (await get('SELECT kingdom_id FROM users WHERE id = $1', [userId]))?.kingdom_id;
      if (!targetK) return res.status(400).json({ error: 'A kingdom is required for R5.' });

      const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [targetK]);
      if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });

      if (accessCode) {
        await activateR5Code(accessCode, userId, targetK);
      }

      await assignR5(userId, targetK);
      await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [userId]);
      return res.json({ success: true, expiresAt: null });
    }

    let sql = 'UPDATE users SET role = $1 WHERE id = $2';
    let p = [role, userId];

    if (role === 'user' || role === 'r4' || (role === 'r5' && currentUserRole !== 'admin')) {
      sql = 'UPDATE users SET role = $1, kingdom_id = $3 WHERE id = $2';
      const targetK = currentUserKingdomId || (await get('SELECT kingdom_id FROM users WHERE id = $1', [userId]))?.kingdom_id;
      p = [role, userId, targetK];
    }

    await query(sql, p);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// User löschen / aus Kingdom entfernen
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserKingdomId = getKingdomId(req);
    const currentUserRole = req.user.role;

    if (currentUserKingdomId) {
      const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
      if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Access denied' });
      if (req.user.role === 'r5' && (target.role === 'r5' || target.role === 'admin')) return res.status(403).json({ error: 'No access' });
    }

    if (currentUserRole === 'admin') {
      await query('DELETE FROM users WHERE id = $1', [userId]);
      return res.json({ success: true, deleted: true });
    }

    if (currentUserRole === 'r5') {
      const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
      if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Access denied' });
      if (target.role === 'r5' || target.role === 'admin') return res.status(403).json({ error: 'No access' });
      await query(
        'UPDATE users SET role = $1, kingdom_id = NULL, is_approved = FALSE, can_access_honor = FALSE, can_access_analytics = FALSE, can_access_overview = FALSE, can_manage_overview_files = FALSE, can_manage_honor_files = FALSE, can_manage_activity_files = FALSE, can_manage_analytics_files = FALSE, can_access_kvk_manager = FALSE, can_access_migration_list = FALSE WHERE id = $2',
        ['user', userId]
      );
      return res.json({ success: true, removedFromKingdom: true });
    }

    res.status(403).json({ error: 'No access' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// R4 zuweisen (nur Superadmin)
router.post('/assign-r4', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });

  try {
    const { userId, kingdomId } = req.body;

    if (!userId || !kingdomId) {
      return res.status(400).json({ error: 'User ID and kingdom ID are required.' });
    }

    const targetUser = await get('SELECT role FROM users WHERE id = $1', [userId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin' || targetUser.role === 'r5') {
      return res.status(403).json({ error: 'Cannot assign Admin/R5 roles via this endpoint.' });
    }

    await query(
      'UPDATE users SET role = $1, kingdom_id = $2, is_approved = true, can_manage_overview_files = false, can_manage_honor_files = false, can_manage_activity_files = false, can_access_migration_list = false WHERE id = $3',
      ['r4', kingdomId, userId]
    );
    return res.json({ success: true, message: `User ${userId} was assigned role R4 and kingdom ${kingdomId}.` });
  } catch (error) {
    console.error('Error during assign-r4:', error);
    return res.status(500).json({ error: 'R4 assignment failed' });
  }
});

module.exports = router;
