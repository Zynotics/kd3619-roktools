// db-pg.js – kleine Wrapper-Schicht für Postgres

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

module.exports = {
  query,
  get,
  all,
};
