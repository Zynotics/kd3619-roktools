// middleware/auth.js – Auth-Middlewares und Berechtigungsprüfungen

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, getActiveR5Access } = require('../db-pg');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('\n==============================================================');
  console.warn('WARNING: JWT_SECRET env variable is NOT set!');
  console.warn('Generating a random secret for this process — all existing sessions will be invalidated on restart.');
  console.warn('Set JWT_SECRET in your environment for stable authentication.');
  console.warn('==============================================================\n');
  JWT_SECRET = crypto.randomBytes(64).toString('hex');
}

function getKingdomId(req) {
  return req.user.role === 'admin' ? null : req.user.kingdomId;
}

function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    const dbUser = await get(
      'SELECT role, kingdom_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list FROM users WHERE id = $1',
      [user.id]
    );
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    let activeR5Access = null;
    if (dbUser.role === 'r5') {
      activeR5Access = await getActiveR5Access(user.id);
    }

    req.user = {
      ...user,
      role: dbUser.role,
      kingdomId: dbUser.kingdom_id || null,
      canAccessHonor: !!dbUser.can_access_honor,
      canAccessAnalytics: !!dbUser.can_access_analytics,
      canAccessOverview: !!dbUser.can_access_overview,
      canManageOverviewFiles: !!dbUser.can_manage_overview_files,
      canManageHonorFiles: !!dbUser.can_manage_honor_files,
      canManageActivityFiles: !!dbUser.can_manage_activity_files,
      canManageAnalyticsFiles: !!dbUser.can_manage_analytics_files,
      canAccessKvkManager: !!dbUser.can_access_kvk_manager,
      canAccessMigrationList: !!dbUser.can_access_migration_list,
      r5AccessValid: dbUser.role === 'r5' ? !!activeR5Access : false,
      r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null,
    };
    next();
  });
}

async function getOptionalUser(req) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const dbUser = await get('SELECT id, role, kingdom_id FROM users WHERE id = $1', [decoded.id]);
    if (!dbUser) return null;
    const activeR5Access = dbUser.role === 'r5' ? await getActiveR5Access(dbUser.id) : null;
    return {
      id: dbUser.id,
      role: dbUser.role,
      kingdomId: dbUser.kingdom_id || null,
      r5AccessValid: dbUser.role === 'r5' ? !!activeR5Access : false,
    };
  } catch (e) {
    return null;
  }
}

function isActiveR5(req) {
  return req.user && req.user.role === 'r5' && req.user.r5AccessValid;
}

function ensureActiveR5OrDeny(res) {
  return res.status(403).json({ error: 'R5 access expired or not activated.' });
}

function requireReadAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const role = req.user.role;
  if (role !== 'admin' && role !== 'r5' && role !== 'r4') {
    return res.status(403).json({ error: 'Admin, R5 or R4 rights required' });
  }
  if (role === 'r5' && !isActiveR5(req)) return ensureActiveR5OrDeny(res);
  if ((role === 'r5' || role === 'r4') && !req.user.kingdomId) {
    return res.status(403).json({ error: `${role.toUpperCase()} user is not assigned to a kingdom.` });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const role = req.user.role;
  if (role !== 'admin' && role !== 'r5') return res.status(403).json({ error: 'Admin or R5 rights required' });
  if (role === 'r5' && !isActiveR5(req)) return ensureActiveR5OrDeny(res);
  if (role === 'r5' && !req.user.kingdomId) return res.status(403).json({ error: 'R5 user is not assigned to a kingdom.' });
  next();
}

function requireKvkManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { role, kingdomId, canAccessKvkManager } = req.user;

  if (role === 'admin') return next();

  if (role === 'r5') {
    if (!isActiveR5(req)) return ensureActiveR5OrDeny(res);
    if (!kingdomId) return res.status(403).json({ error: 'R5 user is not assigned to a kingdom.' });
    return next();
  }

  if (role === 'r4' && canAccessKvkManager) {
    if (!kingdomId) return res.status(403).json({ error: 'R4 user is not assigned to a kingdom.' });
    return next();
  }

  return res.status(403).json({ error: 'Admin, R5 or KvK Manager rights required' });
}

/**
 * Factory for middlewares that gate Admin / R5 / authorized-R4 access to a feature.
 * Both Watchlist and MigrationList use this pattern; only difference is whether
 * R5 users require an active access code (MigrationList does; Watchlist does not).
 */
function createRoleAccessMiddleware({ requireR5Active }) {
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { role, kingdomId, canAccessMigrationList } = req.user;

    if (role === 'admin') return next();

    if (role === 'r5') {
      if (requireR5Active && !isActiveR5(req)) return ensureActiveR5OrDeny(res);
      if (!kingdomId) return res.status(403).json({ error: 'R5 user is not assigned to a kingdom.' });
      return next();
    }

    if (role === 'r4' && canAccessMigrationList) {
      if (!kingdomId) return res.status(403).json({ error: 'R4 user is not assigned to a kingdom.' });
      return next();
    }

    return res.status(403).json({ error: 'Admin, R5 or authorized R4 required' });
  };
}

const requireWatchlistAccess = createRoleAccessMiddleware({ requireR5Active: false });
const requireMigrationListAccess = createRoleAccessMiddleware({ requireR5Active: true });

function hasFileManagementAccess(req, type) {
  const { role, canManageOverviewFiles, canManageHonorFiles, canManageActivityFiles, canManageAnalyticsFiles } = req.user;

  if (role === 'admin') return true;
  if (role === 'r5') return !!req.user.r5AccessValid;

  if (role === 'r4') {
    if (type === 'activity') return !!canManageActivityFiles;
    if (type === 'overview' || type === 'honor' || type === 'analytics') {
      return !!canManageAnalyticsFiles || !!canManageOverviewFiles || !!canManageHonorFiles;
    }
  }

  return false;
}

module.exports = {
  JWT_SECRET,
  getKingdomId,
  authenticateToken,
  getOptionalUser,
  isActiveR5,
  requireReadAccess,
  requireAdmin,
  requireKvkManager,
  requireMigrationListAccess,
  requireWatchlistAccess,
  hasFileManagementAccess,
};
