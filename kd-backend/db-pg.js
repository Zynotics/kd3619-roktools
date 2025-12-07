// db-pg.js – kleine Wrapper-Schicht für Postgres (VOLLSTÄNDIGER CODE)

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render-Postgres braucht meist SSL:
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Allgemeine Query-Funktion
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// Kleine Helper für "get" und "all" ähnlich better-sqlite3
async function get(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function all(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

// ------------------------------------------------
// NEUE FUNKTIONEN FÜR KINGDOM & R5 ZUWEISUNG
// ------------------------------------------------

/**
 * Weist einem Königreich einen R5-Benutzer zu.
 */
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

/**
 * Aktualisiert den Status eines Königreichs.
 */
async function updateKingdomStatus(kingdomId, status) {
  const sql = `
    UPDATE kingdoms 
    SET status = $1, updated_at = NOW()
    WHERE id = $2;
  `;
  await query(sql, [status, kingdomId]);
}

/**
 * Löscht ein Königreich.
 */
async function deleteKingdom(kingdomId) {
  await query(`
    UPDATE users 
    SET role = 'user', kingdom_id = NULL
    WHERE kingdom_id = $1
  `, [kingdomId]);

  await query(`DELETE FROM overview_files WHERE kingdom_id = $1`, [kingdomId]);
  await query(`DELETE FROM honor_files WHERE kingdom_id = $1`, [kingdomId]);
  
  // Auch KvK Events löschen
  await query(`DELETE FROM kvk_events WHERE kingdom_id = $1`, [kingdomId]);

  const res = await query(`DELETE FROM kingdoms WHERE id = $1`, [kingdomId]);
  return res.rowCount;
}

// ------------------------------------------------
// KVK EVENT FUNKTIONEN (NEU)
// ------------------------------------------------

// Tabelle initialisieren (wird beim Start ausgeführt, falls nicht existiert)
async function initKvkTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS kvk_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kingdom_id TEXT NOT NULL,
      start_file_id TEXT,
      end_file_id TEXT,
      honor_file_ids TEXT, 
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
initKvkTable().catch(e => console.error("Fehler beim Erstellen der kvk_events Tabelle:", e));

/**
 * Neues KvK Event erstellen
 */
async function createKvkEvent(event) {
  const sql = `
    INSERT INTO kvk_events (id, name, kingdom_id, start_file_id, end_file_id, honor_file_ids, is_public, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const honorFilesStr = JSON.stringify(event.honorFileIds || []);
  const res = await query(sql, [
    event.id, 
    event.name, 
    event.kingdomId,
    event.startFileId, 
    event.endFileId, 
    honorFilesStr, 
    !!event.isPublic, 
    event.createdAt || new Date()
  ]);
  return res.rows[0];
}

/**
 * Alle KvK Events eines Königreichs holen
 */
async function getKvkEvents(kingdomId) {
  const sql = `SELECT * FROM kvk_events WHERE kingdom_id = $1 ORDER BY created_at DESC`;
  const rows = await all(sql, [kingdomId]);
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    kingdomId: row.kingdom_id,
    startFileId: row.start_file_id,
    endFileId: row.end_file_id,
    honorFileIds: JSON.parse(row.honor_file_ids || '[]'),
    isPublic: row.is_public,
    createdAt: row.created_at
  }));
}

/**
 * Einzelnes KvK Event holen
 */
async function getKvkEventById(id) {
  const row = await get('SELECT * FROM kvk_events WHERE id = $1', [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    kingdomId: row.kingdom_id,
    startFileId: row.start_file_id,
    endFileId: row.end_file_id,
    honorFileIds: JSON.parse(row.honor_file_ids || '[]'),
    isPublic: row.is_public,
    createdAt: row.created_at
  };
}

/**
 * KvK Event aktualisieren
 */
async function updateKvkEvent(id, data) {
  const sql = `
    UPDATE kvk_events
    SET name = $1, start_file_id = $2, end_file_id = $3, honor_file_ids = $4, is_public = $5
    WHERE id = $6
    RETURNING *
  `;
  const honorFilesStr = JSON.stringify(data.honorFileIds || []);
  const res = await query(sql, [
    data.name, 
    data.startFileId, 
    data.endFileId, 
    honorFilesStr, 
    !!data.isPublic, 
    id
  ]);
  return res.rows[0];
}

/**
 * KvK Event löschen
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
  // Neue Exporte
  createKvkEvent,
  getKvkEvents,
  getKvkEventById,
  updateKvkEvent,
  deleteKvkEvent
};