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

async function generateR5Code(durationDays, code) {
  const res = await query(
    `INSERT INTO r5_codes (code, duration_days) VALUES ($1, $2) RETURNING *`,
    [code, durationDays]
  );
  return res.rows[0];
}

async function getR5Codes() {
  return all(
    `SELECT code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active FROM r5_codes ORDER BY created_at DESC`
  );
}

async function getR5Code(code) {
  return get(
    `SELECT code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active FROM r5_codes WHERE code = $1`,
    [code]
  );
}

async function activateR5Code(code, userId, kingdomId) {
  const existing = await getR5Code(code);
  if (!existing) throw new Error('Code nicht gefunden.');
  if (existing.used_by_user_id && existing.used_by_user_id !== userId) {
    throw new Error('Code ist einem anderen Benutzer zugeordnet.');
  }
  if (existing.is_active) throw new Error('Code wurde bereits aktiviert.');

  // Laufzeit an vorhandene Restlaufzeit anhängen (Stacking)
  const now = new Date();
  let baseDate = now;
  const current = await getActiveR5Access(userId);
  if (current && current.expires_at && new Date(current.expires_at) > now) {
    baseDate = new Date(current.expires_at);
  }
  const expiresAt = new Date(baseDate);
  expiresAt.setDate(expiresAt.getDate() + existing.duration_days);

  const res = await query(
    `
      UPDATE r5_codes
      SET used_by_user_id = $1,
          kingdom_id = $2,
          activated_at = NOW(),
          expires_at = $3,
          is_active = TRUE
      WHERE code = $4
      RETURNING code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active
    `,
    [userId, kingdomId, expiresAt, code]
  );

  if (res.rowCount === 0) throw new Error('Aktivierung fehlgeschlagen.');
  return res.rows[0];
}

async function getActiveR5Access(userId) {
  const row = await get(
    `
      SELECT code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active
      FROM r5_codes
      WHERE used_by_user_id = $1 AND is_active = TRUE AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    [userId]
  );
  return row || null;
}

async function assignR5Code(code, userId, kingdomId) {
  const existing = await getR5Code(code);
  if (!existing) throw new Error('Code nicht gefunden.');
  if (existing.is_active) throw new Error('Code wurde bereits aktiviert.');
  if (existing.used_by_user_id && existing.used_by_user_id !== userId) {
    throw new Error('Code ist einem anderen Benutzer zugeordnet.');
  }
  const res = await query(
    `UPDATE r5_codes SET used_by_user_id = $1, kingdom_id = $2 WHERE code = $3 RETURNING code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active`,
    [userId, kingdomId || existing.kingdom_id, code]
  );
  if (res.rowCount === 0) throw new Error('Zuweisung fehlgeschlagen.');
  return res.rows[0];
}

async function deactivateR5Code(code, { clearAssignment = true } = {}) {
  const setClauses = [
    'is_active = FALSE',
    'expires_at = NULL',
    'activated_at = NULL'
  ];

  if (clearAssignment) {
    setClauses.push('used_by_user_id = NULL', 'kingdom_id = NULL');
  }

  const res = await query(
    `UPDATE r5_codes
     SET ${setClauses.join(', ')}
     WHERE code = $1
     RETURNING code, duration_days, created_at, used_by_user_id, kingdom_id, activated_at, expires_at, is_active`,
    [code]
  );

  if (res.rowCount === 0) throw new Error('Deaktivierung fehlgeschlagen.');
  return res.rows[0];
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

    // Start-Snapshot für die Basiswerte
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS event_start_file_id TEXT`);

    // honor_start_file_id / honor_end_file_id: Statt alter Liste nun Start/Ende
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS honor_start_file_id TEXT`);
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS honor_end_file_id TEXT`);

    // DKP Formel (JSON) und Goal-Formel (JSON)
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS dkp_formula TEXT`);
    await query(`ALTER TABLE kvk_events ADD COLUMN IF NOT EXISTS goals_formula TEXT`);

    // Alte Spalten (start_file_id, end_file_id) könnten hier theoretisch gelöscht werden,
    // aber wir lassen sie zur Sicherheit für Legacy-Zwecke drin oder ignorieren sie einfach.

    // Guardrail: kingdom_id absichern (NOT NULL + FK)
    await query(`ALTER TABLE kvk_events ALTER COLUMN kingdom_id SET NOT NULL`);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'kvk_events_kingdom_fk'
            AND table_name = 'kvk_events'
        ) THEN
          ALTER TABLE kvk_events
            ADD CONSTRAINT kvk_events_kingdom_fk FOREIGN KEY (kingdom_id)
            REFERENCES kingdoms(id) ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    console.log("✅ Postgres: kvk_events Tabelle geprüft/aktualisiert.");
  } catch (e) {
    console.error("⚠️  Fehler beim Initialisieren der kvk_events Tabelle:", e.message);
  }
}

async function initR5CodesTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS r5_codes (
        code TEXT PRIMARY KEY,
        duration_days INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        used_by_user_id TEXT,
        kingdom_id TEXT,
        activated_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT FALSE
      )
    `);
    console.log("✅ Postgres: r5_codes Tabelle geprüft/aktualisiert.");
  } catch (e) {
    console.error("⚠️  Fehler beim Initialisieren der r5_codes Tabelle:", e.message);
  }
}

