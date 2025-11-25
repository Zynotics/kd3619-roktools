// server.js - Backend mit Admin, Uploads, Gov-ID-Validierung & Feature-Rechten
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';

// CORS für Production und Development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
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

// 📂 Upload-Ordner erstellen
const uploadsOverviewDir = path.join(__dirname, 'uploads', 'overview');
const uploadsHonorDir = path.join(__dirname, 'uploads', 'honor');

[uploadsOverviewDir, uploadsHonorDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// SQLite Datenbank Setup
const dbPath = path.join(__dirname, 'uploads.db');
console.log('Database path:', dbPath);

// Database connection
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Database connected successfully');
} catch (error) {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
}

// Tabellen erstellen falls nicht vorhanden
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_approved INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    governor_id TEXT,
    can_access_honor INTEGER DEFAULT 0,
    can_access_analytics INTEGER DEFAULT 0,
    can_access_overview INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS overview_files (
    id TEXT PRIMARY KEY,
    name TEXT,
    filename TEXT,
    path TEXT,
    size INTEGER,
    uploadDate TEXT,
    fileOrder INTEGER DEFAULT 0,
    headers TEXT,
    data TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS honor_files (
    id TEXT PRIMARY KEY,
    name TEXT,
    filename TEXT,
    path TEXT,
    size INTEGER,
    uploadDate TEXT,
    fileOrder INTEGER DEFAULT 0,
    headers TEXT,
    data TEXT
  )
`);

// ggf. Spalten für ältere DBs nachziehen
const addColumnIfNotExists = (table, column, def) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`).run();
    console.log(`✅ Column ${column} added to ${table}`);
  } catch (e) {
    console.log(`ℹ️ Column ${column} already exists on ${table}, skipping`);
  }
};

addColumnIfNotExists('users', 'governor_id', 'TEXT');
addColumnIfNotExists('users', 'can_access_honor', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'can_access_analytics', 'INTEGER DEFAULT 0');
addColumnIfNotExists('users', 'can_access_overview', 'INTEGER DEFAULT 0');

// Admin-Benutzer erstellen/verifizieren
try {
  const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get('Stadmin');

  if (!existingAdmin) {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    const insertAdmin = db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, is_approved, role,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAdmin.run(
      'admin-001',
      'admin@kd3619.com',
      'Stadmin',
      adminPasswordHash,
      1,
      'admin',
      null,
      1,
      1,
      1
    );
    console.log('✅ Admin user created successfully');
  } else {
    console.log('✅ Admin user already exists');
    const updateAdmin = db.prepare(`
      UPDATE users
      SET is_approved = 1,
          role = 'admin',
          can_access_honor = 1,
          can_access_analytics = 1,
          can_access_overview = 1
      WHERE username = ?
    `);
    updateAdmin.run('Stadmin');
    console.log('✅ Admin user permissions verified');
  }
} catch (error) {
  console.error('❌ Error creating/verifying admin user:', error);
}

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin-Middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin Zugriff erforderlich' });
  }
  next();
};

// Hilfsfunktion zum Finden von Spalten-Index (case-insensitive)
function findColumnIndex(headers, possibleNames) {
  if (!Array.isArray(headers)) return undefined;
  const lowerHeaders = headers.map((h) => (h ? String(h).toLowerCase().trim() : ''));
  for (const name of possibleNames) {
    const target = String(name).toLowerCase().trim();
    const idx = lowerHeaders.indexOf(target);
    if (idx !== -1) return idx;
  }
  return undefined;
}

