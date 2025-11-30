// init-pg.js – Tabellen in Postgres anlegen

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
      data TEXT
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
      data TEXT
    );
  `);

  console.log('✅ Postgres schema initialized');
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
