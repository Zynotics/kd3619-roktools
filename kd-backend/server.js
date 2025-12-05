// server.js - Backend mit Admin, Uploads, Gov-ID-Validierung, Feature-Rechten & Kingdom-Layout (Postgres)

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 💾 Import der DB-Funktionen
const { query, get, all, assignR5, updateKingdomStatus, deleteKingdom } = require('./db-pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';

// CORS
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
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
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

// 📂 Upload-Ordner
const uploadsOverviewDir = path.join(__dirname, 'uploads', 'overview');
const uploadsHonorDir = path.join(__dirname, 'uploads', 'honor');

[uploadsOverviewDir, uploadsHonorDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== HELPER FUNCTIONS ====================

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

function findColumnIndex(headers, possibleNames) {
  if (!Array.isArray(headers)) return undefined;
  const normalizedHeaders = headers.map((h) => h ? h.toString().trim().toLowerCase() : '');
  for (const name of possibleNames) {
    const idx = normalizedHeaders.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return undefined;
}

async function userGovIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  if (!governorId) return false;
  try {
    const row = await get('SELECT id FROM users WHERE governor_id = $1 LIMIT 1', [governorId]);
    return !!row;
  } catch (error) {
    console.error('Error checking governor_id in users table:', error);
    return false;
  }
}

async function governorIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  if (!governorId) return false;
  const tables = ['overview_files', 'honor_files'];
  const possibleGovHeaders = ['governor id', 'governorid', 'gov id'];

  try {
    for (const table of tables) {
      const rows = await all(`SELECT headers, data FROM ${table}`);
      for (const row of rows) {
        const headers = JSON.parse(row.headers || '[]');
        const data = JSON.parse(row.data || '[]');
        const govIdx = findColumnIndex(headers, possibleGovHeaders);
        if (govIdx === undefined) continue;
        for (const r of data) {
          const value = r[govIdx];
          if (value == null) continue;
          const v = String(value).trim();
          if (v === governorId) return true;
        }
      }
    }
  } catch (e) {
    console.error('Error while searching governorId:', e);
    return false;
  }
  return false;
}

async function findKingdomBySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  try {
    return await get('SELECT id, display_name, slug, rok_identifier, status, plan, created_at, updated_at FROM kingdoms WHERE LOWER(slug) = $1 LIMIT 1', [normalized]);
  } catch (error) {
    console.error('Error fetching kingdom by slug:', error);
    return null;
  }
}

// ==================== MULTER CONFIG ====================
const overviewStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsOverviewDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});
const honorStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsHonorDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});
const overviewUpload = multer({
  storage: overviewStorage,
  fileFilter: (req, file, cb) => {
    if (['.xlsx', '.xls', '.csv'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});
const honorUpload = multer({
  storage: honorStorage,
  fileFilter: (req, file, cb) => {
    if (['.xlsx', '.xls', '.csv'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});


// ==================== AUTH-MIDDLEWARES ====================

function getKingdomId(req) {
  return req.user.role === 'admin' ? null : req.user.kingdomId;
}

function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Kein Token vorhanden' });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Ungültiger Token' });
    
    // Hole kingdom_id aus der DB für den aktuellsten Zustand
    const dbUser = await get('SELECT role, kingdom_id FROM users WHERE id = $1', [user.id]);
    if (!dbUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    
    req.user = { ...user, role: dbUser.role, kingdomId: dbUser.kingdom_id || null };
    next();
  });
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht authentifiziert' });
  const role = req.user.role;
  if (role !== 'admin' && role !== 'r5') return res.status(403).json({ error: 'Admin oder R5 Rechte erforderlich' });
  if (role === 'r5' && !req.user.kingdomId) return res.status(403).json({ error: 'R5-Benutzer ist keinem Königreich zugewiesen.' });
  next();
}


// ==================== AUTH ENDPOINTS ====================

app.post('/api/auth/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;
    if (!governorId || !String(governorId).trim()) {
      return res.status(400).json({ exists: false, error: 'Gov ID wird benötigt' });
    }
    // Prüft nur, ob ID bereits von einem User registriert ist
    const isTaken = await userGovIdExists(governorId);
    res.json({ isTaken });
  } catch (err) {
    console.error('check-gov-id error:', err);
    res.status(500).json({ error: 'Gov ID check failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId } = req.body;

    if (!email || !username || !password || !governorId) {
      return res.status(400).json({ error: 'Alle Felder werden benötigt' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }
    const normalizedGovId = String(governorId).trim();

    if (await userGovIdExists(normalizedGovId)) {
      return res.status(400).json({ error: 'Für diese Gov ID existiert bereits ein Account.' });
    }

    const existingUser = await get('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [email, username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email oder Benutzername ist bereits vergeben' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_access_honor, can_access_analytics, can_access_overview) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userId, email, username, passwordHash, false, 'user', normalizedGovId, false, false, false]
    );

    return res.json({
      message: 'Registrierung erfolgreich.',
      user: { id: userId, email, username, isApproved: false, role: 'user', governorId: normalizedGovId }
    });
  } catch (error) {
    console.error('❌ Error during registration:', error);
    return res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort benötigt' });

    const user = await get('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      isApproved: !!user.is_approved,
      governorId: user.governor_id || null,
      kingdomId: user.kingdom_id || null, 
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { ...tokenPayload, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

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
    });
  } catch (err) {
    res.status(500).json({ error: 'Token-Validierung fehlgeschlagen' });
  }
});

// ==================== ADMIN ENDPOINTS (Users) ====================

app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id) 
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      ['admin-001', 'admin@kd3619.com', 'Stadmin', adminPasswordHash, true, 'admin', null]
    );
    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];
    const userKingdomId = getKingdomId(req);
    
    if (userKingdomId) {
        whereClause = 'WHERE kingdom_id = $1';
        params.push(userKingdomId);
    }
    
    const users = await all(
      `SELECT id, email, username, is_approved, role, created_at, kingdom_id, governor_id, can_access_honor, can_access_analytics, can_access_overview FROM users ${whereClause} ORDER BY created_at DESC`, params
    );

    res.json(users.map((user) => ({
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
    })));
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