// Hilfsfunktion: Gov-ID in hochgeladenen Dateien suchen
function governorIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  if (!governorId) return false;

  const tables = ['overview_files', 'honor_files'];
  const possibleGovHeaders = ['governor id', 'governorid', 'gov id'];

  try {
    for (const table of tables) {
      const rows = db.prepare(`SELECT headers, data FROM ${table}`).all();
      for (const row of rows) {
        const headers = JSON.parse(row.headers || '[]');
        const data = JSON.parse(row.data || '[]');

        const govIdx = findColumnIndex(headers, possibleGovHeaders);
        if (govIdx === undefined) continue;

        for (const r of data) {
          const value = r[govIdx];
          if (value == null) continue;
          const v = String(value).trim();
          if (v === governorId) {
            console.log(`✅ Found governorId ${governorId} in table ${table}`);
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error while searching governorId:', e);
    return false;
  }

  console.log(`❌ governorId ${governorId} not found in any uploaded data`);
  return false;
}

// Datei parsen (Excel oder CSV)
function parseFile(filePath, originalName) {
  return new Promise((resolve, reject) => {
    try {
      if (filePath.endsWith('.csv')) {
        const csvData = fs.readFileSync(filePath, 'utf8');
        const lines = csvData.split('\n').filter((line) => line.trim());
        const headers = lines[0].split(',').map((h) => h.trim());
        const data = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          return values;
        });

        resolve({ headers, data });
      } else {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        const headers = jsonData[0].map((h) => (h ? h.toString() : ''));
        const data = jsonData.slice(1).filter((row) => row.length > 0);

        resolve({ headers, data });
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Multer Konfiguration für Overview
const overviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsOverviewDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// Multer Konfiguration für Honor
const honorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsHonorDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const allowedExtensions = ['.xlsx', '.xls', '.csv'];

const overviewUpload = multer({
  storage: overviewStorage,
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const honorUpload = multer({
  storage: honorStorage,
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// ==================== AUTH ENDPOINTS ====================

// Gov ID Check für Live-Validierung im Frontend
app.post('/api/auth/check-gov-id', (req, res) => {
  const { governorId } = req.body;
  if (!governorId || !String(governorId).trim()) {
    return res.status(400).json({ exists: false, error: 'Gov ID wird benötigt' });
  }
  const exists = governorIdExists(governorId);
  res.json({ exists });
});

// Registrierung mit Gov-ID-Check
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId } = req.body;

    if (!email || !username || !password || !governorId) {
      return res.status(400).json({
        error: 'Email, Benutzername, Passwort und Gov ID werden benötigt',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Prüfen ob Benutzer bereits existiert
    const existingUser = db
      .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
      .get(email, username);
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'Benutzer mit dieser Email oder diesem Benutzernamen existiert bereits' });
    }

    // Gov ID gegen hochgeladene Daten prüfen
    const govOk = governorIdExists(governorId);
    if (!govOk) {
      return res.status(400).json({
        error: 'Die angegebene Gov ID wurde in den hochgeladenen Daten nicht gefunden.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    const stmt = db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, is_approved, role,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      email,
      username,
      passwordHash,
      0,
      'user',
      String(governorId).trim(),
      0,
      0,
      0
    );

    res.json({
      message:
        'Registrierung erfolgreich. Bitte warten Sie auf die Freigabe durch einen Administrator.',
      user: {
        id: userId,
        email,
        username,
        isApproved: false,
        role: 'user',
        governorId: String(governorId).trim(),
        canAccessHonor: false,
        canAccessAnalytics: false,
        canAccessOverview: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort werden benötigt' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      isApproved: !!user.is_approved,
      governorId: user.governor_id || null,
      canAccessHonor: !!user.can_access_honor,
      canAccessAnalytics: !!user.can_access_analytics,
      canAccessOverview: !!user.can_access_overview,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isApproved: !!user.is_approved,
        role: user.role,
        governorId: user.governor_id || null,
        canAccessHonor: !!user.can_access_honor,
        canAccessAnalytics: !!user.can_access_analytics,
        canAccessOverview: !!user.can_access_overview,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Token Validierung
app.get('/api/auth/validate', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

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
  });
});

// ==================== ADMIN ENDPOINTS ====================

// Debug Endpoint zum Überprüfen aller Benutzer
app.get('/api/debug/users', (req, res) => {
  try {
    const stmt = db.prepare(
      'SELECT id, username, email, is_approved, role, governor_id, can_access_honor, can_access_analytics, can_access_overview FROM users'
    );
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Manuellen Admin Creation Endpoint
app.post('/api/admin/create-admin', (req, res) => {
  try {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    const insertAdmin = db.prepare(`
      INSERT OR REPLACE INTO users (
        id, email, username, password_hash, is_approved, role,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAdmin.run(
      'admin-001',
      'admin@kd3619.com',
      'Stadmin',
      adminPasswordHash,
      1,
      'admin',
      null,
      1,
      1,
      1
    );
    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Manual admin creation error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Alle Benutzer abrufen (nur Admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT
        id, email, username, is_approved, role, created_at,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      FROM users
      ORDER BY created_at DESC
    `);
    const users = stmt.all();

    res.json(
      users.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        isApproved: !!user.is_approved,
        role: user.role,
        createdAt: user.created_at,
        governorId: user.governor_id || null,
        canAccessHonor: !!user.can_access_honor,
        canAccessAnalytics: !!user.can_access_analytics,
        canAccessOverview: !!user.can_access_overview,
      }))
    );
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// Benutzer freigeben/sperren (Grund-Freigabe)
app.post('/api/admin/users/approve', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId, approved } = req.body;

    if (!userId || typeof approved !== 'boolean') {
      return res.status(400).json({
        error: 'Ungültige Eingabe: userId und approved (boolean) werden benötigt',
      });
    }

    const approvedValue = approved ? 1 : 0;
    const stmt = db.prepare('UPDATE users SET is_approved = ? WHERE id = ?');
    const result = stmt.run(approvedValue, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      success: true,
      message: `Benutzer erfolgreich ${approved ? 'freigegeben' : 'gesperrt'}`,
      changes: result.changes,
    });
  } catch (error) {
    console.error('💥 CRITICAL ERROR in admin/approve:', error);
    res.status(500).json({
      error: 'Interner Server Fehler',
      details: error.message,
    });
  }
});

// Benutzer Zugriffsrechte setzen (Honor / Analytics / Overview)
app.post('/api/admin/users/access', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId, canAccessHonor, canAccessAnalytics, canAccessOverview } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId wird benötigt' });
    }

    const stmt = db.prepare(`
      UPDATE users
      SET
        can_access_honor = ?,
        can_access_analytics = ?,
        can_access_overview = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      canAccessHonor ? 1 : 0,
      canAccessAnalytics ? 1 : 0,
      canAccessOverview ? 1 : 0,
      userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      success: true,
      message: 'Zugriffsrechte aktualisiert',
      changes: result.changes,
    });
  } catch (error) {
    console.error('💥 Error updating user access:', error);
    res.status(500).json({ error: 'Zugriffsrechte konnten nicht aktualisiert werden.' });
  }
});

// Benutzer löschen (nicht Admin, nicht eigener Account)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;

    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Admin-Konten können nicht gelöscht werden.' });
    }

    const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteStmt.run(userId);

    res.json({
      success: true,
      message: `Benutzer "${user.username}" wurde dauerhaft gelöscht.`,
      changes: result.changes,
    });
  } catch (error) {
    console.error('💥 Error deleting user:', error);
    res.status(500).json({ error: 'Benutzer konnte nicht gelöscht werden.' });
  }
});

// ==================== OVERVIEW ENDPOINTS ====================

app.get('/overview/files-data', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM overview_files ORDER BY fileOrder, uploadDate');
    const rows = stmt.all();

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (err) {
    console.error('Error fetching overview files:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/overview/upload', overviewUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const parsedData = await parseFile(req.file.path, req.file.originalname);

    const newFile = {
      id: Date.now().toString(),
      name: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      headers: JSON.stringify(parsedData.headers),
      data: JSON.stringify(parsedData.data),
    };

    const stmt = db.prepare(
      `
      INSERT INTO overview_files (id, name, filename, path, size, uploadDate, headers, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    stmt.run(
      newFile.id,
      newFile.name,
      newFile.filename,
      newFile.path,
      newFile.size,
      newFile.uploadDate,
      newFile.headers,
      newFile.data
    );

    res.json({
      message: 'Datei erfolgreich hochgeladen und verarbeitet',
      file: {
        id: newFile.id,
        name: newFile.name,
        filename: newFile.filename,
        path: newFile.path,
        size: newFile.size,
        uploadDate: newFile.uploadDate,
        headers: parsedData.headers,
        data: parsedData.data,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen: ' + error.message });
  }
});

app.delete('/overview/files/:id', (req, res) => {
  try {
    const fileId = req.params.id;

    const stmt = db.prepare('SELECT * FROM overview_files WHERE id = ?');
    const file = stmt.get(fileId);

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const deleteStmt = db.prepare('DELETE FROM overview_files WHERE id = ?');
    deleteStmt.run(fileId);

    res.json({ message: 'Datei erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.post('/overview/files/reorder', (req, res) => {
  try {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Ungültige Reihenfolge' });
    }

    const updateStmt = db.prepare('UPDATE overview_files SET fileOrder = ? WHERE id = ?');

    order.forEach((id, index) => {
      updateStmt.run(index, id);
    });

    res.json({ message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
  }
});

// ==================== HONOR ENDPOINTS ====================

app.get('/honor/files-data', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM honor_files ORDER BY fileOrder, uploadDate');
    const rows = stmt.all();

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (err) {
    console.error('Error fetching honor files:', err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/honor/upload', honorUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const parsedData = await parseFile(req.file.path, req.file.originalname);

    const newFile = {
      id: Date.now().toString(),
      name: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      uploadDate: new Date().toISOString(),
      headers: JSON.stringify(parsedData.headers),
      data: JSON.stringify(parsedData.data),
    };

    const stmt = db.prepare(
      `
      INSERT INTO honor_files (id, name, filename, path, size, uploadDate, headers, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    );

    stmt.run(
      newFile.id,
      newFile.name,
      newFile.filename,
      newFile.path,
      newFile.size,
      newFile.uploadDate,
      newFile.headers,
      newFile.data
    );

    res.json({
      message: 'Datei erfolgreich hochgeladen und verarbeitet',
      file: {
        id: newFile.id,
        name: newFile.name,
        filename: newFile.filename,
        path: newFile.path,
        size: newFile.size,
        uploadDate: newFile.uploadDate,
        headers: parsedData.headers,
        data: parsedData.data,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen: ' + error.message });
  }
});

app.delete('/honor/files/:id', (req, res) => {
  try {
    const fileId = req.params.id;

    const stmt = db.prepare('SELECT * FROM honor_files WHERE id = ?');
    const file = stmt.get(fileId);

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const deleteStmt = db.prepare('DELETE FROM honor_files WHERE id = ?');
    deleteStmt.run(fileId);

    res.json({ message: 'Datei erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.post('/honor/files/reorder', (req, res) => {
  try {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Ungültige Reihenfolge' });
    }

    const updateStmt = db.prepare('UPDATE honor_files SET fileOrder = ? WHERE id = ?');

    order.forEach((id, index) => {
      updateStmt.run(index, id);
    });

    res.json({ message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'Backend läuft',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: dbPath,
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'KD3619 Backend API',
    version: '1.3.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/validate',
        'POST /api/auth/check-gov-id',
      ],
      admin: [
        'GET /api/admin/users',
        'POST /api/admin/users/approve',
        'POST /api/admin/users/access',
        'DELETE /api/admin/users/:id',
        'POST /api/admin/create-admin',
      ],
      debug: ['GET /api/debug/users'],
      overview: [
        'GET /overview/files-data',
        'POST /overview/upload',
        'DELETE /overview/files/:id',
        'POST /overview/files/reorder',
      ],
      honor: [
        'GET /honor/files-data',
        'POST /honor/upload',
        'DELETE /honor/files/:id',
        'POST /honor/files/reorder',
      ],
      health: 'GET /health',
    },
  });
});

// Server starten
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server läuft auf Port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Datenbank: ${dbPath}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
});
