// kd-backend/init-db.js
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'uploads.db');
console.log('Initializing database at:', dbPath);

const db = new Database(dbPath);

// Tabellen erstellen
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

console.log('✅ Database tables created successfully');
db.close();