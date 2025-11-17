// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS für Production und Development
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-frontend-app.onrender.com' // Hier später Ihre Frontend-URL eintragen
];

app.use(cors({
  origin: function (origin, callback) {
    // Erlaube requests ohne origin (wie mobile apps oder curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Static files für Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 📂 Upload-Ordner erstellen
const uploadsOverviewDir = path.join(__dirname, 'uploads', 'overview');
const uploadsHonorDir = path.join(__dirname, 'uploads', 'honor');

[uploadsOverviewDir, uploadsHonorDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// SQLite Datenbank Setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'uploads.db') // Render.com verwendet /tmp für persistente Daten
  : path.join(__dirname, 'uploads.db');

console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath);

// Tabellen erstellen falls nicht vorhanden
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS overview_files (
    id TEXT PRIMARY KEY,
    name TEXT,
    filename TEXT,
    path TEXT,
    size INTEGER,
    uploadDate TEXT,
    fileOrder INTEGER DEFAULT 0,
    headers TEXT,
    data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS honor_files (
    id TEXT PRIMARY KEY,
    name TEXT,
    filename TEXT,
    path TEXT,
    size INTEGER,
    uploadDate TEXT,
    fileOrder INTEGER DEFAULT 0,
    headers TEXT,
    data TEXT
  )`);
});

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

// ==================== OVERVIEW ENDPOINTS ====================

app.get('/overview/files-data', (req, res) => {
  db.all("SELECT * FROM overview_files ORDER BY fileOrder, uploadDate", (err, rows) => {
    if (err) {
      console.error('Error fetching overview files:', err);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }
    
    const files = rows.map(row => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]')
    }));
    
    res.json(files);
  });
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

    db.run(
      `INSERT INTO overview_files (id, name, filename, path, size, uploadDate, headers, data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newFile.id, newFile.name, newFile.filename, newFile.path, newFile.size, newFile.uploadDate, newFile.headers, newFile.data],
      (err) => {
        if (err) {
          console.error('Error saving to database:', err);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
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
      }
    );
    
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
    
    db.get("SELECT * FROM overview_files WHERE id = ?", [fileId], (err, file) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      db.run("DELETE FROM overview_files WHERE id = ?", [fileId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Datei erfolgreich gelöscht' });
      });
    });
    
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

    const updatePromises = order.map((id, index) => {
      return new Promise((resolve, reject) => {
        db.run("UPDATE overview_files SET fileOrder = ? WHERE id = ?", [index, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    Promise.all(updatePromises)
      .then(() => res.json({ message: 'Reihenfolge aktualisiert' }))
      .catch(err => {
        console.error('Reorder error:', err);
        res.status(500).json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
      });
    
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
  }
});

// ==================== HONOR ENDPOINTS ====================

app.get('/honor/files-data', (req, res) => {
  db.all("SELECT * FROM honor_files ORDER BY fileOrder, uploadDate", (err, rows) => {
    if (err) {
      console.error('Error fetching honor files:', err);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }
    
    const files = rows.map(row => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]')
    }));
    
    res.json(files);
  });
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

    db.run(
      `INSERT INTO honor_files (id, name, filename, path, size, uploadDate, headers, data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newFile.id, newFile.name, newFile.filename, newFile.path, newFile.size, newFile.uploadDate, newFile.headers, newFile.data],
      (err) => {
        if (err) {
          console.error('Error saving to database:', err);
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
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
      }
    );
    
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
    
    db.get("SELECT * FROM honor_files WHERE id = ?", [fileId], (err, file) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!file) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      db.run("DELETE FROM honor_files WHERE id = ?", [fileId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Datei erfolgreich gelöscht' });
      });
    });
    
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

    const updatePromises = order.map((id, index) => {
      return new Promise((resolve, reject) => {
        db.run("UPDATE honor_files SET fileOrder = ? WHERE id = ?", [index, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    Promise.all(updatePromises)
      .then(() => res.json({ message: 'Reihenfolge aktualisiert' }))
      .catch(err => {
        console.error('Reorder error:', err);
        res.status(500).json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
      });
    
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
  console.log(`📁 Overview Upload-Verzeichnis: ${uploadsOverviewDir}`);
  console.log(`📁 Honor Upload-Verzeichnis: ${uploadsHonorDir}`);
});