// routes/admin/r5codes.js – R5 Access Code Verwaltung & Kingdom-Erstellung

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  query, get, all,
  generateR5Code, getR5Codes, getR5Code, activateR5Code, assignR5Code, deactivateR5Code,
  assignR5, getActiveR5Access,
} = require('../../db-pg');
const { authenticateToken, requireAdmin } = require('../../middleware/auth');
const { findKingdomBySlug, slugify, generateUniqueSlug } = require('../../helpers');
const { deleteKingdom } = require('../../db-pg');

const router = express.Router();

const R5_CODE_DURATIONS = [0, 1, 7, 14, 30, 60, 365];

function formatCode(c) {
  return {
    code: c.code,
    durationDays: c.duration_days,
    createdAt: c.created_at,
    usedByUserId: c.used_by_user_id,
    kingdomId: c.kingdom_id,
    activatedAt: c.activated_at,
    expiresAt: c.expires_at,
    isActive: c.is_active,
  };
}

// Alle Codes abrufen (mit optionaler Pagination via ?page=1&limit=20)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    if (req.query.page) {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const countRes = await query('SELECT COUNT(*) FROM r5_codes');
      const total = parseInt(countRes.rows[0].count);

      const rows = await all('SELECT * FROM r5_codes ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
      return res.json({
        data: rows.map(formatCode),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const codes = await getR5Codes();
    res.json(codes.map(formatCode));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load R5 codes' });
  }
});

// Code erstellen
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const { durationDays } = req.body;
    if (!R5_CODE_DURATIONS.includes(Number(durationDays))) {
      return res.status(400).json({ error: `Invalid duration. Allowed values are ${R5_CODE_DURATIONS.join(', ')} days.` });
    }
    const code = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
    const created = await generateR5Code(Number(durationDays), code);
    res.json({ code: created.code, durationDays: created.duration_days, createdAt: created.created_at });
  } catch (error) {
    res.status(500).json({ error: 'R5 code could not be created' });
  }
});

// Code aktivieren (Admin)
router.post('/activate', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const { code, userId, kingdomId, assignOnly } = req.body;
    if (!code || !userId) return res.status(400).json({ error: 'Code and user are required.' });

    const user = await get('SELECT id FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userKingdom = await get('SELECT kingdom_id FROM users WHERE id = $1', [userId]);
    const targetKingdomId = kingdomId || userKingdom?.kingdom_id;
    if (!targetKingdomId) return res.status(400).json({ error: 'User has no kingdom.' });

    const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [targetKingdomId]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });

    if (assignOnly) {
      const assigned = await assignR5Code(code, userId, targetKingdomId);
      return res.json({
        success: true,
        assignedOnly: true,
        code: assigned.code,
        durationDays: assigned.duration_days,
        kingdomId: assigned.kingdom_id,
        usedByUserId: assigned.used_by_user_id,
      });
    }

    const activation = await activateR5Code(code, userId, targetKingdomId);
    await assignR5(userId, targetKingdomId);
    await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [userId]);

    res.json({ success: true, activatedAt: activation.activated_at, durationDays: activation.duration_days });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Activation failed' });
  }
});

// Code deaktivieren
router.post('/:code/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const existing = await getR5Code(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Code not found' });

    const cleared = await deactivateR5Code(req.params.code, { clearAssignment: true });
    return res.json({ success: true, ...formatCode(cleared) });
  } catch (error) {
    res.status(500).json({ error: 'Code could not be deactivated' });
  }
});

// Code löschen
router.delete('/:code', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const existing = await getR5Code(req.params.code);
    if (!existing) return res.status(404).json({ error: 'Code not found' });

    if (existing.used_by_user_id || existing.is_active) {
      await deactivateR5Code(req.params.code, { clearAssignment: true });
    }
    await query('DELETE FROM r5_codes WHERE code = $1', [req.params.code]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Code could not be deleted' });
  }
});

