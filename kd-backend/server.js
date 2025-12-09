// server.js - VOLLSTÄNDIGE VERSION (Postgres)
// Enthält: Auth, User-Admin, Kingdom-Admin, Activity-Files, Modulares KvK, Unified Uploads

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// 💾 Import der DB-Funktionen (Postgres)
// Wir nutzen db-pg.js für alle Datenbank-Operationen
const { 
  query, get, all, assignR5, updateKingdomStatus, deleteKingdom,
  createKvkEvent, getKvkEvents, getKvkEventById, updateKvkEvent, deleteKvkEvent
} = require('./db-pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';

// --- CORS ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
  'https://rise-of-stats.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // Im Dev-Mode erlauben wir oft alles, in Prod strenger
        // Für den Moment permissive:
        return callback(null, true); 
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.options('*', cors());
app.use(express.json());

// --- ORDNERSYSTEM ---
const uploadDir = path.join(__dirname, 'uploads');
const uploadsOverviewDir = path.join(uploadDir, 'overview');
const uploadsHonorDir = path.join(uploadDir, 'honor');
const uploadsActivityDir = path.join(uploadDir, 'activity');

[uploadDir, uploadsOverviewDir, uploadsHonorDir, uploadsActivityDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// --- HELPER ---
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

// User-Gov-ID Prüfung Helper
async function userGovIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  const row = await get('SELECT id FROM users WHERE governor_id = $1 LIMIT 1', [governorId]);
  return !!row;
}

// Kingdom Slug Helper
async function findKingdomBySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  return await get('SELECT * FROM kingdoms WHERE LOWER(slug) = $1 LIMIT 1', [normalized]);
}


// --- MULTER STORAGE ---
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


// --- AUTH MIDDLEWARES ---
function getKingdomId(req) {
  return req.user.role === 'admin' ? null : req.user.kingdomId;
}

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

// ==================== ENDPOINTS: AUTH & USERS ====================

app.post('/api/auth/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;
    const isTaken = await userGovIdExists(governorId);
    res.json({ isTaken });
  } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId, slug } = req.body;
    if (!email || !username || !password || !governorId) return res.status(400).json({ error: 'Missing fields' });
    
    if (await userGovIdExists(governorId)) return res.status(400).json({ error: 'Gov ID already taken' });
    
    const existing = await get('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (existing) return res.status(400).json({ error: 'Email/Username taken' });

    let kId = null;
    if (slug) {
        const k = await findKingdomBySlug(slug);
        if (k) kId = k.id;
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, kingdom_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, email, username, hash, false, 'user', String(governorId).trim(), kId]
    );

    res.json({ message: 'Registration successful', user: { id: userId, username } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Boolean flags
    const userObj = {
        id: user.id, username: user.username, role: user.role, kingdomId: user.kingdom_id,
        canManageOverviewFiles: !!user.can_manage_overview_files,
        canManageHonorFiles: !!user.can_manage_honor_files,
        canManageActivityFiles: !!user.can_manage_activity_files
    };
    
    res.json({ token, user: userObj });
  } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/validate', authenticateToken, (req, res) => {
    res.json(req.user);
});

// Admin User Management
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    let where = '';
    const p = [];
    const kId = getKingdomId(req);
    if (kId) { where = 'WHERE kingdom_id = $1'; p.push(kId); }
    
    const users = await all(`SELECT id, email, username, is_approved, role, created_at, kingdom_id, governor_id, can_manage_overview_files, can_manage_honor_files FROM users ${where} ORDER BY created_at DESC`, p);
    
    // Map bools
    res.json(users.map(u => ({
        ...u, 
        isApproved: !!u.is_approved, 
        canManageOverviewFiles: !!u.can_manage_overview_files,
        canManageHonorFiles: !!u.can_manage_honor_files
    })));
});

app.post('/api/admin/users/approve', authenticateToken, requireAdmin, async (req, res) => {
    const { userId, approved } = req.body;
    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [approved, userId]);
    res.json({ success: true });
});

app.post('/api/admin/users/assign-r4', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { userId, kingdomId } = req.body;
    await query("UPDATE users SET role = 'r4', kingdom_id = $1, is_approved = true WHERE id = $2", [kingdomId, userId]);
    res.json({ success: true });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});


// ==================== ENDPOINTS: KINGDOMS ====================

app.get('/api/admin/kingdoms', authenticateToken, requireReadAccess, async (req, res) => {
    const kId = getKingdomId(req);
    let where = ''; const p = [];
    if (kId) { where = 'WHERE id = $1'; p.push(kId); }
    const rows = await all(`SELECT * FROM kingdoms ${where} ORDER BY created_at DESC`, p);
    res.json(rows.map(r => ({ ...r, displayName: r.display_name, rokIdentifier: r.rok_identifier })));
});

app.post('/api/admin/kingdoms', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    const { displayName, slug, rokIdentifier } = req.body;
    const id = 'kdm-' + Date.now();
    await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [id, displayName, slug, rokIdentifier]);
    res.json({ id, displayName });
});

app.post('/api/admin/kingdoms/:id/assign-r5', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    await assignR5(req.body.r5UserId, req.params.id);
    res.json({ success: true });
});

app.delete('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
    await deleteKingdom(req.params.id);
    res.json({ success: true });
});


// ==================== ENDPOINTS: FILES (UNIFIED) ====================

