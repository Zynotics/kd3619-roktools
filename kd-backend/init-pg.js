// init-pg.js - Postgres schema for users, files + kingdoms

const { query } = require('./db-pg');

async function init() {
  console.log('Initializing Postgres schema...');

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

  // NEW: kingdom_id on users (add FK later after kingdoms table exists)
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS kingdom_id TEXT;
  `);

  // NEW: granular file permissions on users
  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS can_manage_overview_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_honor_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_activity_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_analytics_files BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_access_kvk_manager BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_access_migration_list BOOLEAN DEFAULT FALSE;
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

  // ACTIVITY FILES
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

  // KVK EVENTS
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

  // MIGRATION LIST ENTRIES
  await query(`
    CREATE TABLE IF NOT EXISTS migration_list_entries (
      kingdom_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      reason TEXT,
      contacted TEXT,
      info TEXT,
      manually_added BOOLEAN DEFAULT FALSE,
      excluded BOOLEAN DEFAULT FALSE,
      migrated_override BOOLEAN,
      updated_by_user_id TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (kingdom_id, player_id)
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

  // NEW: owner_user_id on kingdoms (add FK later after users table exists)
  await query(`
    ALTER TABLE kingdoms
      ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
  `);

  // Add FKs after both tables exist
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_kingdom_fk'
          AND table_name = 'users'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_kingdom_fk FOREIGN KEY (kingdom_id)
          REFERENCES kingdoms(id);
      END IF;
    END$$;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'kingdoms_owner_user_fk'
          AND table_name = 'kingdoms'
      ) THEN
        ALTER TABLE kingdoms
          ADD CONSTRAINT kingdoms_owner_user_fk FOREIGN KEY (owner_user_id)
          REFERENCES users(id);
      END IF;
    END$$;
  `);

  // Default kingdom
  await query(`
    INSERT INTO kingdoms (id, display_name, slug, rok_identifier, status, plan)
    VALUES ('kdm-default', 'Default Kingdom', 'default-kingdom', NULL, 'active', 'free')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Backfill and FK guardrails for files
  const tables = ['overview_files', 'honor_files', 'activity_files'];
  for (const table of tables) {
    await query(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
        ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
    `);
  }

  for (const table of tables) {
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

  // KvK events: kingdom_id guardrail
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

  // Migration list: kingdom_id guardrail
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'migration_list_entries_kingdom_fk'
          AND table_name = 'migration_list_entries'
      ) THEN
        ALTER TABLE migration_list_entries
          ADD CONSTRAINT migration_list_entries_kingdom_fk FOREIGN KEY (kingdom_id)
          REFERENCES kingdoms(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  // Backfill existing files
  await query(`
    UPDATE overview_files SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;
  `);
  await query(`
    UPDATE honor_files SET kingdom_id = 'kdm-default' WHERE kingdom_id IS NULL;
  `);

  console.log('Postgres schema initialized (users, files [overview, honor, activity], kingdoms)');
}

if (require.main === module) {
  init().catch((err) => {
    console.error('Error initializing Postgres schema:', err);
    process.exit(1);
  });
}

module.exports = { init };
