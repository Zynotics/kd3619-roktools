// routes/auth.js – Authentifizierung: Register, Login, Validate

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, get, getActiveR5Access } = require('../db-pg');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { userGovIdExists, findKingdomBySlug } = require('../helpers');

const router = express.Router();

router.post('/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;
    if (!governorId || !String(governorId).trim()) {
      return res.status(400).json({ exists: false, error: 'Gov ID is required' });
    }
    const isTaken = await userGovIdExists(governorId);
    res.json({ isTaken });
  } catch (err) {
    console.error('check-gov-id error:', err);
    res.status(500).json({ error: 'Gov ID check failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, governorId, slug } = req.body;

    if (!email || !username || !password || !governorId) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const normalizedGovId = String(governorId).trim();

    if (await userGovIdExists(normalizedGovId)) {
      return res.status(400).json({ error: 'An account already exists for this Gov ID.' });
    }

    const existingUser = await get('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username is already taken' });
    }

    let assignedKingdomId = null;
    if (slug) {
      const k = await findKingdomBySlug(slug);
      if (k) assignedKingdomId = k.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_access_honor, can_access_analytics, can_access_overview, kingdom_id, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [userId, email, username, passwordHash, false, 'user', normalizedGovId, false, false, false, assignedKingdomId, false, false, false, false, false, false]
    );

    return res.json({
      message: 'Registration successful.',
      user: {
        id: userId,
        email,
        username,
        isApproved: false,
        role: 'user',
        governorId: normalizedGovId,
        kingdomId: assignedKingdomId,
        canManageOverviewFiles: false,
        canManageHonorFiles: false,
        canManageActivityFiles: false,
        canManageAnalyticsFiles: false,
        canAccessKvkManager: false,
        canAccessMigrationList: false,
      },
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const user = await get(
      'SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list FROM users WHERE username = $1',
      [username]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const activeR5Access = user.role === 'r5' ? await getActiveR5Access(user.id) : null;
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      isApproved: !!user.is_approved,
      governorId: user.governor_id || null,
      kingdomId: user.kingdom_id || null,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        ...tokenPayload,
        email: user.email,
        canManageOverviewFiles: !!user.can_manage_overview_files,
        canManageHonorFiles: !!user.can_manage_honor_files,
        canManageActivityFiles: !!user.can_manage_activity_files,
        canManageAnalyticsFiles: !!user.can_manage_analytics_files,
        canAccessKvkManager: !!user.can_access_kvk_manager,
        canAccessMigrationList: !!user.can_access_migration_list,
        r5AccessValid: user.role === 'r5' ? !!activeR5Access : false,
        r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/validate', authenticateToken, async (req, res) => {
  try {
    const user = await get(
      'SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager, can_access_migration_list FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeR5Access = user.role === 'r5' ? await getActiveR5Access(user.id) : null;

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      isApproved: !!user.is_approved,
      role: user.role,
      governorId: user.governor_id || null,
      canAccessHonor: !!user.can_access_honor,
      canAccessAnalytics: !!user.can_access_analytics,
      canAccessOverview: !!user.can_access_overview,
      kingdomId: user.kingdom_id || null,
      canManageOverviewFiles: !!user.can_manage_overview_files,
      canManageHonorFiles: !!user.can_manage_honor_files,
      canManageActivityFiles: !!user.can_manage_activity_files,
      canManageAnalyticsFiles: !!user.can_manage_analytics_files,
      canAccessKvkManager: !!user.can_access_kvk_manager,
      canAccessMigrationList: !!user.can_access_migration_list,
      r5AccessValid: user.role === 'r5' ? !!activeR5Access : false,
      r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Token validation failed' });
  }
});

module.exports = router;
