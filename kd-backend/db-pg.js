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
 * Setzt die Rolle des Benutzers auf 'r5' und weist ihm die kingdom_id zu.
 * Außerdem wird der owner_user_id des Königreichs gesetzt.
 * @param {string} userId - ID des Benutzers, der R5 wird.
 * @param {string} kingdomId - ID des Königreichs.
 */
async function assignR5(userId, kingdomId) {
  // 1. Benutzer-Rolle und Kingdom-Zuweisung aktualisieren
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

  // 2. owner_user_id des Königreichs setzen
  const kingdomSql = `
    UPDATE kingdoms
    SET owner_user_id = $1, updated_at = NOW()
    WHERE id = $2;
  `;
  await query(kingdomSql, [userId, kingdomId]);
}

/**
 * Aktualisiert den Status eines Königreichs ('active' oder 'inactive').
 * @param {string} kingdomId - ID des Königreichs.
 * @param {string} status - Neuer Status ('active' oder 'inactive').
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
 * Löscht ein Königreich, setzt zugehörige Benutzer zurück und löscht Dateien.
 * @param {string} kingdomId - ID des Königreichs.
 */
async function deleteKingdom(kingdomId) {
  // 1. Benutzer zurücksetzen (Rolle auf 'user', kingdom_id auf NULL)
  await query(`
    UPDATE users 
    SET role = 'user', kingdom_id = NULL
    WHERE kingdom_id = $1
  `, [kingdomId]);

  // 2. Zugehörige Dateien löschen
  await query(`DELETE FROM overview_files WHERE kingdom_id = $1`, [kingdomId]);
  await query(`DELETE FROM honor_files WHERE kingdom_id = $1`, [kingdomId]);

  // 3. Königreich löschen
  const res = await query(`DELETE FROM kingdoms WHERE id = $1`, [kingdomId]);
  return res.rowCount;
}


module.exports = {
  query,
  get,
  all,
  // NEUE FUNKTIONEN EXPORTIEREN
  assignR5,
  updateKingdomStatus,
  deleteKingdom,
};