// server.js - Backend mit Admin, Uploads, Gov-ID-Validierung, Feature-Rechten & Kingdom-Layout (Postgres)
// MODIFIED: Inklusive Modulares KvK System & Postgres Fixes

require('dotenv').config(); // Falls vorhanden
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// 💾 Import der DB-Funktionen (inkl. KvK Manager)
const {
  query, get, all, assignR5, updateKingdomStatus, deleteKingdom,
  createKvkEvent, getKvkEvents, getAllKvkEvents, getKvkEventById, updateKvkEvent, deleteKvkEvent,
  generateR5Code, getR5Codes, getR5Code, activateR5Code, getActiveR5Access, assignR5Code, deactivateR5Code,
  getAppSetting, setAppSetting
} = require('./db-pg');
const { init: initPgSchema } = require('./init-pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';
const R5_CODE_DURATIONS = [0, 1, 7, 14, 30, 60, 365];
const R5_SHOP_VISIBILITY_KEY = 'r5_shop_enabled';

// CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
  'https://rise-of-stats.com',
  'https://www.rise-of-stats.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // Im Zweifel permissive für den Moment, um 503er zu vermeiden
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

// 📂 Upload-Ordner
const uploadDir = path.join(__dirname, 'uploads');
const uploadsOverviewDir = path.join(uploadDir, 'overview');
const uploadsHonorDir = path.join(uploadDir, 'honor');
const uploadsActivityDir = path.join(uploadDir, 'activity');

[uploadDir, uploadsOverviewDir, uploadsHonorDir, uploadsActivityDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== HELPER FUNCTIONS ====================

// FIX: Postgres gibt Spalten kleingeschrieben zurück. Frontend braucht CamelCase.
function normalizeFileRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        // Fallback für verschiedene Schreibweisen aus der DB
        uploadDate: row.uploaddate || row.uploadDate || row.created_at || new Date().toISOString(),
        size: row.size,
        kingdomId: row.kingdom_id,
        // JSON Parsen falls String (bei Postgres TEXT feldern)
        headers: typeof row.headers === 'string' ? JSON.parse(row.headers || '[]') : (row.headers || []),
        data: typeof row.data === 'string' ? JSON.parse(row.data || '[]') : (row.data || [])
    };
}

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

async function getR5ShopVisibilitySetting() {
  const entry = await getAppSetting(R5_SHOP_VISIBILITY_KEY);
  if (!entry || entry.value == null) return false;
  return String(entry.value).toLowerCase() === 'true';
}

async function setR5ShopVisibilitySetting(enabled) {
  const value = enabled ? 'true' : 'false';
  return setAppSetting(R5_SHOP_VISIBILITY_KEY, value);
}

// (Behalten für Legacy-Kompatibilität, auch wenn ungenutzt)
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

// (Behalten für Legacy-Kompatibilität)
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

// Prüft, ob übergebene Datei-IDs zum angegebenen Königreich gehören
async function ensureFilesBelongToKingdom(fileIds = [], kingdomId) {
  if (!kingdomId) throw new Error('Kein Königreich angegeben');

  for (const fileId of fileIds.filter(Boolean)) {
    const table = fileId.startsWith('ov-')
      ? 'overview_files'
      : fileId.startsWith('hon-')
        ? 'honor_files'
        : fileId.startsWith('act-')
          ? 'activity_files'
          : null;

    if (!table) throw new Error(`Unbekannter Dateityp für ${fileId}`);

    const record = await get(`SELECT kingdom_id FROM ${table} WHERE id = $1`, [fileId]);
    if (!record) throw new Error(`Datei ${fileId} wurde nicht gefunden.`);
    if (record.kingdom_id !== kingdomId) {
      throw new Error(`Datei ${fileId} gehört nicht zu diesem Königreich.`);
    }
  }
}

// Ermittelt das Ziel-Königreich anhand des Slugs (Query-Param) oder des eingeloggten Users
async function resolveKingdomIdFromRequest(req, { allowDefaultForAdmin = false } = {}) {
  const { role, kingdomId } = req.user || {};
  let targetKingdomId = kingdomId || null;

  if (req.query && req.query.slug) {
    const k = await findKingdomBySlug(req.query.slug);
    if (!k) throw new Error('Ungültiger Kingdom-Slug');

    // Nur Admins dürfen beliebige Slugs ansteuern. R4/R5 müssen im eigenen Kingdom bleiben.
    if (role !== 'admin' && kingdomId && kingdomId !== k.id) {
      throw new Error('Kein Zugriff auf dieses Königreich. Bitte die öffentliche Ansicht verwenden.');
    }

    targetKingdomId = k.id;
  }

  if (!targetKingdomId && allowDefaultForAdmin && role === 'admin') {
    targetKingdomId = 'kdm-default';
  }

  if (!targetKingdomId) {
    throw new Error('Kein Kingdom-Kontext gefunden');
  }

  return targetKingdomId;
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
const activityStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsActivityDir); },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)); },
});

