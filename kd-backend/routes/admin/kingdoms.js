// routes/admin/kingdoms.js – Kingdom-Verwaltung

const express = require('express');
const { query, get, all, assignR5, updateKingdomStatus, deleteKingdom, activateR5Code } = require('../../db-pg');
const { authenticateToken, requireAdmin, requireReadAccess, getKingdomId } = require('../../middleware/auth');
const { findKingdomBySlug } = require('../../helpers');

const router = express.Router();

// Alle Kingdoms abrufen
router.get('/', authenticateToken, requireReadAccess, async (req, res) => {
  try {
    const kId = getKingdomId(req);
    const p = [];
    let where = '';
    if (kId) { where = 'WHERE k.id = $1'; p.push(kId); }

    const kingdoms = await all(
      `SELECT k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.created_at, k.updated_at, k.owner_user_id, u.username AS owner_username, u.email AS owner_email
       FROM kingdoms k LEFT JOIN users u ON u.id = k.owner_user_id ${where} ORDER BY k.created_at DESC`,
      p
    );

    res.json(kingdoms.map((k) => ({
      id: k.id,
      displayName: k.display_name,
      slug: k.slug,
      rokIdentifier: k.rok_identifier,
      status: k.status,
      plan: k.plan,
      createdAt: k.created_at,
      ownerUserId: k.owner_user_id,
      ownerUsername: k.owner_username,
      ownerEmail: k.owner_email,
    })));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load kingdoms' });
  }
});

// Kingdom erstellen (nur Superadmin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const { displayName, slug, rokIdentifier } = req.body;
    const id = 'kdm-' + Date.now();
    const nSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existingBySlug = await findKingdomBySlug(nSlug);
    if (existingBySlug) {
      return res.status(400).json({ error: `Slug '${nSlug}' is already assigned to kingdom '${existingBySlug.display_name}'` });
    }

    await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [id, displayName, nSlug, rokIdentifier]);
    res.json({ id, displayName, slug: nSlug });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create kingdom' });
  }
});

// Kingdom bearbeiten (nur Superadmin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const { displayName, slug } = req.body;
    if (!displayName || !slug) return res.status(400).json({ error: 'Display Name and Slug required' });

    const normalizedSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existingBySlug = await get('SELECT id, display_name FROM kingdoms WHERE LOWER(slug) = $1 AND id != $2 LIMIT 1', [normalizedSlug, req.params.id]);
    if (existingBySlug) {
      return res.status(400).json({ error: `Slug '${normalizedSlug}' is already assigned to kingdom '${existingBySlug.display_name}'` });
    }

    await query('UPDATE kingdoms SET display_name = $1, slug = $2, updated_at = NOW() WHERE id = $3', [displayName, normalizedSlug, req.params.id]);

    const updated = await get(
      `SELECT k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.created_at, k.updated_at, k.owner_user_id, u.username AS owner_username, u.email AS owner_email
       FROM kingdoms k LEFT JOIN users u ON u.id = k.owner_user_id WHERE k.id = $1`,
      [req.params.id]
    );

    res.json({
      kingdom: {
        id: updated.id,
        displayName: updated.display_name,
        slug: updated.slug,
        rokIdentifier: updated.rok_identifier,
        status: updated.status,
        plan: updated.plan,
        createdAt: updated.created_at,
        ownerUserId: updated.owner_user_id,
        ownerUsername: updated.owner_username,
        ownerEmail: updated.owner_email,
      },
    });
  } catch (e) {
    console.error('Update kingdom error:', e);
    res.status(500).json({ error: 'Failed to update kingdom' });
  }
});

// R5 zu Kingdom zuweisen (nur Superadmin)
router.post('/:id/assign-r5', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const { r5UserId, accessCode } = req.body;
    if (!r5UserId) return res.status(400).json({ error: 'R5 user is required.' });

    const targetUser = await get('SELECT id FROM users WHERE id = $1', [r5UserId]);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [req.params.id]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });

    let expiresAt = null;
    if (accessCode) {
      const activation = await activateR5Code(accessCode, r5UserId, req.params.id);
      expiresAt = activation.expires_at;
    }

    await assignR5(r5UserId, req.params.id);
    await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [r5UserId]);
    res.json({ success: true, message: 'R5 assigned.', expiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to assign R5' });
  }
});

// Kingdom-Status ändern (nur Superadmin)
router.post('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    await updateKingdomStatus(req.params.id, req.body.status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update kingdom status' });
  }
});

// Kingdom löschen (nur Superadmin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const k = await get('SELECT slug FROM kingdoms WHERE id=$1', [req.params.id]);
    if (k && k.slug === 'default-kingdom') return res.status(400).json({ error: 'Protected' });
    await deleteKingdom(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete kingdom' });
  }
});

module.exports = router;
