// init-pg.js – Postgres-Schema für Users, Files + Kingdoms

const { query } = require('./db-pg');

async function init() {
  console.log('🔧 Initializing Postgres schema...');

  // USERS
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_approved BOOLEAN DEFAULT FALSE,
      role TEXT DEFAULT 'user',
      governor_id TEXT,
      can_access_honor BOOLEESCH DEFAULT FALSE,
      can_access_analytics BOOLEESCH DEFAULT FALSE,
      can_access_overview BOOLEESCH DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 👑 NEU: kingdom_id zur users-Tabelle hinzufügen
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS kingdom_id TEXT
      REFERENCES kingdoms(id);
  `);

  // OVERVIEW FILES
  await query(`
    CREATE TABLE IF NOT EXISTS overview_files (
      id TEXT PRIMARY KEY,
      name TEXT,
      filename TEXT,
      path TEXT,
      size BIGINT,
      uploadDate TIMESTAMPTZ,
      fileOrder INTEGER DEFAULT 0,
      headers TEXT,
      data TEXT,
      kingdom_id TEXT,
      uploaded_by_user_id TEXT
    );
  `);

  // HONOR FILES
  await query(`
    CREATE TABLE IF NOT EXISTS honor_files (
      id TEXT PRIMARY KEY,
      name TEXT,
      filename TEXT,
      path TEXT,
      size BIGINT,
      uploadDate TIMESTAMPTZ,
      fileOrder INTEGER DEFAULT 0,
      headers TEXT,
      data TEXT,
      kingdom_id TEXT,
      uploaded_by_user_id TEXT
    );
  `);

  // KINGDOMS
  await query(`
    CREATE TABLE IF NOT EXISTS kingdoms (
      id TEXT PRIMARY KEY,
      display_name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      rok_identifier TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      plan TEXT DEFAULT 'free',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 👑 NEU: Spalte owner_user_id zur kingdoms-Tabelle hinzufügen
  await query(`
    ALTER TABLE kingdoms
      ADD COLUMN IF NOT EXISTS owner_user_id TEXT
      REFERENCES users(id);
  `);

  // 🔧 Falls die Files-Tabellen schon existierten: Spalten sicherheitshalber nachziehen
  await query(`
    ALTER TABLE overview_files
      ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
  `);

  await query(`
    ALTER TABLE honor_files
      ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
  `);

  // 🏰 Default-Kingdom anlegen (für alle bestehenden Daten)
  await query(`
    INSERT INTO kingdoms (id, display_name, slug, rok_identifier, status, plan)
    VALUES ('kdm-default', 'Default Kingdom', 'default-kingdom', NULL, 'active', 'free')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 📎 Alle bestehenden Files dem Default-Kingdom zuordnen (falls noch kein kingdom_id)
  await query(`
    UPDATE overview_files
    SET kingdom_id = 'kdm-default'
    WHERE kingdom_id IS NULL;
  `);

  await query(`
    UPDATE honor_files
    SET kingdom_id = 'kdm-default'
    WHERE kingdom_id IS NULL;
  `);

  console.log('✅ Postgres schema initialized (users, files, kingdoms + default kingdom)');
}

init().catch((err) => {
  console.error('❌ Error initializing Postgres schema:', err);
  process.exit(1);
});