const overviewUpload = multer({
  storage: overviewStorage,
  fileFilter: (req, file, cb) => {
    if (['.xlsx', '.xls', '.csv'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // Erhöht
});
const honorUpload = multer({
  storage: honorStorage,
  fileFilter: (req, file, cb) => {
    if (['.xlsx', '.xls', '.csv'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});
const activityUpload = multer({
  storage: activityStorage,
  fileFilter: (req, file, cb) => {
    if (['.xlsx', '.xls', '.csv'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
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
    
    const dbUser = await get('SELECT role, kingdom_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager FROM users WHERE id = $1', [user.id]);
    if (!dbUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

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
      r5AccessValid: dbUser.role === 'r5' ? !!activeR5Access : false,
      r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null
    };
    next();
  });
}

// Optionaler Token-Resolver fÇ¬r Public-Routen
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
      r5AccessValid: dbUser.role === 'r5' ? !!activeR5Access : false
    };
  } catch (e) {
    return null;
  }
}

function isActiveR5(req) {
  return req.user && req.user.role === 'r5' && req.user.r5AccessValid;
}

function ensureActiveR5OrDeny(res) {
  return res.status(403).json({ error: 'R5 Zugang abgelaufen oder nicht freigeschaltet.' });
}

function requireReadAccess(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Nicht authentifiziert' });
    const role = req.user.role;
    if (role !== 'admin' && role !== 'r5' && role !== 'r4') {
        return res.status(403).json({ error: 'Admin, R5 oder R4 Rechte erforderlich' });
    }
    if (role === 'r5' && !isActiveR5(req)) {
        return ensureActiveR5OrDeny(res);
    }
    if ((role === 'r5' || role === 'r4') && !req.user.kingdomId) {
        return res.status(403).json({ error: `${role.toUpperCase()}-Benutzer ist keinem Königreich zugewiesen.` });
    }
    next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht authentifiziert' });
  const role = req.user.role;
  if (role !== 'admin' && role !== 'r5') return res.status(403).json({ error: 'Admin oder R5 Rechte erforderlich' });
  if (role === 'r5' && !isActiveR5(req)) return ensureActiveR5OrDeny(res);
  if (role === 'r5' && !req.user.kingdomId) return res.status(403).json({ error: 'R5-Benutzer ist keinem Königreich zugewiesen.' });
  next();
}

function requireKvkManager(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Nicht authentifiziert' });
  const { role, kingdomId, canAccessKvkManager } = req.user;

  if (role === 'admin') return next();

  if (role === 'r5') {
    if (!isActiveR5(req)) return ensureActiveR5OrDeny(res);
    if (!kingdomId) return res.status(403).json({ error: 'R5-Benutzer ist keinem Königreich zugewiesen.' });
    return next();
  }

  if (role === 'r4' && canAccessKvkManager) {
    if (!kingdomId) return res.status(403).json({ error: 'R4-Benutzer ist keinem Königreich zugewiesen.' });
    return next();
  }

  return res.status(403).json({ error: 'Admin, R5 oder KvK Manager Rechte erforderlich' });
}

function hasFileManagementAccess(req, type) {
    const {
      role,
      canManageOverviewFiles,
      canManageHonorFiles,
      canManageActivityFiles,
      canManageAnalyticsFiles,
    } = req.user;

    if (role === 'admin') return true;
    if (role === 'r5') return !!req.user.r5AccessValid;

    if (role === 'r4') {
      if (type === 'activity') return !!canManageActivityFiles;

      // R4 Permissions are reduced to a single Analytics flag for Overview/Honor/Analytics uploads
      if (type === 'overview' || type === 'honor' || type === 'analytics') {
        return !!canManageAnalyticsFiles || !!canManageOverviewFiles || !!canManageHonorFiles;
      }
    }

    return false;
}


// ==================== AUTH ENDPOINTS ====================

app.post('/api/auth/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;
    if (!governorId || !String(governorId).trim()) {
      return res.status(400).json({ exists: false, error: 'Gov ID wird benötigt' });
    }
    const isTaken = await userGovIdExists(governorId);
    res.json({ isTaken });
  } catch (err) {
    console.error('check-gov-id error:', err);
    res.status(500).json({ error: 'Gov ID check failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId, slug } = req.body;

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

    let assignedKingdomId = null;
    if (slug) {
        const k = await findKingdomBySlug(slug);
        if (k) {
            assignedKingdomId = k.id;
        }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    await query(
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_access_honor, can_access_analytics, can_access_overview, kingdom_id, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [userId, email, username, passwordHash, false, 'user', normalizedGovId, false, false, false, assignedKingdomId, false, false, false, false, false]
    );

    return res.json({
      message: 'Registrierung erfolgreich.',
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
          canAccessKvkManager: false
      }
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

    const user = await get('SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const activeR5Access = user.role === 'r5' ? await getActiveR5Access(user.id) : null;
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
            r5AccessValid: user.role === 'r5' ? !!activeR5Access : false,
            r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null
        }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT *, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

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
      r5AccessValid: user.role === 'r5' ? !!activeR5Access : false,
      r5AccessExpiresAt: activeR5Access ? activeR5Access.expires_at : null
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
      `INSERT INTO users (id, email, username, password_hash, is_approved, role, governor_id, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
      ['admin-001', 'admin@kd3619.com', 'Stadmin', adminPasswordHash, true, 'admin', null, true, true, true, true, true]
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
      `SELECT id, email, username, is_approved, role, created_at, kingdom_id, governor_id, can_access_honor, can_access_analytics, can_access_overview, can_manage_overview_files, can_manage_honor_files, can_manage_activity_files, can_manage_analytics_files, can_access_kvk_manager FROM users ${whereClause} ORDER BY created_at DESC`, params
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
        canManageOverviewFiles: !!user.can_manage_overview_files,
        canManageHonorFiles: !!user.can_manage_honor_files,
        canManageActivityFiles: !!user.can_manage_activity_files,
        canManageAnalyticsFiles: !!user.can_manage_analytics_files,
        canAccessKvkManager: !!user.can_access_kvk_manager
    })));
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

app.post('/api/admin/users/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, approved } = req.body;
    const currentUserKingdomId = getKingdomId(req);

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

app.post('/api/admin/users/access-files', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, canManageActivityFiles, canManageAnalyticsFiles, canAccessKvkManager } = req.body;
      const currentUserKingdomId = getKingdomId(req);

      if (!userId) return res.status(400).json({ error: 'Benutzer ID wird benötigt' });

      const targetUser = await get('SELECT role, kingdom_id FROM users WHERE id = $1', [userId]);
      if (!targetUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      if (targetUser.role === 'admin' || userId === req.user.id) {
          return res.status(403).json({ error: 'Kein Zugriff, um diese Benutzerrechte zu ändern.' });
      }

      if (currentUserKingdomId) {
        if (!targetUser.kingdom_id || targetUser.kingdom_id !== currentUserKingdomId) {
          return res.status(403).json({ error: 'Zugriff verweigert' });
        }
      }

      // Manage Analytics applies to both overview and honor uploads for R4 users
      const analyticsFlag = !!canManageAnalyticsFiles;

      await query(
        `UPDATE users SET can_manage_overview_files=$1, can_manage_honor_files=$2, can_manage_activity_files=$3, can_manage_analytics_files=$4, can_access_kvk_manager=$5 WHERE id=$6`,
        [analyticsFlag, analyticsFlag, !!canManageActivityFiles, analyticsFlag, !!canAccessKvkManager, userId]
      );
      res.json({ success: true });
    } catch(e) {
        console.error('Error in /api/admin/users/access-files:', e);
        res.status(500).json({error: 'Error'});
    }
});


app.post('/api/admin/users/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { userId, role, accessCode, kingdomId: requestedKingdomId } = req.body;
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

      if (role === 'r5') {
          if (currentUserRole !== 'admin') return res.status(403).json({ error: 'R5 Rollen können nur vom Superadmin vergeben werden.' });

          const targetK = requestedKingdomId || currentUserKingdomId || (await get('SELECT kingdom_id FROM users WHERE id = $1', [userId]))?.kingdom_id;
          if (!targetK) return res.status(400).json({ error: 'Königreich für R5 wird benötigt.' });

          const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [targetK]);
          if (!kingdom) return res.status(404).json({ error: 'Königreich nicht gefunden' });

          if (accessCode) {
              const activation = await activateR5Code(accessCode, userId, targetK);
              await assignR5(userId, targetK);
              await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [userId]);
          }

          // Ohne Code: Rolle vergeben, aber kein aktiver Zugang (User kann später selbst aktivieren)
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

app.post('/api/admin/users/assign-r4', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });

    try {
        const { userId, kingdomId } = req.body;
        
        if (!userId || !kingdomId) {
            return res.status(400).json({ error: 'Benutzer ID und Königreich ID sind erforderlich.' });
        }
        
        const targetUser = await get('SELECT role FROM users WHERE id = $1', [userId]);
        if (!targetUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        if (targetUser.role === 'admin' || targetUser.role === 'r5') {
             return res.status(403).json({ error: 'Kann Admin/R5 Rollen nicht über diesen Endpoint zuweisen.' });
        }
        
        await query('UPDATE users SET role = $1, kingdom_id = $2, is_approved = true, can_manage_overview_files = false, can_manage_honor_files = false, can_manage_activity_files = false WHERE id = $3', ['r4', kingdomId, userId]);
        
        return res.json({ success: true, message: `Benutzer ${userId} wurde Rolle R4 und Königreich ${kingdomId} zugewiesen.` });
        
    } catch (error) {
        console.error('❌ Error during assign-r4:', error);
        return res.status(500).json({ error: 'R4 Zuweisung fehlgeschlagen' });
    }
});

// ==================== R5 ACCESS CODES ====================

// Global Shop Visibility for R5 (Superadmin control)
app.get('/api/shop-visibility', async (req, res) => {
    try {
        const enabled = await getR5ShopVisibilitySetting();
        res.json({ enabled });
    } catch (error) {
        console.error('Error loading shop visibility:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Shop-Einstellung' });
    }
});

app.get('/api/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const enabled = await getR5ShopVisibilitySetting();
        res.json({ enabled });
    } catch (error) {
        console.error('Error loading R5 shop visibility:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Shop-Einstellung' });
    }
});

app.get('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const enabled = await getR5ShopVisibilitySetting();
        res.json({ enabled });
    } catch (error) {
        console.error('Error loading R5 shop visibility:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Shop-Einstellung' });
    }
});

app.put('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled muss boolean sein' });
        }
        await setR5ShopVisibilitySetting(enabled);
        res.json({ success: true, enabled });
    } catch (error) {
        console.error('Error saving R5 shop visibility:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Shop-Einstellung' });
    }
});

app.get('/api/admin/r5-codes', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const codes = await getR5Codes();
        res.json(codes.map(c => ({
            code: c.code,
            durationDays: c.duration_days,
            createdAt: c.created_at,
            usedByUserId: c.used_by_user_id,
            kingdomId: c.kingdom_id,
            activatedAt: c.activated_at,
            expiresAt: c.expires_at,
            isActive: c.is_active
        })));
    } catch (error) {
        console.error('Error loading R5 codes:', error);
        res.status(500).json({ error: 'Fehler beim Laden der R5 Codes' });
    }
});

app.post('/api/admin/r5-codes', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { durationDays } = req.body;
        if (!R5_CODE_DURATIONS.includes(Number(durationDays))) {
            return res.status(400).json({ error: `Ungültige Laufzeit. Erlaubt sind ${R5_CODE_DURATIONS.join(', ')} Tage.` });
        }
        const code = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
        const created = await generateR5Code(Number(durationDays), code);
        res.json({
            code: created.code,
            durationDays: created.duration_days,
            createdAt: created.created_at
        });
    } catch (error) {
        console.error('Error creating R5 code:', error);
        res.status(500).json({ error: 'R5 Code konnte nicht erstellt werden' });
    }
});

app.post('/api/admin/r5-codes/activate', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { code, userId, kingdomId, assignOnly } = req.body;
        if (!code || !userId || !kingdomId) {
            return res.status(400).json({ error: 'Code, Benutzer und Königreich werden benötigt.' });
        }

        const user = await get('SELECT id FROM users WHERE id = $1', [userId]);
        if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [kingdomId]);
        if (!kingdom) return res.status(404).json({ error: 'Königreich nicht gefunden' });

        if (assignOnly) {
            const assigned = await assignR5Code(code, userId, kingdomId);
            return res.json({
                success: true,
                assignedOnly: true,
                code: assigned.code,
                durationDays: assigned.duration_days,
                kingdomId: assigned.kingdom_id,
                usedByUserId: assigned.used_by_user_id
            });
        }

        const activation = await activateR5Code(code, userId, kingdomId);
        await assignR5(userId, kingdomId);
        await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [userId]);

        res.json({
            success: true,
            activatedAt: activation.activated_at,
            durationDays: activation.duration_days
        });
    } catch (error) {
        console.error('Error activating R5 code:', error);
        res.status(400).json({ error: error.message || 'Aktivierung fehlgeschlagen' });
    }
});

// Admin: Code deaktivieren oder Zuweisung entfernen
app.post('/api/admin/r5-codes/:code/deactivate', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const code = req.params.code;
        const existing = await getR5Code(code);
        if (!existing) return res.status(404).json({ error: 'Code nicht gefunden' });

        const cleared = await deactivateR5Code(code, { clearAssignment: true });
        return res.json({
            success: true,
            code: cleared.code,
            durationDays: cleared.duration_days,
            createdAt: cleared.created_at,
            usedByUserId: cleared.used_by_user_id,
            kingdomId: cleared.kingdom_id,
            activatedAt: cleared.activated_at,
            expiresAt: cleared.expires_at,
            isActive: cleared.is_active
        });
    } catch (error) {
        console.error('Error deactivating R5 code:', error);
        res.status(500).json({ error: 'Code konnte nicht deaktiviert werden' });
    }
});

// Admin: Code löschen (auch wenn zugewiesen/aktiviert)
app.delete('/api/admin/r5-codes/:code', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const code = req.params.code;
        const existing = await getR5Code(code);
        if (!existing) return res.status(404).json({ error: 'Code nicht gefunden' });

        if (existing.used_by_user_id || existing.is_active) {
            await deactivateR5Code(code, { clearAssignment: true });
        }
        await query('DELETE FROM r5_codes WHERE code = $1', [code]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting R5 code:', error);
        res.status(500).json({ error: 'Code konnte nicht gelöscht werden' });
    }
});

// Kunden-Endpunkt: Eigene Codes abrufen
app.get('/api/r5-codes/my', authenticateToken, async (req, res) => {
  try {
    const codes = await all(
      `SELECT code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active 
       FROM r5_codes 
       WHERE used_by_user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(
      codes.map((c) => ({
        code: c.code,
        durationDays: c.duration_days,
        createdAt: c.created_at,
        usedByUserId: c.used_by_user_id,
        kingdomId: c.kingdom_id,
        activatedAt: c.activated_at,
        expiresAt: c.expires_at,
        isActive: c.is_active,
      }))
    );
  } catch (error) {
    console.error('Error loading own R5 codes:', error);
    return res.status(500).json({ error: 'Fehler beim Laden deiner R5 Codes' });
  }
});

// Kunden-Endpunkt: Code selbst aktivieren (setzt R5-Rolle fÇ¬r das eigene KÇônigreich)
app.post('/api/r5-codes/activate-self', authenticateToken, async (req, res) => {
  try {
    const { code, kingdomId } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code wird benÇôtigt.' });
    }

    const dbUser = await get('SELECT kingdom_id FROM users WHERE id = $1', [req.user.id]);
    const targetKingdomId = kingdomId || dbUser?.kingdom_id || req.user.kingdomId;

    if (!targetKingdomId) {
      return res.status(400).json({ error: 'Kein KÇônigreich hinterlegt. Bitte wende dich an den Superadmin.' });
    }

    const targetCode = await getR5Code(code);
    if (targetCode && Number(targetCode.duration_days) === 0) {
      return res.status(403).json({ error: 'Lifetime Codes koennen nur vom Superadmin vergeben werden.' });
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
    console.error('Error self-activating R5 code:', error);
    return res.status(400).json({ error: error.message || 'Aktivierung fehlgeschlagen' });
  }
});


// ==================== KINGDOM ADMIN ENDPOINTS ====================

app.get('/api/admin/kingdoms', authenticateToken, requireReadAccess, async (req, res) => {
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
        
        const existingBySlug = await findKingdomBySlug(nSlug);
        if (existingBySlug) {
             return res.status(400).json({ error: `Slug '${nSlug}' ist bereits für das Königreich '${existingBySlug.display_name}' vergeben.` });
        }
        
        await query(`INSERT INTO kingdoms (id, display_name, slug, rok_identifier) VALUES ($1,$2,$3,$4)`, [id, displayName, nSlug, rokIdentifier]);
        res.json({ id, displayName, slug: nSlug });
    } catch(e) { res.status(500).json({error: 'Error'}); }
});

app.put('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { displayName, slug } = req.body;
        if (!displayName || !slug) return res.status(400).json({ error: 'Display Name and Slug required' });

        const normalizedSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-');

        const existingBySlug = await get('SELECT id, display_name FROM kingdoms WHERE LOWER(slug) = $1 AND id != $2 LIMIT 1', [normalizedSlug, req.params.id]);
        if (existingBySlug) {
             return res.status(400).json({ error: `Slug '${normalizedSlug}' ist bereits für das Königreich '${existingBySlug.display_name}' vergeben.` });
        }

        await query(
            'UPDATE kingdoms SET display_name = $1, slug = $2, updated_at = NOW() WHERE id = $3',
            [displayName, normalizedSlug, req.params.id]
        );

        const updated = await get(`
            SELECT k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.created_at, k.updated_at, k.owner_user_id, u.username AS owner_username, u.email AS owner_email 
            FROM kingdoms k LEFT JOIN users u ON u.id = k.owner_user_id
            WHERE k.id = $1`, [req.params.id]);
            
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
                ownerEmail: updated.owner_email
            }
        });

    } catch(e) {
        console.error('Update kingdom error:', e);
        res.status(500).json({error: 'Failed to update kingdom'}); 
    }
});

app.post('/api/admin/kingdoms/:id/assign-r5', authenticateToken, requireAdmin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Superadmin' });
    try {
        const { r5UserId, accessCode } = req.body;
        if (!r5UserId) return res.status(400).json({ error: 'R5 Benutzer ist erforderlich.' });

        const targetUser = await get('SELECT id FROM users WHERE id = $1', [r5UserId]);
        if (!targetUser) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

        const kingdom = await get('SELECT id FROM kingdoms WHERE id = $1', [req.params.id]);
        if (!kingdom) return res.status(404).json({ error: 'Königreich nicht gefunden' });

        let expiresAt = null;
        if (accessCode) {
            const activation = await activateR5Code(accessCode, r5UserId, req.params.id);
            expiresAt = activation.expires_at;
        }

        await assignR5(r5UserId, req.params.id);
        await query('UPDATE users SET is_approved = TRUE WHERE id = $1', [r5UserId]);

        res.json({ success: true, message: `R5 zugewiesen.`, expiresAt });
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


// ==================== KVK MANAGER ENDPOINTS (MODULAR UPDATE) ====================

// 1. GET /api/admin/kvk/events - Liste der Events (für Admin/R5 und freigeschaltete R4)
app.get('/api/admin/kvk/events', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let kingdomId = isAdmin ? (req.query.kingdomId || req.user.kingdomId) : req.user.kingdomId;

    if (!kingdomId && isAdmin && req.query.slug) {
      const kingdom = await findKingdomBySlug(req.query.slug);
      if (!kingdom) return res.status(400).json({ error: 'Ungültiger Kingdom-Slug' });
      kingdomId = kingdom.id;
    }

    if (!kingdomId) {
      if (isAdmin) {
        const events = await getAllKvkEvents();
        return res.json(events);
      }
      return res.status(400).json({ error: 'Kingdom ID erforderlich' });
    }

    const events = await getKvkEvents(kingdomId);
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Laden der KvK Events' });
  }
});

// 2. POST /api/admin/kvk/events - Neues Event erstellen (mit Fights Array)
app.post('/api/admin/kvk/events', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    // UPDATED: Jetzt mit honorStartFileId / honorEndFileId
    const {
      name,
      fights,
      eventStartFileId,
      honorStartFileId,
      honorEndFileId,
      dkpFormula,
      goalsFormula,
      isPublic,
      rankingPublic,
      honorPublic,
      isRankingPublic,
      isHonorPublic,
      kingdomId: bodyKingdomId
    } = req.body;

    let targetKingdomId = req.user.kingdomId;
    if (req.user.role === 'admin') {
      if (bodyKingdomId) {
        targetKingdomId = bodyKingdomId;
      } else if (req.query.slug) {
        const slugKingdom = await findKingdomBySlug(req.query.slug);
        if (!slugKingdom) return res.status(400).json({ error: 'Ungültiger Kingdom-Slug' });
        targetKingdomId = slugKingdom.id;
      }
    }

    if (!targetKingdomId) {
      return res.status(400).json({ error: 'Kein Königreich zugewiesen.' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Name ist erforderlich.' });
    }

    try {
      await ensureFilesBelongToKingdom([eventStartFileId, honorStartFileId, honorEndFileId], targetKingdomId);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const resolvedRankingPublic = rankingPublic ?? isRankingPublic;
    const resolvedHonorPublic = honorPublic ?? isHonorPublic;

    const newEvent = {
      id: 'kvk-' + Date.now(),
      name,
      kingdomId: targetKingdomId,
      fights: fights || [],
      eventStartFileId,
      // Range statt Liste
      honorStartFileId,
      honorEndFileId,
      dkpFormula: dkpFormula || null,
      goalsFormula: goalsFormula || null,
      isPublic: !!isPublic,
      isRankingPublic: resolvedRankingPublic ?? isPublic ?? true,
      isHonorPublic: resolvedHonorPublic ?? isPublic ?? true,
      createdAt: new Date().toISOString()
    };

    const created = await createKvkEvent(newEvent);
    res.json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Erstellen des KvK Events' });
  }
});

// 3. PUT /api/admin/kvk/events/:id - Event bearbeiten
app.put('/api/admin/kvk/events/:id', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const {
      name,
      fights,
      eventStartFileId,
      honorStartFileId,
      honorEndFileId,
      dkpFormula,
      goalsFormula,
      isPublic,
      rankingPublic,
      honorPublic,
      isRankingPublic,
      isHonorPublic
    } = req.body;
    const eventId = req.params.id;

    // Check ownership
    const existing = await getKvkEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event nicht gefunden' });

    if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    try {
      await ensureFilesBelongToKingdom([eventStartFileId, honorStartFileId, honorEndFileId], existing.kingdomId);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const resolvedRankingPublic = rankingPublic ?? isRankingPublic;
    const resolvedHonorPublic = honorPublic ?? isHonorPublic;

    const updated = await updateKvkEvent(eventId, {
      name,
      fights,
      eventStartFileId,
      honorStartFileId,
      honorEndFileId,
      dkpFormula: dkpFormula || null,
      goalsFormula: goalsFormula || null,
      isPublic,
      isRankingPublic: resolvedRankingPublic ?? existing.isRankingPublic ?? existing.isPublic,
      isHonorPublic: resolvedHonorPublic ?? existing.isHonorPublic ?? existing.isPublic
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des KvK Events' });
  }
});

// 4. DELETE /api/admin/kvk/events/:id - Event löschen
app.delete('/api/admin/kvk/events/:id', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const eventId = req.params.id;
    const existing = await getKvkEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event nicht gefunden' });
    if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) return res.status(403).json({ error: 'Zugriff verweigert' });

    await deleteKvkEvent(eventId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler beim Löschen des KvK Events' });
  }
});

// ==================== PUBLIC ENDPOINTS (PublicKvKView) ====================

app.get('/api/public/kingdom/:slug', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    res.json(k);
});

