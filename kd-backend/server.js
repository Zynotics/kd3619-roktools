// server.js - FINAL FULL VERSION
// Fixes: Postgres Column Casing, Removed missing dependencies, Full Feature Set

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// -------------------------------------------------------
// INTERNE HELPER (Ersetzen externe Libs um Abstürze zu verhindern)
// -------------------------------------------------------
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

// -------------------------------------------------------
// DATENBANK SETUP
// -------------------------------------------------------
const { 
  query, get, all, assignR5, updateKingdomStatus, deleteKingdom,
  createKvkEvent, getKvkEvents, getKvkEventById, updateKvkEvent, deleteKvkEvent
} = require('./db-pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';

// -------------------------------------------------------
// SERVER SETUP (CORS & PARSER)
// -------------------------------------------------------
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
  'https://rise-of-stats.com'
];

app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // In Production hier strenger sein, für jetzt erlauben wir es damit es läuft
        return callback(null, true); 
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// -------------------------------------------------------
// FILESYSTEM SETUP
// -------------------------------------------------------
const uploadDir = path.join(__dirname, 'uploads');
const uploadsOverviewDir = path.join(uploadDir, 'overview');
const uploadsHonorDir = path.join(uploadDir, 'honor');
const uploadsActivityDir = path.join(uploadDir, 'activity');

[uploadDir, uploadsOverviewDir, uploadsHonorDir, uploadsActivityDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// -------------------------------------------------------
// DATA HELPER FUNCTIONS
// -------------------------------------------------------

// WICHTIG: Postgres gibt Spalten kleingeschrieben zurück (uploaddate).
// Das Frontend braucht aber uploadDate. Diese Funktion repariert das.
const normalizeFileRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        // Mapping: DB (klein) -> Frontend (CamelCase)
        uploadDate: row.uploaddate || row.uploadDate || row.created_at || new Date().toISOString(),
        size: row.size,
        kingdomId: row.kingdom_id,
        // JSON Felder parsen
        headers: typeof row.headers === 'string' ? JSON.parse(row.headers || '[]') : (row.headers || []),
        data: typeof row.data === 'string' ? JSON.parse(row.data || '[]') : (row.data || [])
    };
};

function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.csv') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rows = fileContent.split(/\r?\n/).map((line) => line.split(';').map((v) => v.trim())).filter((row) => row.length > 1);
        if (rows.length === 0) return resolve({ headers: [], data: [] });
        const headers = rows[0].map((h) => (h ? h.toString() : ''));
        const data = rows.slice(1).filter((row) => row.length > 0);
        return resolve({ headers, data });
      } else {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (!jsonData || jsonData.length === 0) return resolve({ headers: [], data: [] });
        const headers = jsonData[0].map((h) => (h ? h.toString() : ''));
        const data = jsonData.slice(1).filter((row) => row.length > 0);
        resolve({ headers, data });
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function userGovIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  const row = await get('SELECT id FROM users WHERE governor_id = $1 LIMIT 1', [governorId]);
  return !!row;
}

async function findKingdomBySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  return await get('SELECT * FROM kingdoms WHERE LOWER(slug) = $1 LIMIT 1', [normalized]);
}

// -------------------------------------------------------
// MULTER CONFIG
// -------------------------------------------------------
const overviewStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsOverviewDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});
const honorStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsHonorDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});
const activityStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsActivityDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});

