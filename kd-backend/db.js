// db.js
// Kleine SQLite-Datenbank für deine Uploads

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Datenbank-Datei heißt "data.db" und liegt im selben Ordner wie server.js & db.js
const dbPath = path.join(__dirname, 'data.db');

// Verbindung öffnen (Datei wird automatisch erstellt, wenn sie nicht existiert)
const db = new sqlite3.Database(dbPath);

// Tabelle "files" anlegen, falls sie noch nicht existiert
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      uploadedAt TEXT NOT NULL
    )
  `);
});

/**
 * Einen neuen Datei-Eintrag speichern
 * meta = { id, originalName, storedName, uploadedAt }
 */
function addFile(meta, callback) {
  const sql = `
    INSERT INTO files (id, originalName, storedName, uploadedAt)
    VALUES (?, ?, ?, ?)
  `;
  db.run(
    sql,
    [meta.id, meta.originalName, meta.storedName, meta.uploadedAt],
    function (err) {
      if (callback) callback(err);
    }
  );
}

/**
 * Alle Datei-Einträge aus der Datenbank holen
 */
function getFiles(callback) {
  db.all(
    `SELECT id, originalName, storedName, uploadedAt FROM files ORDER BY uploadedAt DESC`,
    (err, rows) => {
      callback(err, rows);
    }
  );
}

/**
 * Einen einzelnen Datei-Eintrag anhand der ID holen
 */
function getFileById(id, callback) {
  db.get(
    `SELECT id, originalName, storedName, uploadedAt FROM files WHERE id = ?`,
    [id],
    (err, row) => {
      callback(err, row);
    }
  );
}

module.exports = {
  addFile,
  getFiles,
  getFileById,
};
