// db.js
// Kleine SQLite-Datenbank für deine Uploads und KvK Events

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Datenbank-Datei heißt "data.db" und liegt im selben Ordner wie server.js & db.js
const dbPath = path.join(__dirname, 'data.db');

// Verbindung öffnen (Datei wird automatisch erstellt, wenn sie nicht existiert)
const db = new sqlite3.Database(dbPath);

// Tabellen anlegen, falls sie noch nicht existieren
db.serialize(() => {
  // Bestehende Tabelle für Dateien
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      uploadedAt TEXT NOT NULL
    )
  `);

  // NEUE Tabelle für KvK Events (angepasst für das modulare Konzept)
  // 'fights' speichert ein JSON-Array von Kampf-Objekten: [{ id, name, startFileId, endFileId }, ...]
  db.run(`
    CREATE TABLE IF NOT EXISTS kvk_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fights TEXT, 
      honorFileIds TEXT,
      isPublic INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
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

// --- KvK Event Funktionen (Modular Update) ---

/**
 * Neues KvK Event erstellen
 * event = { id, name, fights, honorFileIds, isPublic, createdAt }
 */
function createKvkEvent(event, callback) {
  const sql = `
    INSERT INTO kvk_events (id, name, fights, honorFileIds, isPublic, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  // Arrays als JSON-String speichern
  const fightsStr = JSON.stringify(event.fights || []);
  const honorFilesStr = JSON.stringify(event.honorFileIds || []);
  const isPublicInt = event.isPublic ? 1 : 0;

  db.run(
    sql,
    [event.id, event.name, fightsStr, honorFilesStr, isPublicInt, event.createdAt],
    function (err) {
      if (callback) callback(err);
    }
  );
}

/**
 * Alle KvK Events holen
 */
function getKvkEvents(callback) {
  db.all(
    `SELECT * FROM kvk_events ORDER BY createdAt DESC`,
    (err, rows) => {
      if (err) {
        callback(err, null);
        return;
      }
      // JSON Strings zurück parsen
      const events = rows.map(row => ({
        ...row,
        fights: JSON.parse(row.fights || '[]'),
        honorFileIds: JSON.parse(row.honorFileIds || '[]'),
        isPublic: !!row.isPublic
      }));
      callback(null, events);
    }
  );
}

/**
 * Einzelnes KvK Event anhand der ID holen
 */
function getKvkEventById(id, callback) {
  db.get(
    `SELECT * FROM kvk_events WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        callback(err, null);
        return;
      }
      if (!row) {
        callback(null, null);
        return;
      }
      const event = {
        ...row,
        fights: JSON.parse(row.fights || '[]'),
        honorFileIds: JSON.parse(row.honorFileIds || '[]'),
        isPublic: !!row.isPublic
      };
      callback(null, event);
    }
  );
}

/**
 * KvK Event aktualisieren
 * data kann fights, honorFileIds, name oder isPublic enthalten
 */
function updateKvkEvent(id, data, callback) {
  const sql = `
    UPDATE kvk_events
    SET name = ?, fights = ?, honorFileIds = ?, isPublic = ?
    WHERE id = ?
  `;
  
  const fightsStr = JSON.stringify(data.fights || []);
  const honorFilesStr = JSON.stringify(data.honorFileIds || []);
  const isPublicInt = data.isPublic ? 1 : 0;

  db.run(
    sql,
    [data.name, fightsStr, honorFilesStr, isPublicInt, id],
    function (err) {
      if (callback) callback(err);
    }
  );
}

/**
 * KvK Event löschen
 */
function deleteKvkEvent(id, callback) {
  db.run(
    `DELETE FROM kvk_events WHERE id = ?`,
    [id],
    function (err) {
      if (callback) callback(err);
    }
  );
}

module.exports = {
  addFile,
  getFiles,
  getFileById,
  createKvkEvent,
  getKvkEvents,
  getKvkEventById,
  updateKvkEvent,
  deleteKvkEvent
};