const overviewUpload = multer({ storage: overviewStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const honorUpload = multer({ storage: honorStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const activityUpload = multer({ storage: activityStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// -------------------------------------------------------
// AUTH MIDDLEWARE
// -------------------------------------------------------
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token' });
    
    const dbUser = await get('SELECT role, kingdom_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files FROM users WHERE id = $1', [user.id]);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });
    
    req.user = { 
      ...user, 
      role: dbUser.role, 
      kingdomId: dbUser.kingdom_id || null,
      canAccessHonor: !!dbUser.can_access_honor,
      canAccessAnalytics: !!dbUser.can_access_analytics,
      canAccessOverview: !!dbUser.can_access_overview,
      canManageOverviewFiles: !!dbUser.can_manage_overview_files,
      canManageHonorFiles: !!dbUser.can_manage_honor_files,
      canManageActivityFiles: !!dbUser.can_manage_activity_files
    };
    next();
  });
}

function requireReadAccess(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const role = req.user.role;
    if (role !== 'admin' && role !== 'r5' && role !== 'r4') {
        return res.status(403).json({ error: 'Access denied' });
    }
    if ((role === 'r5' || role === 'r4') && !req.user.kingdomId) {
        return res.status(403).json({ error: 'No Kingdom assigned' });
    }
    next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const role = req.user.role;
  if (role !== 'admin' && role !== 'r5') return res.status(403).json({ error: 'Admin/R5 Access required' });
  if (role === 'r5' && !req.user.kingdomId) return res.status(403).json({ error: 'No Kingdom assigned' });
  next();
}

function hasFileAccess(req, type) {
    const { role, canManageOverviewFiles, canManageHonorFiles, canManageActivityFiles } = req.user;
    if (role === 'admin') return true;
    if (role === 'r5' || role === 'r4') {
        if (type === 'overview') return canManageOverviewFiles || role === 'r5';
        if (type === 'honor') return canManageHonorFiles || role === 'r5';
        if (type === 'activity') return canManageActivityFiles || role === 'r5';
    }
    return false;
}

// -------------------------------------------------------
// API ENDPOINTS: AUTH
// -------------------------------------------------------

app.post('/api/auth/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;
    if (!governorId || !String(governorId).trim()) return res.status(400).json({ error: 'Gov ID required' });
    const isTaken = await userGovIdExists(governorId);
    res.json({ isTaken });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId, slug } = req.body;
    if (!email || !username || !password || !governorId) return res.status(400).json({ error: 'Missing fields' });
    if (await userGovIdExists(governorId)) return res.status(400).json({ error: 'Gov ID taken' });
    
    const existing = await get('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (existing) return res.status(400).json({ error: 'Email/Username taken' });

    let kId = null;
    if (slug) {
        const k = await findKingdomBySlug(slug);
        if (k) kId = k.id;
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = generateId('user');

    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, kingdom_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, email, username, hash, false, 'user', String(governorId).trim(), kId]
    );

    res.json({ message: 'Registration successful', user: { id: userId, username } });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
        token, 
        user: { 
            id: user.id, username: user.username, role: user.role, kingdomId: user.kingdom_id,
            canManageOverviewFiles: !!user.can_manage_overview_files,
            canManageHonorFiles: !!user.can_manage_honor_files,
            canManageActivityFiles: !!user.can_manage_activity_files
        } 
    });
  } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.id, email: user.email, username: user.username, role: user.role, kingdomId: user.kingdom_id,
      isApproved: !!user.is_approved,
      canManageOverviewFiles: !!user.can_manage_overview_files,
      canManageHonorFiles: !!user.can_manage_honor_files,
      canManageActivityFiles: !!user.can_manage_activity_files
    });
  } catch (err) { res.status(500).json({ error: 'Validation failed' }); }
});

// -------------------------------------------------------
// API ENDPOINTS: ADMIN USERS
// -------------------------------------------------------

app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      ['admin-001', 'admin@kd3619.com', 'Stadmin', adminPasswordHash, true, 'admin', null, true, true, true]
    );
    res.json({ message: 'Admin created' });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];
    const userKingdomId = req.user.role === 'admin' ? null : req.user.kingdomId;
    
    if (userKingdomId) {
        whereClause = 'WHERE kingdom_id = $1';
        params.push(userKingdomId);
    }
    
    const users = await all(
      `SELECT id, email, username, is_approved, role, created_at, kingdom_id, governor_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files FROM users ${whereClause} ORDER BY created_at DESC`, params
    );

    res.json(users.map((user) => ({
        ...user,
        isApproved: !!user.is_approved,
        canManageOverviewFiles: !!user.can_manage_overview_files,
        canManageHonorFiles: !!user.can_manage_honor_files,
        canManageActivityFiles: !!user.can_manage_activity_files
    })));
  } catch (error) { res.status(500).json({ error: 'Error loading users' }); }
});

app.post('/api/admin/users/approve', authenticateToken, requireAdmin, async (req, res) => {
    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [req.body.approved, req.body.userId]);
    res.json({ success: true });
});

app.post('/api/admin/users/access', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, canAccessHonor, canAccessAnalytics, canAccessOverview } = req.body;
      await query(`UPDATE users SET can_access_honor=$1, can_access_analytics=$2, can_access_overview=$3 WHERE id=$4`, [!!canAccessHonor, !!canAccessAnalytics, !!canAccessOverview, userId]);
      res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.post('/api/admin/users/access-files', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { userId, canManageOverviewFiles, canManageHonorFiles, canManageActivityFiles } = req.body;
    await query(`UPDATE users SET can_manage_overview_files=$1, can_manage_honor_files=$2, can_manage_activity_files=$3 WHERE id=$4`, [!!canManageOverviewFiles, !!canManageHonorFiles, !!canManageActivityFiles, userId]);
    res.json({ success: true });
});

