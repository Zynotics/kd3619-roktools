// routes/files.js – Datei-Upload, Abruf und Verwaltung (Overview, Honor, Activity)

const express = require('express');
const fs = require('fs');
const { query, get, all } = require('../db-pg');
const { authenticateToken, hasFileManagementAccess } = require('../middleware/auth');
const { normalizeFileRow, parseExcel, resolveKingdomIdFromRequest, ensureFilesBelongToKingdom } = require('../helpers');
const { overviewUpload, honorUpload, activityUpload } = require('../config/multer');

const router = express.Router();

function generateUploadName(date) {
  const d = date || new Date();
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year}; ${hh}:${mm}`;
}

// ==================== OVERVIEW ====================

router.get('/overview/files-data', authenticateToken, async (req, res) => {
  try {
    const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [kId]);
    res.json(rows.map(normalizeFileRow));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/overview/upload', authenticateToken, overviewUpload.single('file'), async (req, res) => {
  if (!hasFileManagementAccess(req, 'overview') && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'No upload permission.' });
  }
  let finalK;
  try {
    finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  try {
    const { headers, data } = await parseExcel(req.file.path);
    const id = 'ov-' + Date.now();
    const uploadedAt = new Date();
    await query(
      `INSERT INTO overview_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, generateUploadName(uploadedAt), req.file.filename, req.file.path, req.file.size, uploadedAt.toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.delete('/overview/files/:id', authenticateToken, async (req, res) => {
  try {
    let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const f = await get('SELECT kingdom_id, path FROM overview_files WHERE id=$1', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    if (!hasFileManagementAccess(req, 'overview') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && !req.query.slug) targetKingdomId = f.kingdom_id;
    if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    await query('DELETE FROM overview_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/overview/files/reorder', authenticateToken, async (req, res) => {
  const { order } = req.body;
  if (!order || !Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'Invalid order' });
  if (!hasFileManagementAccess(req, 'overview') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    await ensureFilesBelongToKingdom(order, targetKingdomId);
    for (let i = 0; i < order.length; i++) {
      await query('UPDATE overview_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
    }
    res.json({ success: true });
  } catch (e) {
    try {
      for (let i = 0; i < req.body.order.length; i++) {
        await query('UPDATE overview_files SET fileorder = $1 WHERE id = $2', [i, req.body.order[i]]);
      }
      res.json({ success: true });
    } catch (ex) {
      res.status(500).json({ error: 'Reorder failed' });
    }
  }
});

// ==================== HONOR ====================

router.get('/honor/files-data', authenticateToken, async (req, res) => {
  try {
    const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [kId]);
    res.json(rows.map(normalizeFileRow));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/honor/upload', authenticateToken, honorUpload.single('file'), async (req, res) => {
  if (!hasFileManagementAccess(req, 'honor') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  let finalK;
  try {
    finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!finalK || !req.file) return res.status(400).json({ error: 'No file or kingdom context' });

  try {
    const { headers, data } = await parseExcel(req.file.path);
    const id = 'hon-' + Date.now();
    const uploadedAt = new Date();
    await query(
      `INSERT INTO honor_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, generateUploadName(uploadedAt), req.file.filename, req.file.path, req.file.size, uploadedAt.toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.delete('/honor/files/:id', authenticateToken, async (req, res) => {
  try {
    let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const f = await get('SELECT kingdom_id, path FROM honor_files WHERE id=$1', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    if (!hasFileManagementAccess(req, 'honor') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && !req.query.slug) targetKingdomId = f.kingdom_id;
    if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    await query('DELETE FROM honor_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/honor/files/reorder', authenticateToken, async (req, res) => {
  const { order } = req.body;
  if (!hasFileManagementAccess(req, 'honor') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  try {
    const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    await ensureFilesBelongToKingdom(order, targetKingdomId);
    for (let i = 0; i < order.length; i++) {
      await query('UPDATE honor_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
    }
    res.json({ success: true });
  } catch (e) {
    try {
      for (let i = 0; i < req.body.order.length; i++) {
        await query('UPDATE honor_files SET fileorder = $1 WHERE id = $2', [i, req.body.order[i]]);
      }
      res.json({ success: true });
    } catch (ex) {
      res.status(500).json({ error: 'Reorder failed' });
    }
  }
});

// ==================== ACTIVITY ====================

router.get('/activity/files-data', authenticateToken, async (req, res) => {
  if (!['admin', 'r5', 'r4'].includes(req.user.role)) return res.status(403).json({ error: 'No access' });

  try {
    const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const rows = await all(`SELECT * FROM activity_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate`, [kId]);
    res.json(rows.map(normalizeFileRow));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/activity/upload', authenticateToken, activityUpload.single('file'), async (req, res) => {
  if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });

  let finalK;
  try {
    finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!finalK || !req.file) return res.status(400).json({ error: 'No file or kingdom context' });

  try {
    const { headers, data } = await parseExcel(req.file.path);
    const id = 'act-' + Date.now();
    const uploadedAt = new Date();
    const fileName = req.body.customName || generateUploadName(uploadedAt);
    await query(
      `INSERT INTO activity_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, fileName, req.file.filename, req.file.path, req.file.size, uploadedAt.toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.delete('/activity/files/:id', authenticateToken, async (req, res) => {
  try {
    let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    const f = await get('SELECT kingdom_id, path FROM activity_files WHERE id=$1', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && !req.query.slug) targetKingdomId = f.kingdom_id;
    if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    await query('DELETE FROM activity_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/activity/files/reorder', authenticateToken, async (req, res) => {
  const { order } = req.body;
  if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });

  try {
    const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    await ensureFilesBelongToKingdom(order, targetKingdomId);
    for (let i = 0; i < order.length; i++) {
      await query('UPDATE activity_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
    }
    res.json({ success: true });
  } catch (e) {
    try {
      for (let i = 0; i < req.body.order.length; i++) {
        await query('UPDATE activity_files SET fileorder = $1 WHERE id = $2', [i, req.body.order[i]]);
      }
      res.json({ success: true });
    } catch (ex) {
      res.status(500).json({ error: 'Reorder failed' });
    }
  }
});

module.exports = router;
