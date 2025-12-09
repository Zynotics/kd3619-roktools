// db-pg.js – Wrapper für PostgreSQL (KvK Manager: Modular Fights & Honor Range)

const { Pool } = require('pg');

// Warnung, falls keine DB-URL gesetzt ist (für lokale Tests ohne Env)
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  WARNUNG: DATABASE_URL ist nicht gesetzt. DB-Operationen werden fehlschlagen.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL ist für Render.com/Heroku oft notwendig (in Production 'true', lokal oft 'false')
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Führt eine SQL-Query aus
 */
async function query(text, params = []) {
  if (!process.env.DATABASE_URL) throw new Error("DB Config missing");
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

/**
 * Hilfsfunktion: Holt genau EINE Zeile
 */
async function get(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/**
 * Hilfsfunktion: Holt ALLE Zeilen
 */
async function all(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

// ------------------------------------------------
// BENUTZER & KINGDOM VERWALTUNG
// ------------------------------------------------

async function assignR5(userId, kingdomId) {
  const userSql = `
    UPDATE users 
    SET role = 'r5', kingdom_id = $1
    WHERE id = $2
    RETURNING *;
  `;
  const userRes = await query(userSql, [kingdomId, userId]);

  if (userRes.rowCount === 0) {
    throw new Error('User not found or role update failed');
  }

  const kingdomSql = `
    UPDATE kingdoms
    SET owner_user_id = $1, updated_at = NOW()
    WHERE id = $2;
  `;
  await query(kingdomSql, [userId, kingdomId]);
}

async function updateKingdomStatus(kingdomId, status) {
  const sql = `
    UPDATE kingdoms 
    SET status = $1, updated_at = NOW()
    WHERE id = $2;
  `;
  await query(sql, [status, kingdomId]);
}

async function deleteKingdom(kingdomId) {
  // 1. User resetten
  await query(`
    UPDATE users 
    SET role = 'user', kingdom_id = NULL
    WHERE kingdom_id = $1
  `, [kingdomId]);

  // 2. Dateien löschen
  await query(`DELETE FROM overview_files WHERE kingdom_id = $1`, [kingdomId]);
  await query(`DELETE FROM honor_files WHERE kingdom_id = $1`, [kingdomId]);
  await query(`DELETE FROM activity_files WHERE kingdom_id = $1`, [kingdomId]);
  
  // 3. Events löschen
  await query(`DELETE FROM kvk_events WHERE kingdom_id = $1`, [kingdomId]);

  // 4. Kingdom löschen
  const res = await query(`DELETE FROM kingdoms WHERE id = $1`, [kingdomId]);
  return res.rowCount;
}

// ------------------------------------------------
// KVK EVENT MANAGER (UPDATED FOR MODULAR & RANGE)
// ------------------------------------------------

/**
 * Initialisiert die Tabelle für KvK Events und führt Migrationen durch.
 * Wird beim Server-Start aufgerufen.
 */
async function initKvkTable() {
  try {
    // 1. Basistabelle erstellen (falls nicht vorhanden)
    await query(`
      CREATE TABLE IF NOT EXISTS kvk_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kingdom_id TEXT NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 2. Migration: Spalten hinzufügen, falls sie noch nicht existieren
    // fights: JSON-Array der Kampfphasen
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS fights TEXT`);
    
    // honor_start_file_id / honor_end_file_id: Statt alter Liste nun Start/Ende
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS honor_start_file_id TEXT`);
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS honor_end_file_id TEXT`);

    // Alte Spalten (start_file_id, end_file_id) könnten hier theoretisch gelöscht werden,
    // aber wir lassen sie zur Sicherheit für Legacy-Zwecke drin oder ignorieren sie einfach.

    console.log("✅ Postgres: kvk_events Tabelle geprüft/aktualisiert.");
  } catch (e) {
    console.error("⚠️  Fehler beim Initialisieren der kvk_events Tabelle:", e.message);
  }
}

// Init sofort ausführen, wenn Verbindung da ist
if (process.env.DATABASE_URL) {
    initKvkTable();
}

/**
 * Erstellt ein neues KvK Event
 */
async function createKvkEvent(event) {
  const sql = `
    INSERT INTO kvk_events (
      id, 
      name, 
      kingdom_id, 
      fights, 
      honor_start_file_id, 
      honor_end_file_id, 
      is_public, 
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  // Arrays/Objekte als JSON-String speichern
  const fightsStr = JSON.stringify(event.fights || []);

  const res = await query(sql, [
    event.id, 
    event.name, 
    event.kingdomId,
    fightsStr,
    event.honorStartFileId || null,
    event.honorEndFileId || null,
    !!event.isPublic, 
    event.createdAt || new Date()
  ]);
  return res.rows[0];
}

/**
 * Holt alle KvK Events eines Königreichs
 */
async function getKvkEvents(kingdomId) {
  const sql = `SELECT * FROM kvk_events WHERE kingdom_id = $1 ORDER BY created_at DESC`;
  const rows = await all(sql, [kingdomId]);
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    kingdomId: row.kingdom_id,
    
    // JSON parsen
    fights: JSON.parse(row.fights || '[]'),
    
    // CamelCase Mapping
    honorStartFileId: row.honor_start_file_id,
    honorEndFileId: row.honor_end_file_id,
    
    isPublic: row.is_public,
    createdAt: row.created_at
  }));
}

/**
 * Holt ein einzelnes Event anhand der ID
 */
async function getKvkEventById(id) {
  const row = await get('SELECT * FROM kvk_events WHERE id = $1', [id]);
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    kingdomId: row.kingdom_id,
    fights: JSON.parse(row.fights || '[]'),
    honorStartFileId: row.honor_start_file_id,
    honorEndFileId: row.honor_end_file_id,
    isPublic: row.is_public,
    createdAt: row.created_at
  };
}

/**
 * Aktualisiert ein KvK Event
 */
async function updateKvkEvent(id, data) {
  const sql = `
    UPDATE kvk_events
    SET name = $1, 
        fights = $2, 
        honor_start_file_id = $3, 
        honor_end_file_id = $4, 
        is_public = $5
    WHERE id = $6
    RETURNING *
  `;
  
  const fightsStr = JSON.stringify(data.fights || []);

  const res = await query(sql, [
    data.name, 
    fightsStr,
    data.honorStartFileId || null,
    data.honorEndFileId || null,
    !!data.isPublic, 
    id
  ]);
  return res.rows[0];
}

/**
 * Löscht ein KvK Event
 */
async function deleteKvkEvent(id) {
  await query('DELETE FROM kvk_events WHERE id = $1', [id]);
}

module.exports = {
  query,
  get,
  all,
  assignR5,
  updateKingdomStatus,
  deleteKingdom,
  // KvK Exports
  createKvkEvent,
  getKvkEvents,
  getKvkEventById,
  updateKvkEvent,
  deleteKvkEvent
};