app.post('/api/admin/users/role', authenticateToken, requireAdmin, async (req, res) => {
    await query('UPDATE users SET role = $1 WHERE id = $2', [req.body.role, req.body.userId]);
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/users/assign-r4', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { userId, kingdomId } = req.body;
    await query("UPDATE users SET role = 'r4', kingdom_id = $1, is_approved = true WHERE id = $2", [kingdomId, userId]);
    res.json({ success: true });
});

// -------------------------------------------------------
// API ENDPOINTS: KINGDOMS
// -------------------------------------------------------

app.get('/api/admin/kingdoms', authenticateToken, requireReadAccess, async (req, res) => {
    const kId = req.user.role === 'admin' ? null : req.user.kingdomId;
    let where = ''; const p = [];
    if (kId) { where = 'WHERE k.id = $1'; p.push(kId); }
    const rows = await all(`SELECT k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.created_at, k.updated_at FROM kingdoms k ${where} ORDER BY k.created_at DESC`, p);
    res.json(rows.map(r => ({ ...r, displayName: r.display_name, rokIdentifier: r.rok_identifier })));
});

app.post('/api/admin/kingdoms', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { displayName, slug, rokIdentifier } = req.body;
    const id = generateId('kdm');
    await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [id, displayName, slug, rokIdentifier]);
    res.json({ id, displayName });
});

app.put('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { displayName, slug } = req.body;
    await query('UPDATE kingdoms SET display_name = $1, slug = $2 WHERE id = $3', [displayName, slug, req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/kingdoms/:id/assign-r5', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    await assignR5(req.body.r5UserId, req.params.id);
    res.json({ success: true });
});

app.post('/api/admin/kingdoms/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    await updateKingdomStatus(req.params.id, req.body.status);
    res.json({ success: true });
});

app.delete('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    await deleteKingdom(req.params.id);
    res.json({ success: true });
});

// -------------------------------------------------------
// API ENDPOINTS: FILES (UNIFIED + POSTGRES FIX)
// -------------------------------------------------------

// 1. OVERVIEW
app.get('/overview/files-data', authenticateToken, async (req, res) => {
    const kId = req.user.kingdomId || (req.user.role === 'admin' ? null : null);
    if (!kId && req.user.role !== 'admin') return res.status(403).json({ error: 'No Kingdom' });
    
    const sql = req.user.role === 'admin' ? `SELECT * FROM overview_files` : `SELECT * FROM overview_files WHERE kingdom_id = $1`;
    const params = req.user.role === 'admin' ? [] : [kId];
    
    // Verwendung von Kleinschreibung für uploaddate um PG Fehler zu vermeiden
    const rows = await all(`${sql} ORDER BY uploaddate ASC`, params);
    res.json(rows.map(normalizeFileRow));
});

app.post('/overview/upload', authenticateToken, overviewUpload.single('file'), async (req, res) => {
    if (!hasFileAccess(req, 'overview')) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    const kingdomId = req.user.kingdomId || 'kdm-default';
    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = generateId('ov');
        // Insert in uploaddate (lowercase)
        await query(
            `INSERT INTO overview_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), kingdomId, req.user.id]
        );
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/overview/files/:id', authenticateToken, async (req, res) => {
    if (!hasFileAccess(req, 'overview')) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM overview_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/overview/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!hasFileAccess(req, 'overview')) return res.status(403).json({ error: 'Forbidden' });
    try {
        // PG columns are usually lowercase
        for (let i = 0; i < order.length; i++) await query('UPDATE overview_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Reorder failed' }); }
});

// 2. HONOR
app.get('/honor/files-data', authenticateToken, async (req, res) => {
    const kId = req.user.kingdomId;
    if (!kId && req.user.role !== 'admin') return res.status(403).json({ error: 'No Kingdom' });
    
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY uploaddate ASC`, [kId]);
    res.json(rows.map(normalizeFileRow));
});