// Init sofort ausführen, wenn Verbindung da ist
if (process.env.DATABASE_URL) {
    initKvkTable();
    initR5CodesTable();
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
      event_start_file_id,
      honor_start_file_id,
      honor_end_file_id,
      dkp_formula,
      goals_formula,
      is_public,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  // Arrays/Objekte als JSON-String speichern
  const fightsStr = JSON.stringify(event.fights || []);
  const dkpFormulaStr = event.dkpFormula ? JSON.stringify(event.dkpFormula) : null;
  const goalsFormulaStr = event.goalsFormula ? JSON.stringify(event.goalsFormula) : null;

  const res = await query(sql, [
    event.id,
    event.name,
    event.kingdomId,
    fightsStr,
    event.eventStartFileId || null,
    event.honorStartFileId || null,
    event.honorEndFileId || null,
    dkpFormulaStr,
    goalsFormulaStr,
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
    dkpFormula: row.dkp_formula ? JSON.parse(row.dkp_formula) : null,
    goalsFormula: row.goals_formula ? JSON.parse(row.goals_formula) : null,

    // CamelCase Mapping
    eventStartFileId: row.event_start_file_id,
    honorStartFileId: row.honor_start_file_id,
    honorEndFileId: row.honor_end_file_id,

    isPublic: row.is_public,
    createdAt: row.created_at
  }));
}

/**
 * Holt alle KvK Events aller Königreiche (für Super-Admins)
 */
async function getAllKvkEvents() {
  const sql = `SELECT * FROM kvk_events ORDER BY created_at DESC`;
  const rows = await all(sql);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    kingdomId: row.kingdom_id,
    fights: JSON.parse(row.fights || '[]'),
    dkpFormula: row.dkp_formula ? JSON.parse(row.dkp_formula) : null,
    goalsFormula: row.goals_formula ? JSON.parse(row.goals_formula) : null,
    eventStartFileId: row.event_start_file_id,
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
    dkpFormula: row.dkp_formula ? JSON.parse(row.dkp_formula) : null,
    goalsFormula: row.goals_formula ? JSON.parse(row.goals_formula) : null,
    eventStartFileId: row.event_start_file_id,
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
        event_start_file_id = $3,
        honor_start_file_id = $4,
        honor_end_file_id = $5,
        dkp_formula = $6,
        goals_formula = $7,
        is_public = $8
    WHERE id = $9
    RETURNING *
  `;

  const fightsStr = JSON.stringify(data.fights || []);
  const dkpFormulaStr = data.dkpFormula ? JSON.stringify(data.dkpFormula) : null;
  const goalsFormulaStr = data.goalsFormula ? JSON.stringify(data.goalsFormula) : null;

  const res = await query(sql, [
    data.name,
    fightsStr,
    data.eventStartFileId || null,
    data.honorStartFileId || null,
    data.honorEndFileId || null,
    dkpFormulaStr,
    goalsFormulaStr,
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
  generateR5Code,
  getR5Codes,
  getR5Code,
  activateR5Code,
  getActiveR5Access,
  assignR5Code,
  deactivateR5Code,
  // KvK Exports
  createKvkEvent,
  getKvkEvents,
  getAllKvkEvents,
  getKvkEventById,
  updateKvkEvent,
  deleteKvkEvent
};
