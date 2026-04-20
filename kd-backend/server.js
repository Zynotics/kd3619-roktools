// server.js – Entry Point (KD3619 RoK Tools Backend)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init: initPgSchema } = require('./init-pg');
const { initMigrationListTable, initWatchlistTable, initActivityLogsTable } = require('./db-pg');

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== CORS ====================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
  'https://rise-of-stats.com',
  'https://www.rise-of-stats.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // same-origin / curl / server-to-server
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.options('*', cors());
app.use(express.json());

// ==================== ROUTES ====================
const r5codesRouter = require('./routes/admin/r5codes');
const kingdomsRouter = require('./routes/admin/kingdoms');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/kingdoms', kingdomsRouter);
app.use('/api/admin/r5-codes', r5codesRouter);
app.use('/api/r5-codes', r5codesRouter);         // Kunden-Routen: /my, /activate-self, /create-kingdom
app.use('/api/me', r5codesRouter);               // /api/me/kingdom
// Shop-Visibility (direkte Routen, da verschiedene Basispfade)
const { getR5ShopVisibilitySetting, setR5ShopVisibilitySetting } = require('./helpers');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

// Public read — used by LandingPage & App for header rendering
app.get('/api/shop-visibility', async (req, res) => {
  try { res.json({ enabled: await getR5ShopVisibilitySetting() }); }
  catch (e) { res.status(500).json({ error: 'Failed to load shop settings' }); }
});
// Admin read/write — requireAdmin already enforces role check
app.get('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
  try { res.json({ enabled: await getR5ShopVisibilitySetting() }); }
  catch (e) { res.status(500).json({ error: 'Failed to load shop settings' }); }
});
app.put('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  try { await setR5ShopVisibilitySetting(enabled); res.json({ success: true, enabled }); }
  catch (e) { res.status(500).json({ error: 'Failed to save shop settings' }); }
});
app.use('/api/admin/kvk/events', require('./routes/kvk'));
app.use('/api/admin/logs', require('./routes/admin/logs'));
app.use('/api/migration-list', require('./routes/migration'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/public', require('./routes/public'));
app.use('/', require('./routes/files')); // /overview/*, /honor/*, /activity/*

// ==================== MISC ====================
app.get('/health', (req, res) => res.json({ status: 'Backend running', time: new Date() }));
app.get('/', (req, res) => res.json({ message: 'KD3619 Backend API', version: '2.7.0' }));

// ==================== WEEKLY LOG CLEANUP ====================
const { query: dbQuery } = require('./db-pg');

async function deleteOldActivityLogs() {
  try {
    const res = await dbQuery(`DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '7 days'`);
    console.log(`[Log Cleanup] Deleted ${res.rowCount} activity log entries older than 7 days.`);
  } catch (e) {
    console.error('[Log Cleanup] Failed:', e.message);
  }
}

// ==================== START ====================
async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      await initPgSchema();
      await initMigrationListTable();
      await initWatchlistTable();
      await initActivityLogsTable();
    } catch (err) {
      console.error('Postgres schema init failed:', err);
    }

    // Run log cleanup once on startup, then every 7 days
    deleteOldActivityLogs();
    setInterval(deleteOldActivityLogs, 7 * 24 * 60 * 60 * 1000);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