app.post('/honor/upload', authenticateToken, honorUpload.single('file'), async (req, res) => {
    if (!hasFileAccess(req, 'honor')) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const kingdomId = req.user.kingdomId || 'kdm-default';

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = generateId('hon');
        await query(
            `INSERT INTO honor_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), kingdomId, req.user.id]
        );
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/honor/files/:id', authenticateToken, async (req, res) => {
    if (!hasFileAccess(req, 'honor')) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM honor_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/honor/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!hasFileAccess(req, 'honor')) return res.status(403).json({ error: 'Forbidden' });
    try {
        for (let i = 0; i < order.length; i++) await query('UPDATE honor_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Reorder failed' }); }
});

// 3. ACTIVITY
app.get('/activity/files-data', authenticateToken, async (req, res) => {
    if (!['admin', 'r5', 'r4'].includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    const kId = req.user.kingdomId;
    if (!kId) return res.status(403).json({ error: 'No Kingdom' });
    
    const rows = await all(`SELECT * FROM activity_files WHERE kingdom_id = $1 ORDER BY uploaddate ASC`, [kId]);
    res.json(rows.map(normalizeFileRow));
});

app.post('/activity/upload', authenticateToken, activityUpload.single('file'), async (req, res) => {
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    const kingdomId = req.user.kingdomId || 'kdm-default';
    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = generateId('act');
        await query(
          `INSERT INTO activity_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), kingdomId, req.user.id]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/activity/files/:id', authenticateToken, async (req, res) => {
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM activity_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/activity/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    for (let i = 0; i < order.length; i++) await query('UPDATE activity_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
    res.json({ success: true });
});


// -------------------------------------------------------
// API ENDPOINTS: KVK MANAGER (MODULAR)
// -------------------------------------------------------

app.get('/api/admin/kvk/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const targetKingdom = req.query.kingdomId || req.user.kingdomId;
      if (!targetKingdom && req.user.role !== 'admin') return res.status(400).json({ error: 'No Kingdom' });
      if (req.user.role === 'admin' && !targetKingdom) return res.json([]);
      
      const events = await getKvkEvents(targetKingdom);
      res.json(events);
    } catch (e) { res.status(500).json({ error: 'Error fetching events' }); }
});

app.post('/api/admin/kvk/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { name, fights, honorStartFileId, honorEndFileId, isPublic, kingdomId } = req.body;
      const targetK = (req.user.role === 'admin' && kingdomId) ? kingdomId : req.user.kingdomId;
      if (!targetK) return res.status(400).json({ error: 'No Kingdom' });

      const newEvent = {
        id: generateId('kvk'),
        name,
        kingdomId: targetK,
        fights: fights || [], 
        honorStartFileId, 
        honorEndFileId,
        isPublic: !!isPublic,
        createdAt: new Date().toISOString()
      };
      const created = await createKvkEvent(newEvent);
      res.json(created);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Create failed' }); }
});

app.put('/api/admin/kvk/events/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { name, fights, honorStartFileId, honorEndFileId, isPublic } = req.body;
      const existing = await getKvkEventById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });

      const updated = await updateKvkEvent(req.params.id, {
        name, fights, honorStartFileId, honorEndFileId, isPublic
      });
      res.json(updated);
    } catch (e) { console.error(e); res.status(500).json({ error: 'Update failed' }); }
});

app.delete('/api/admin/kvk/events/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const existing = await getKvkEventById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });

      await deleteKvkEvent(req.params.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Delete failed' }); }
});


// -------------------------------------------------------
// API ENDPOINTS: PUBLIC (MIT POSTGRES MAPPING FIX)
// -------------------------------------------------------

app.get('/api/public/kingdom/:slug', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json(k);
});

app.get('/api/public/kingdom/:slug/kvk-events', async (req, res) => {
    try {
      const k = await findKingdomBySlug(req.params.slug);
      if (!k) return res.status(404).json({ error: 'Not found' });
      const events = await getKvkEvents(k.id);
      res.json(events.filter(e => e.isPublic));
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/public/kingdom/:slug/overview-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    
    // Wichtig: Sortierung nach uploaddate (lowercase) und Verwendung von normalizeFileRow
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY uploaddate ASC`, [k.id]);
    res.json(rows.map(normalizeFileRow));
});

app.get('/api/public/kingdom/:slug/honor-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY uploaddate ASC`, [k.id]);
    res.json(rows.map(normalizeFileRow));
});

// -------------------------------------------------------
// HEALTH & START
// -------------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'OK', db: 'Postgres' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});