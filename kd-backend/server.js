// server.js - ERWEITERT mit Authentifizierung
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

// CORS für Production und Development - KORRIGIERTE VERSION
const allowedOrigins = [
  'http://localhost:3000',
  'https://kd3619-frontend.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle Preflight Requests - DIESE ZEILE HINZUFÜGEN
app.options('*', cors()); // Enable pre-flight for all routes

app.use(express.json());

// 📂 Upload-Ordner erstellen
const uploadsOverviewDir = path.join(__dirname, 'uploads', 'overview');
const uploadsHonorDir = path.join(__dirname, 'uploads', 'honor');

[uploadsOverviewDir, uploadsHonorDir].forEach(dir => {
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

// NEUE TABELLEN FÜR AUTHENTIFIZIERUNG
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Admin-Benutzer erstellen falls nicht vorhanden
const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
try {
  const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO users (id, email, username, password_hash, is_approved, role) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAdmin.run(
    'admin-001',
    'admin@kd3619.com',
    'Stadmin',
    adminPasswordHash,
    true,
    'admin'
  );
  console.log('✅ Admin user created/verified');
} catch (error) {
  console.log('ℹ️ Admin user already exists');
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

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Hilfsfunktion zum Parsen von Zahlen mit deutschen Format (1.000,00)
function parseGermanNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Hilfsfunktion zum Finden von Spalten-Index
function findColumnIndex(headers, possibleNames) {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  for (const name of possibleNames) {
    const index = lowerHeaders.indexOf(name.toLowerCase());
    if (index !== -1) return index;
  }
  return undefined;
}

// Datei parsen (Excel oder CSV)
function parseFile(filePath, originalName) {
  return new Promise((resolve, reject) => {
    try {
      if (filePath.endsWith('.csv')) {
        const csvData = fs.readFileSync(filePath, 'utf8');
        const lines = csvData.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
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
        
        const headers = jsonData[0].map(h => h ? h.toString() : '');
        const data = jsonData.slice(1).filter(row => row.length > 0);
        
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
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// Multer Konfiguration für Honor
const honorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsHonorDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const overviewUpload = multer({ 
  storage: overviewStorage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const honorUpload = multer({ 
  storage: honorStorage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ==================== AUTH ENDPOINTS ====================

// Registrierung
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, Benutzername und Passwort werden benötigt' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    // Prüfen ob Benutzer bereits existiert
    const existingUser = db.prepare("SELECT * FROM users WHERE email = ? OR username = ?").get(email, username);
    if (existingUser) {
      return res.status(400).json({ error: 'Benutzer mit dieser Email oder diesem Benutzernamen existiert bereits' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, password_hash, is_approved, role) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(userId, email, username, passwordHash, false, 'user');
    
    res.json({ 
      message: 'Registrierung erfolgreich. Bitte warten Sie auf die Freigabe durch einen Administrator.',
      user: {
        id: userId,
        email,
        username,
        isApproved: false,
        role: 'user'
      }
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

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        isApproved: user.is_approved 
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isApproved: user.is_approved,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Token Validierung
app.get('/api/auth/validate', authenticateToken, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    isApproved: user.is_approved,
    role: user.role
  });
});

// ==================== ADMIN ENDPOINTS ====================

// Alle Benutzer abrufen (nur Admin)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stmt = db.prepare("SELECT id, email, username, is_approved, role, created_at FROM users ORDER BY created_at DESC");
    const users = stmt.all();
    
    res.json(users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      isApproved: user.is_approved,
      role: user.role,
      createdAt: user.created_at
    })));
    
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

// Benutzer freigeben/sperren (nur Admin)
app.post('/api/admin/users/approve', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { userId, approved } = req.body;
    
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Ungültiger approved Wert' });
    }

    const stmt = db.prepare("UPDATE users SET is_approved = ? WHERE id = ?");
    const result = stmt.run(approved, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({ 
      message: `Benutzer erfolgreich ${approved ? 'freigegeben' : 'gesperrt'}` 
    });
    
  } catch (error) {
    console.error('Error updating user approval:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Benutzerfreigabe' });
  }
});

// ==================== OVERVIEW ENDPOINTS ====================

app.get('/overview/files-data', (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM overview_files ORDER BY fileOrder, uploadDate");
    const rows = stmt.all();
    
    const files = rows.map(row => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]')
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
      data: JSON.stringify(parsedData.data)
    };

    const stmt = db.prepare(`
      INSERT INTO overview_files (id, name, filename, path, size, uploadDate, headers, data) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      newFile.id, newFile.name, newFile.filename, newFile.path, 
      newFile.size, newFile.uploadDate, newFile.headers, newFile.data
    );
    
    console.log('Overview file uploaded and parsed:', newFile.name);
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
        data: parsedData.data
      }
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
    
    const stmt = db.prepare("SELECT * FROM overview_files WHERE id = ?");
    const file = stmt.get(fileId);
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const deleteStmt = db.prepare("DELETE FROM overview_files WHERE id = ?");
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

    const updateStmt = db.prepare("UPDATE overview_files SET fileOrder = ? WHERE id = ?");
    
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
    const stmt = db.prepare("SELECT * FROM honor_files ORDER BY fileOrder, uploadDate");
    const rows = stmt.all();
    
    const files = rows.map(row => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]')
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
      data: JSON.stringify(parsedData.data)
    };

    const stmt = db.prepare(`
      INSERT INTO honor_files (id, name, filename, path, size, uploadDate, headers, data) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      newFile.id, newFile.name, newFile.filename, newFile.path, 
      newFile.size, newFile.uploadDate, newFile.headers, newFile.data
    );
    
    console.log('Honor file uploaded and parsed:', newFile.name);
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
        data: parsedData.data
      }
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
    
    const stmt = db.prepare("SELECT * FROM honor_files WHERE id = ?");
    const file = stmt.get(fileId);
    
    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const deleteStmt = db.prepare("DELETE FROM honor_files WHERE id = ?");
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

    const updateStmt = db.prepare("UPDATE honor_files SET fileOrder = ? WHERE id = ?");
    
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
    database: dbPath
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'KD3619 Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/validate'],
      admin: ['GET /api/admin/users', 'POST /api/admin/users/approve'],
      overview: ['GET /overview/files-data', 'POST /overview/upload', 'DELETE /overview/files/:id', 'POST /overview/files/reorder'],
      honor: ['GET /honor/files-data', 'POST /honor/upload', 'DELETE /honor/files/:id', 'POST /honor/files/reorder'],
      health: 'GET /health'
    }
  });
});

// Server starten
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server läuft auf Port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Datenbank: ${dbPath}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
});