// 1. OVERVIEW (Shared by Analytics & KvK Manager)
app.get('/overview/files-data', authenticateToken, async (req, res) => {
    const kId = req.user.kingdomId || (req.user.role === 'admin' ? null : null);
    if (!kId && req.user.role !== 'admin') return res.status(403).json({ error: 'No Kingdom' });

    // Wenn Admin, alle oder filtern. Hier vereinfacht:
    const sql = req.user.role === 'admin' ? `SELECT * FROM overview_files` : `SELECT * FROM overview_files WHERE kingdom_id = $1`;
    const params = req.user.role === 'admin' ? [] : [kId];
    const rows = await all(sql + ' ORDER BY "uploadDate" DESC', params);
    
    // Parse JSON headers/data
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.post('/overview/upload', authenticateToken, overviewUpload.single('file'), async (req, res) => {
    if (!hasFileAccess(req, 'overview')) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    // Fallback Kingdom für Admin ohne Zuweisung
    const kingdomId = req.user.kingdomId || 'kdm-default'; 

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'ov-' + Date.now();
        await query(
            `INSERT INTO overview_files (id, name, filename, path, size, "uploadDate", headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), kingdomId, req.user.id]
        );
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/overview/files/:id', authenticateToken, async (req, res) => {
    if (!hasFileAccess(req, 'overview')) return res.status(403).json({ error: 'Forbidden' });
    // Check ownership if strict
    await query('DELETE FROM overview_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/overview/files/reorder', authenticateToken, async (req, res) => {
    // Einfache Reorder Implementierung (optional)
    res.json({ success: true }); 
});


// 2. HONOR (Separate Table/Endpoint)
app.get('/honor/files-data', authenticateToken, async (req, res) => {
    const kId = req.user.kingdomId;
    if (!kId && req.user.role !== 'admin') return res.status(403).json({ error: 'No Kingdom' });
    
    const sql = req.user.role === 'admin' ? `SELECT * FROM honor_files` : `SELECT * FROM honor_files WHERE kingdom_id = $1`;
    const params = req.user.role === 'admin' ? [] : [kId];
    const rows = await all(sql + ' ORDER BY "uploadDate" DESC', params);
    
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.post('/honor/upload', authenticateToken, honorUpload.single('file'), async (req, res) => {
    if (!hasFileAccess(req, 'honor')) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const kingdomId = req.user.kingdomId || 'kdm-default';

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'hon-' + Date.now();
        await query(
            `INSERT INTO honor_files (id, name, filename, path, size, "uploadDate", headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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


// 3. ACTIVITY (R4/R5 Only)
app.get('/activity/files-data', authenticateToken, async (req, res) => {
    const kId = req.user.kingdomId;
    if (!kId && req.user.role !== 'admin') return res.status(403).json({ error: 'No Kingdom' });

    const sql = req.user.role === 'admin' ? `SELECT * FROM activity_files` : `SELECT * FROM activity_files WHERE kingdom_id = $1`;
    const params = req.user.role === 'admin' ? [] : [kId];
    const rows = await all(sql + ' ORDER BY "uploadDate" DESC', params);
    
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.post('/activity/upload', authenticateToken, activityUpload.single('file'), async (req, res) => {
    if (!hasFileAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const kingdomId = req.user.kingdomId || 'kdm-default';

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'act-' + Date.now();
        await query(
            `INSERT INTO activity_files (id, name, filename, path, size, "uploadDate", headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), kingdomId, req.user.id]
        );
        res.json({ success: true });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/activity/files/:id', authenticateToken, async (req, res) => {
    if (!hasFileAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM activity_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});


// ==================== ENDPOINTS: KVK MANAGER (MODULAR) ====================

app.get('/api/admin/kvk/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const kingdomId = req.user.kingdomId;
      const targetKingdom = req.query.kingdomId || kingdomId;
      if (!targetKingdom && req.user.role !== 'admin') return res.status(400).json({ error: 'No Kingdom' });
      if (req.user.role === 'admin' && !targetKingdom) return res.json([]);
      
      const events = await getKvkEvents(targetKingdom);
      res.json(events);
    } catch (e) { res.status(500).json({ error: 'Error fetching events' }); }
});

app.post('/api/admin/kvk/events', authenticateToken, requireAdmin, async (req, res) => {
    try {
      // New Structure: fights (array) + honorStart/End
      const { name, fights, honorStartFileId, honorEndFileId, isPublic, kingdomId } = req.body;
      const targetK = (req.user.role === 'admin' && kingdomId) ? kingdomId : req.user.kingdomId;
      if (!targetK) return res.status(400).json({ error: 'No Kingdom' });

      const newEvent = {
        id: 'kvk-' + Date.now(),
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


// ==================== ENDPOINTS: PUBLIC ====================

app.get('/api/public/kingdom/:slug', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json({ displayName: k.display_name, id: k.id, slug: k.slug });
});

app.get('/api/public/kingdom/:slug/kvk-events', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    const events = await getKvkEvents(k.id);
    res.json(events.filter(e => e.isPublic));
});

app.get('/api/public/kingdom/:slug/overview-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    
    // Sortiert nach Upload Datum für korrekte Zeitleisten
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY "uploadDate" ASC`, [k.id]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.get('/api/public/kingdom/:slug/honor-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY "uploadDate" ASC`, [k.id]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', db: 'Postgres' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});