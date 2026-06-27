// routes/top1000.js – Top 1000 upload + <CH25 watchlist

const express = require('express');
const fs = require('fs');
const { query, get, all } = require('../db-pg');
const { authenticateToken, requireMigrationListAccess } = require('../middleware/auth');
const { resolveKingdomIdFromRequest, parseExcel } = require('../helpers');
const { top1000Upload } = require('../config/multer');
const { logActivity } = require('../helpers/logger');

const router = express.Router();

// ==================== TOP 1000 (latest upload per kingdom) ====================

router.get('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const row = await get(
      'SELECT filename, uploaded_at, headers, data FROM top1000_uploads WHERE kingdom_id = $1',
      [kingdomId]
    );
    if (!row) return res.json(null);
    let headers = [];
    let data = [];
    try { headers = row.headers ? JSON.parse(row.headers) : []; } catch (_) { headers = []; }
    try { data = row.data ? JSON.parse(row.data) : []; } catch (_) { data = []; }
    res.json({
      filename: row.filename,
      uploadedAt: row.uploaded_at ? row.uploaded_at.toISOString() : null,
      headers,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load Top 1000.' });
  }
});

router.post('/upload', authenticateToken, requireMigrationListAccess, top1000Upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  let kingdomId;
  try {
    kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
  } catch (error) {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: error.message || 'Invalid kingdom context.' });
  }

  try {
    const { headers, data } = await parseExcel(req.file.path);

    await query(
      `INSERT INTO top1000_uploads (kingdom_id, filename, uploaded_at, uploaded_by_user_id, headers, data)
         VALUES ($1, $2, NOW(), $3, $4, $5)
       ON CONFLICT (kingdom_id) DO UPDATE SET
         filename = EXCLUDED.filename,
         uploaded_at = NOW(),
         uploaded_by_user_id = EXCLUDED.uploaded_by_user_id,
         headers = EXCLUDED.headers,
         data = EXCLUDED.data`,
      [kingdomId, req.file.originalname, req.user.id, JSON.stringify(headers), JSON.stringify(data)]
    );

    // We persist the parsed data in the DB — the uploaded file on disk is no
    // longer needed (large rosters waste disk on every re-upload).
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    logActivity({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: 'top1000_upload', entityType: 'top1000',
      details: { filename: req.file.originalname, rowCount: data.length }, kingdomId,
    });
    res.json({ success: true, rowCount: data.length });
  } catch (error) {
    console.error(error);
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch (_) {}
    res.status(500).json({ error: 'Upload failed.' });
  }
});

router.delete('/', authenticateToken, requireMigrationListAccess, async (req, res) => {
  try {
    const kingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    await query('DELETE FROM top1000_uploads WHERE kingdom_id = $1', [kingdomId]);
    logActivity({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: 'top1000_delete', entityType: 'top1000', kingdomId,
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete Top 1000.' });
  }
});

module.exports = router;
