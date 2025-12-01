// init-pg.js
// Initialisiert das Postgres-Schema für kd-backend (users, kingdoms, overview_files, honor_files)

const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL ist nicht gesetzt. Bitte ENV konfigurieren.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // für Render / gehostete Postgres-Instanzen üblich
  },
});

async function init() {
  console.log('🔧 Initializing Postgres schema...');

  try {
    await client.connect();

    // 1) USERS-TABELLE
    await client.query(`
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
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Falls Tabelle schon existiert: fehlende Spalten nachziehen
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS governor_id TEXT,
        ADD COLUMN IF NOT EXISTS can_access_honor BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS can_access_analytics BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS can_access_overview BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // 2) KINGDOMS-TABELLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS kingdoms (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        rok_identifier TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        plan TEXT NOT NULL DEFAULT 'free',
        owner_user_id TEXT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // fehlende Spalten nachziehen (für bestehende Installationen)
    await client.query(`
      ALTER TABLE kingdoms
        ADD COLUMN IF NOT EXISTS rok_identifier TEXT,
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // FK zu users (Owner)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'kingdoms_owner_user_id_fkey'
        ) THEN
          ALTER TABLE kingdoms
            ADD CONSTRAINT kingdoms_owner_user_id_fkey
            FOREIGN KEY (owner_user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // 3) OVERVIEW_FILES
    await client.query(`
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

    await client.query(`
      ALTER TABLE overview_files
        ADD COLUMN IF NOT EXISTS fileOrder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
        ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
    `);

    // FK für overview_files → kingdoms/users
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'overview_files_kingdom_id_fkey'
        ) THEN
          ALTER TABLE overview_files
            ADD CONSTRAINT overview_files_kingdom_id_fkey
            FOREIGN KEY (kingdom_id)
            REFERENCES kingdoms(id)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'overview_files_uploaded_by_user_id_fkey'
        ) THEN
          ALTER TABLE overview_files
            ADD CONSTRAINT overview_files_uploaded_by_user_id_fkey
            FOREIGN KEY (uploaded_by_user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // 4) HONOR_FILES
    await client.query(`
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

    await client.query(`
      ALTER TABLE honor_files
        ADD COLUMN IF NOT EXISTS fileOrder INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS kingdom_id TEXT,
        ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT;
    `);

    // FK für honor_files → kingdoms/users
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'honor_files_kingdom_id_fkey'
        ) THEN
          ALTER TABLE honor_files
            ADD CONSTRAINT honor_files_kingdom_id_fkey
            FOREIGN KEY (kingdom_id)
            REFERENCES kingdoms(id)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'honor_files_uploaded_by_user_id_fkey'
        ) THEN
          ALTER TABLE honor_files
            ADD CONSTRAINT honor_files_uploaded_by_user_id_fkey
            FOREIGN KEY (uploaded_by_user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    // 5) DEFAULT-KINGDOM sicherstellen
    const resDefault = await client.query(
      `SELECT id FROM kingdoms WHERE slug = $1 LIMIT 1`,
      ['default-kingdom']
    );

    if (resDefault.rows.length === 0) {
      const defaultId = 'kdm-default';
      await client.query(
        `
        INSERT INTO kingdoms (id, display_name, slug, rok_identifier, status, plan)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;
        `,
        [
          defaultId,
          'Default Kingdom',
          'default-kingdom',
          null,
          'active',
          'free',
        ]
      );
      console.log('✅ Default kingdom created (kdm-default)');
    } else {
      console.log('ℹ️ Default kingdom already exists');
    }

    console.log('✅ Postgres schema initialized (users, kingdoms, overview_files, honor_files)');
  } catch (err) {
    console.error('💥 Error initializing Postgres schema:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

init();
