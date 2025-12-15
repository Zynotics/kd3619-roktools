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

  // 👑 NEU: kingdom_id zur users-Tabelle hinzufügen
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS kingdom_id TEXT
      REFERENCES kingdoms(id);
  `);

  // 📝 NEU: Granulare File Management Rechte zur users-Tabelle hinzufügen
  // (Hier fügen wir can_manage_activity_files hinzu)
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS can_manage_overview_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_honor_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_activity_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_analytics_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_access_kvk_manager BOOLEAN DEFAULT FALSE;
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

  // 🆕 ACTIVITY FILES (Neue Tabelle)
  await query(`
    CREATE TABLE IF NOT EXISTS activity_files (
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

  // 📅 KvK Events (wird zusätzlich in db-pg abgesichert)
  await query(`
    CREATE TABLE IF NOT EXISTS kvk_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kingdom_id TEXT NOT NULL,
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      fights TEXT,
      event_start_file_id TEXT,
      honor_start_file_id TEXT,
      honor_end_file_id TEXT,
      dkp_formula TEXT,
      goals_formula TEXT
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

  // 🏰 Default-Kingdom anlegen (für alle bestehenden Daten)
  await query(`
    INSERT INTO kingdoms (id, display_name, slug, rok_identifier, status, plan)
    VALUES ('kdm-default', 'Default Kingdom', 'default-kingdom', NULL, 'active', 'free')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 🔧 Falls die Files-Tabellen schon existierten: Spalten sicherheitshalber nachziehen
  // (Dies gilt auch für die neue activity_files Tabelle, falls sie manuell erstellt wurde, schadet aber nicht)
  const tables = ['overview_files', 'honor_files', 'activity_files'];
  for (const table of tables) {
      await query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
          ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
      `);
  }

  // ✨ Datenbank-Guardrails: kingdom_id Pflichtfeld + FK auf kingdoms
  for (const table of tables) {
      // Fehlende kingdom_id mit Default-Kingdom auffüllen
      await query(`UPDATE ${table} SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;`);
      await query(`ALTER TABLE ${table} ALTER COLUMN kingdom_id SET NOT NULL;`);
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = '${table}_kingdom_fk'
              AND table_name = '${table}'
          ) THEN
            ALTER TABLE ${table}
              ADD CONSTRAINT ${table}_kingdom_fk FOREIGN KEY (kingdom_id)
              REFERENCES kingdoms(id) ON DELETE CASCADE;
          END IF;
        END$$;
      `);
  }

  // KvK Events: kingdom_id absichern
  await query(`UPDATE kvk_events SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;`);
  await query(`ALTER TABLE kvk_events ALTER COLUMN kingdom_id SET NOT NULL;`);
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

  // 📎 Alle bestehenden Files dem Default-Kingdom zuordnen (falls noch kein kingdom_id)
  await query(`
    UPDATE overview_files SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;
  `);
  await query(`
    UPDATE honor_files SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;
  `);
  // (Activity files sind neu, daher kein Update nötig, aber der Vollständigkeit halber gut zu wissen)

  console.log('✅ Postgres schema initialized (users, files [overview, honor, activity], kingdoms)');
}

init().catch((err) => {
  console.error('❌ Error initializing Postgres schema:', err);
  process.exit(1);
});
