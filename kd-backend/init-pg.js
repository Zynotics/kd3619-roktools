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
      can_access_honor BOOLEAN DEFAULT FALSE,
      can_access_analytics BOOLEAN DEFAULT FALSE,
      can_access_overview BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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

  // KINGDOMS – neue Tabelle
  await query(`
    CREATE TABLE IF NOT EXISTS kingdoms (
      id TEXT PRIMARY KEY,                 -- z.B. 'kdm-default', später 'kdm-<irgendwas>'
      display_name TEXT NOT NULL,          -- z.B. 'Default Kingdom' oder 'KD 3619 - Vikings'
      slug TEXT UNIQUE,                    -- z.B. 'default-kingdom', später 'kd-3619'
      rok_identifier TEXT,                 -- z.B. '3619'
      status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'trial' | 'suspended' | 'archived'
      plan TEXT NOT NULL DEFAULT 'free',       -- 'free' | 'pro' | 'enterprise'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
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

// wenn direkt gestartet (npm start ruft das vor server.js auf)
if (require.main === module) {
  init()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ init-pg failed:', err);
      process.exit(1);
    });
}

module.exports = { init };