app.get('/api/public/kingdom/:slug/kvk-events', async (req, res) => {
    try {
      const k = await findKingdomBySlug(req.params.slug);
      if (!k) return res.status(404).json({ error: 'Not found' });
      const viewer = await getOptionalUser(req);
      const events = await getKvkEvents(k.id);

      // Standard: Nur öffentliche Events
      let visibleEvents = events.filter(e => e.isPublic);

      // R4/R5 (gleiches Kingdom) oder Admin dürfen auch private sehen
      if (viewer) {
        const isPrivileged = viewer.role === 'admin' || viewer.role === 'r4' || (viewer.role === 'r5' && viewer.r5AccessValid);
        const sameKingdom = viewer.role === 'admin' ? true : viewer.kingdomId === k.id;
        if (isPrivileged && sameKingdom) {
          visibleEvents = events;
        }
      }

      res.json(visibleEvents);
    } catch (error) { res.status(500).json({ error: 'Error loading events' }); }
});

// WICHTIG: Public Routes mit normalizeFileRow, damit das Frontend "uploadDate" bekommt
app.get('/api/public/kingdom/:slug/overview-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    // Sortiert nach Datum (uploaddate ist in Postgres klein!)
    const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [k.id]);
    res.json(rows.map(normalizeFileRow));
});