app.post('/api/admin/users/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, approved } = req.body;
    const currentUserKingdomId = getKingdomId(req);
    const currentUserRole = req.user.role;

    if (!userId || typeof approved !== 'boolean') return res.status(400).json({ error: 'Ungültige Eingabe' });
    
    if (currentUserKingdomId) {
        const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
        if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Zugriff verweigert' });
        if (target.role === 'admin') return res.status(403).json({ error: 'Kein Zugriff auf Admin' });
    }

    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [approved, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Interner Server Fehler' });
  }
});

app.post('/api/admin/users/access', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, canAccessHonor, canAccessAnalytics, canAccessOverview } = req.body;
      const currentUserKingdomId = getKingdomId(req);
      
      if (currentUserKingdomId) {
        const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
        if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Zugriff verweigert' });
      }
      
      await query(`UPDATE users SET can_access_honor=$1, can_access_analytics=$2, can_access_overview=$3 WHERE id=$4`, [!!canAccessHonor, !!canAccessAnalytics, !!canAccessOverview, userId]);
      res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.post('/api/admin/users/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, role } = req.body;
      const currentUserRole = req.user.role;
      const currentUserKingdomId = getKingdomId(req);

      if (currentUserRole === 'r5' && !['user', 'r4', 'r5'].includes(role)) {
          return res.status(403).json({ error: 'R5 darf nur user/r4/r5 vergeben.' });
      }

      if (currentUserKingdomId) {
          const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
          if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Zugriff verweigert' });
          if (currentUserRole === 'r5' && target.role === 'admin') return res.status(403).json({ error: 'Kein Zugriff auf Admin.' });
      }

      let sql = 'UPDATE users SET role = $1 WHERE id = $2';
      let p = [role, userId];
      
      // Wenn R5/Admin eine Rolle (nicht-admin) vergibt, sicherstellen, dass kingdom_id gesetzt bleibt/wird
      if (role === 'user' || role === 'r4' || (role === 'r5' && currentUserRole !== 'admin')) {
          sql = 'UPDATE users SET role = $1, kingdom_id = $3 WHERE id = $2';
          const targetK = currentUserKingdomId || (await get('SELECT kingdom_id FROM users WHERE id = $1', [userId]))?.kingdom_id;
          p = [role, userId, targetK];
      }
      
      await query(sql, p);
      res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUserKingdomId = getKingdomId(req);

        if (currentUserKingdomId) {
            const target = await get('SELECT kingdom_id, role FROM users WHERE id = $1', [userId]);
            if (!target || target.kingdom_id !== currentUserKingdomId) return res.status(403).json({ error: 'Zugriff verweigert' });
            if (req.user.role === 'r5' && (target.role === 'r5' || target.role === 'admin')) return res.status(403).json({ error: 'Kein Zugriff' });
        }
        await query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

// ==================== KINGDOM ADMIN ENDPOINTS ====================

app.get('/api/admin/kingdoms', authenticateToken, requireAdmin, async (req, res) => {
  try {
      let where = '';
      const p = [];
      const kId = getKingdomId(req);
      if (kId) { where = 'WHERE k.id = $1'; p.push(kId); }
      
      const kingdoms = await all(`
        SELECT k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.created_at, k.updated_at, k.owner_user_id, u.username AS owner_username, u.email AS owner_email 
        FROM kingdoms k LEFT JOIN users u ON u.id = k.owner_user_id ${where} ORDER BY k.created_at DESC`, p);
      
      res.json(kingdoms.map(k => ({
          id: k.id, displayName: k.display_name, slug: k.slug, rokIdentifier: k.rok_identifier, status: k.status, 
          plan: k.plan, createdAt: k.created_at, ownerUserId: k.owner_user_id, ownerUsername: k.owner_username, ownerEmail: k.owner_email
      })));
  } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.post('/api/admin/kingdoms', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { displayName, slug, rokIdentifier } = req.body;
        const id = 'kdm-' + Date.now();
        const nSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-');
        await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [id, displayName, nSlug, rokIdentifier]);
        res.json({ id, displayName, slug: nSlug });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.post('/api/admin/kingdoms/:id/assign-r5', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        await assignR5(req.body.r5UserId, req.params.id);
        res.json({ success: true, message: `R5 zugewiesen.` });
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/admin/kingdoms/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        await updateKingdomStatus(req.params.id, req.body.status);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.delete('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const k = await get('SELECT slug FROM kingdoms WHERE id=$1', [req.params.id]);
        if (k && k.slug === 'default-kingdom') return res.status(400).json({ error: 'Protected' });
        await deleteKingdom(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

// ==================== PUBLIC ENDPOINTS ====================

app.get('/api/public/kingdom/:slug', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json(k);
});

app.get('/api/public/kingdom/:slug/overview-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploadDate`, [k.id]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.get('/api/public/kingdom/:slug/honor-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploadDate`, [k.id]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});


// ==================== AUTH DATA (Overview/Honor) ====================

app.get('/overview/files-data', authenticateToken, async (req, res) => {
    const { role, kingdomId } = req.user;
    const kId = kingdomId || (role === 'admin' ? 'kdm-default' : null);
    if (!kId) return res.status(403).json({ error: 'Kein Kingdom' });
    
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploadDate`, [kId]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.post('/overview/upload', authenticateToken, overviewUpload.single('file'), async (req, res) => {
    const { role, kingdomId, id: userId } = req.user;
    if (!['admin','r5','r4'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    
    // 👑 ADMIN OVERRIDE LOGIC
    let targetK = kingdomId;
    if (role === 'admin' && req.query.slug) {
        const k = await findKingdomBySlug(req.query.slug);
        if (k) targetK = k.id;
    }
    const finalK = targetK || (role === 'admin' ? 'kdm-default' : null);
    
    if (!finalK) return res.status(403).json({ error: 'Kein Ziel-Königreich' });
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'ov-' + Date.now();
        await query(
          `INSERT INTO overview_files (id, name, filename, path, size, uploadDate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, userId]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/overview/files/:id', authenticateToken, async (req, res) => {
    const f = await get('SELECT kingdom_id, path FROM overview_files WHERE id=$1', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'Not found' });
    
    if (req.user.role !== 'admin' && f.kingdom_id !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });

    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    await query('DELETE FROM overview_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/overview/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'Invalid' });
    
    if (order.length > 0 && req.user.role !== 'admin') {
        const f = await get('SELECT kingdom_id FROM overview_files WHERE id=$1', [order[0]]);
        if (!f || f.kingdom_id !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });
    }

    for (let i = 0; i < order.length; i++) {
        await query('UPDATE overview_files SET fileOrder = $1 WHERE id = $2', [i, order[i]]);
    }
    res.json({ success: true });
});

// HONOR (Analog)
app.get('/honor/files-data', authenticateToken, async (req, res) => {
    const { role, kingdomId } = req.user;
    const kId = kingdomId || (role === 'admin' ? 'kdm-default' : null);
    if (!kId) return res.status(403).json({ error: 'Kein Kingdom' });
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploadDate`, [kId]);
    res.json(rows.map(r => ({...r, headers: JSON.parse(r.headers||'[]'), data: JSON.parse(r.data||'[]')})));
});

app.post('/honor/upload', authenticateToken, honorUpload.single('file'), async (req, res) => {
    const { role, kingdomId, id: userId } = req.user;
    if (!['admin','r5','r4'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
    
    let targetK = kingdomId;
    if (role === 'admin' && req.query.slug) {
        const k = await findKingdomBySlug(req.query.slug);
        if (k) targetK = k.id;
    }
    const finalK = targetK || (role === 'admin' ? 'kdm-default' : null);
    if (!finalK || !req.file) return res.status(400).json({ error: 'Error' });

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'hon-' + Date.now();
        await query(
          `INSERT INTO honor_files (id, name, filename, path, size, uploadDate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, userId]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/honor/files/:id', authenticateToken, async (req, res) => {
    const f = await get('SELECT kingdom_id, path FROM honor_files WHERE id=$1', [req.params.id]);
    if (!f) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && f.kingdom_id !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });

    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    await query('DELETE FROM honor_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
});

app.post('/honor/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'Invalid' });
    if (req.user.role !== 'admin') {
        const f = await get('SELECT kingdom_id FROM honor_files WHERE id=$1', [order[0]]);
        if (!f || f.kingdom_id !== req.user.kingdomId) return res.status(403).json({ error: 'Forbidden' });
    }
    for (let i = 0; i < order.length; i++) await query('UPDATE honor_files SET fileOrder = $1 WHERE id = $2', [i, order[i]]);
    res.json({ success: true });
});


app.get('/health', (req, res) => res.json({ status: 'Backend läuft', time: new Date() }));

app.get('/', (req, res) => {
  res.json({ message: 'KD3619 Backend API', version: '2.5.0-FULL-FEATURE' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});