// Eigene Codes abrufen (Kunde)
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const codes = await all(
      `SELECT code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active
       FROM r5_codes WHERE used_by_user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(codes.map(formatCode));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load your R5 codes' });
  }
});

// Code selbst aktivieren (Kunde)
router.post('/activate-self', authenticateToken, async (req, res) => {
  try {
    const { code, kingdomId } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required.' });

    const dbUser = await get('SELECT kingdom_id FROM users WHERE id = $1', [req.user.id]);
    const targetKingdomId = kingdomId || dbUser?.kingdom_id || req.user.kingdomId;

    if (!targetKingdomId) {
      return res.status(400).json({ error: 'No kingdom assigned. Please contact the superadmin.' });
    }

    const targetCode = await getR5Code(code);
    if (targetCode && Number(targetCode.duration_days) === 0) {
      return res.status(403).json({ error: 'Lifetime codes can only be assigned by the superadmin.' });
    }

    const activation = await activateR5Code(code, req.user.id, targetKingdomId);
    await assignR5(req.user.id, targetKingdomId);
    await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [req.user.id]);

    return res.json({
      success: true,
      activatedAt: activation.activated_at,
      durationDays: activation.duration_days,
      kingdomId: targetKingdomId,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Activation failed' });
  }
});

// Eigenes Kingdom anzeigen (wird unter /api/me/kingdom gemountet)
router.get('/kingdom', authenticateToken, async (req, res) => {
  try {
    if (!req.user.kingdomId) return res.json({ kingdom: null });
    const kingdom = await get('SELECT id, display_name, slug, status, plan FROM kingdoms WHERE id = $1', [req.user.kingdomId]);
    if (!kingdom) return res.json({ kingdom: null });
    return res.json({
      kingdom: {
        id: kingdom.id,
        displayName: kingdom.display_name,
        slug: kingdom.slug,
        status: kingdom.status,
        plan: kingdom.plan,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load kingdom' });
  }
});

// Kingdom erstellen + Code aktivieren (Kunde)
router.post('/create-kingdom', authenticateToken, async (req, res) => {
  let createdKingdomId = null;
  try {
    const { displayName, code } = req.body;
    const normalizedDisplayName = String(displayName || '').trim();

    if (!normalizedDisplayName) return res.status(400).json({ error: 'Display name is required.' });
    if (normalizedDisplayName.length < 3 || normalizedDisplayName.length > 40) {
      return res.status(400).json({ error: 'Display name must be between 3 and 40 characters.' });
    }
    if (!code || !String(code).trim()) return res.status(400).json({ error: 'Access code is required.' });
    if (req.user.kingdomId) return res.status(400).json({ error: 'You are already assigned to a kingdom.' });

    const existingName = await get('SELECT id FROM kingdoms WHERE LOWER(display_name) = $1 LIMIT 1', [normalizedDisplayName.toLowerCase()]);
    if (existingName) return res.status(400).json({ error: 'Display name is already taken.' });

    let baseSlug = slugify(normalizedDisplayName);
    if (!baseSlug) return res.status(400).json({ error: 'Display name is invalid for slug generation.' });
    if (baseSlug.length > 40) baseSlug = baseSlug.slice(0, 40).replace(/-+$/g, '');

    const targetCode = await getR5Code(String(code).trim().toUpperCase());
    if (!targetCode) return res.status(404).json({ error: 'Code not found.' });
    if (targetCode.is_active) return res.status(400).json({ error: 'Code has already been activated.' });
    if (targetCode.used_by_user_id && targetCode.used_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Code is assigned to another user.' });
    }
    if (Number(targetCode.duration_days) === 0) {
      return res.status(403).json({ error: 'Lifetime codes can only be assigned by the superadmin.' });
    }

    const slug = await generateUniqueSlug(baseSlug);
    const kingdomId = 'kdm-' + Date.now();
    createdKingdomId = kingdomId;

    await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [kingdomId, normalizedDisplayName, slug, null]);

    const activation = await activateR5Code(String(code).trim().toUpperCase(), req.user.id, kingdomId);
    await assignR5(req.user.id, kingdomId);
    await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [req.user.id]);

    return res.json({
      success: true,
      kingdom: { id: kingdomId, displayName: normalizedDisplayName, slug },
      activatedAt: activation.activated_at,
      durationDays: activation.duration_days,
    });
  } catch (error) {
    console.error('Error creating kingdom with code:', error);
    if (createdKingdomId) {
      try { await deleteKingdom(createdKingdomId); } catch (e) { console.error('Cleanup failed:', e); }
    }
    return res.status(400).json({ error: error.message || 'Kingdom creation failed.' });
  }
});

module.exports = router;