app.get('/api/public/kingdom/:slug/honor-files', async (req, res) => {
    const k = await findKingdomBySlug(req.params.slug);
    if (!k) return res.status(404).json({ error: 'Not found' });
    const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [k.id]);
    res.json(rows.map(normalizeFileRow));
});


// ==================== FILES (UNIFIED ENDPOINTS) ====================

// 1. OVERVIEW (Shared by Analytics & KvK Manager)
app.get('/overview/files-data', authenticateToken, async (req, res) => {
    try {
        const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        // Sortiere nach uploaddate (lowercase für PG)
        const rows = await all(`SELECT * FROM overview_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [kId]);
        res.json(rows.map(normalizeFileRow));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/overview/upload', authenticateToken, overviewUpload.single('file'), async (req, res) => {
    const { role, kingdomId, id: userId } = req.user;
    
    if (!hasFileManagementAccess(req, 'overview') && role !== 'admin') {
         return res.status(403).json({ error: 'Keine Berechtigung zum Hochladen.' });
    }
    
    let finalK;
    try {
        finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'ov-' + Date.now();
        // Insert mit uploaddate (klein)
        await query(
          `INSERT INTO overview_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, userId]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/overview/files/:id', authenticateToken, async (req, res) => {
    try {
        let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        const f = await get('SELECT kingdom_id, path FROM overview_files WHERE id=$1', [req.params.id]);
        if (!f) return res.status(404).json({ error: 'Not found' });

        if (!hasFileManagementAccess(req, 'overview') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && !req.query.slug) {
            targetKingdomId = f.kingdom_id;
        }
        if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        await query('DELETE FROM overview_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/overview/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!order || !Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'Invalid' });
    if (!hasFileManagementAccess(req, 'overview') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    try {
        const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        await ensureFilesBelongToKingdom(order, targetKingdomId);
        for (let i = 0; i < order.length; i++) await query('UPDATE overview_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
        res.json({ success: true });
    } catch(e) {
        // Fallback: Postgres könnte lowercase 'fileorder' nutzen
        try {
            for (let i = 0; i < order.length; i++) await query('UPDATE overview_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
            res.json({ success: true });
        } catch(ex) { res.status(500).json({ error: 'Reorder failed' }); }
    }
});

// 2. HONOR
app.get('/honor/files-data', authenticateToken, async (req, res) => {
    try {
        const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        // uploaddate (lowercase) sortieren, normalizeFileRow für CamelCase Output
        const rows = await all(`SELECT * FROM honor_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate ASC`, [kId]);
        res.json(rows.map(normalizeFileRow));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/honor/upload', authenticateToken, honorUpload.single('file'), async (req, res) => {
    const { role, kingdomId, id: userId } = req.user;
    
    if (!hasFileManagementAccess(req, 'honor') && role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    let finalK;
    try {
        finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
    if (!finalK || !req.file) return res.status(400).json({ error: 'Error' });

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'hon-' + Date.now();
        await query(
          `INSERT INTO honor_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, userId]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Upload failed' }); }
});

app.delete('/honor/files/:id', authenticateToken, async (req, res) => {
    try {
        let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        const f = await get('SELECT kingdom_id, path FROM honor_files WHERE id=$1', [req.params.id]);
        if (!f) return res.status(404).json({ error: 'Not found' });
        if (!hasFileManagementAccess(req, 'honor') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && !req.query.slug) {
            targetKingdomId = f.kingdom_id;
        }
        if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        await query('DELETE FROM honor_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/honor/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!hasFileManagementAccess(req, 'honor') && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    try {
        const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        await ensureFilesBelongToKingdom(order, targetKingdomId);
        for (let i = 0; i < order.length; i++) await query('UPDATE honor_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
        res.json({ success: true });
    } catch(e) {
        try {
            for (let i = 0; i < order.length; i++) await query('UPDATE honor_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
            res.json({ success: true });
        } catch(ex) { res.status(500).json({ error: 'Reorder failed' }); }
    }
});

// 3. ACTIVITY (R4/R5 Only)
app.get('/activity/files-data', authenticateToken, async (req, res) => {
    if (!['admin', 'r5', 'r4'].includes(req.user.role)) return res.status(403).json({ error: 'Kein Zugriff' });

    try {
        const kId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        const rows = await all(`SELECT * FROM activity_files WHERE kingdom_id = $1 ORDER BY fileOrder, uploaddate`, [kId]);
        res.json(rows.map(normalizeFileRow));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/activity/upload', authenticateToken, activityUpload.single('file'), async (req, res) => {
    const { role, kingdomId, id: userId } = req.user;
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });

    let finalK;
    try {
        finalK = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
    if (!finalK || !req.file) return res.status(400).json({ error: 'Error' });

    try {
        const { headers, data } = await parseExcel(req.file.path);
        const id = 'act-' + Date.now();
        await query(
          `INSERT INTO activity_files (id, name, filename, path, size, uploaddate, headers, data, kingdom_id, uploaded_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, req.file.originalname, req.file.filename, req.file.path, req.file.size, new Date().toISOString(), JSON.stringify(headers), JSON.stringify(data), finalK, userId]
        );
        res.json({ success: true });
    } catch(e) { 
        console.error(e);
        res.status(500).json({ error: 'Upload failed' }); 
    }
});

app.delete('/activity/files/:id', authenticateToken, async (req, res) => {
    try {
        let targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        const f = await get('SELECT kingdom_id, path FROM activity_files WHERE id=$1', [req.params.id]);
        if (!f) return res.status(404).json({ error: 'Not found' });
        if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && !req.query.slug) {
            targetKingdomId = f.kingdom_id;
        }
        if (f.kingdom_id !== targetKingdomId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        if (req.user.role === 'admin' && req.query.slug && f.kingdom_id !== targetKingdomId) return res.status(403).json({ error: 'Forbidden' });

        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        await query('DELETE FROM activity_files WHERE id=$1 AND kingdom_id = $2', [req.params.id, targetKingdomId]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/activity/files/reorder', authenticateToken, async (req, res) => {
    const { order } = req.body;
    if (!hasFileManagementAccess(req, 'activity')) return res.status(403).json({ error: 'Forbidden' });
    
    try {
        const targetKingdomId = await resolveKingdomIdFromRequest(req, { allowDefaultForAdmin: true });
        await ensureFilesBelongToKingdom(order, targetKingdomId);
        for (let i = 0; i < order.length; i++) await query('UPDATE activity_files SET fileOrder = $1 WHERE id = $2 AND kingdom_id = $3', [i, order[i], targetKingdomId]);
        res.json({ success: true });
    } catch(e) {
        try {
            for (let i = 0; i < order.length; i++) await query('UPDATE activity_files SET fileorder = $1 WHERE id = $2', [i, order[i]]);
            res.json({ success: true });
        } catch(ex) { res.status(500).json({ error: 'Reorder failed' }); }
    }
});

app.get('/health', (req, res) => res.json({ status: 'Backend läuft', time: new Date() }));

app.get('/', (req, res) => {
  res.json({ message: 'KD3619 Backend API', version: '2.6.0-KVK-MANAGER' });
});

async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      await initPgSchema();
    } catch (err) {
      console.error('Postgres schema init failed:', err);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();






