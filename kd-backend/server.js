// server.js – Entry Point (KD3619 RoK Tools Backend)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init: initPgSchema } = require('./init-pg');
const { initMigrationListTable, initWatchlistTable } = require('./db-pg');

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
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, true); // permissive fallback
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

app.get('/api/shop-visibility', async (req, res) => {
  try { res.json({ enabled: await getR5ShopVisibilitySetting() }); }
  catch (e) { res.status(500).json({ error: 'Failed to load shop settings' }); }
});
app.get('/api/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
  try { res.json({ enabled: await getR5ShopVisibilitySetting() }); }
  catch (e) { res.status(500).json({ error: 'Failed to load shop settings' }); }
});
app.get('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  try { res.json({ enabled: await getR5ShopVisibilitySetting() }); }
  catch (e) { res.status(500).json({ error: 'Failed to load shop settings' }); }
});
app.put('/api/admin/r5-shop-visibility', authenticateToken, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Superadmin only' });
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
  try { await setR5ShopVisibilitySetting(enabled); res.json({ success: true, enabled }); }
  catch (e) { res.status(500).json({ error: 'Failed to save shop settings' }); }
});
app.use('/api/admin/kvk/events', require('./routes/kvk'));
app.use('/api/migration-list', require('./routes/migration'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.use('/api/public', require('./routes/public'));
app.use('/', require('./routes/files')); // /overview/*, /honor/*, /activity/*

// ==================== MISC ====================
app.get('/health', (req, res) => res.json({ status: 'Backend running', time: new Date() }));
app.get('/', (req, res) => res.json({ message: 'KD3619 Backend API', version: '2.7.0' }));

// ==================== START ====================
async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      await initPgSchema();
      await initMigrationListTable();
      await initWatchlistTable();
    } catch (err) {
      console.error('Postgres schema init failed:', err);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
