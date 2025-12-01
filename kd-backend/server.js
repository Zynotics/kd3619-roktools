// server.js - Backend mit Admin, Uploads, Gov-ID-Validierung, Feature-Rechten & Kingdom-Layout (Postgres)

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 💾 NEU: Import der neuen DB-Funktionen
const { query, get, all, assignR5, updateKingdomStatus, deleteKingdom } = require('./db-pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'kd3619-secret-key-change-in-production';

// CORS für Production und Development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kd3619-frontend.onrender.com',
  'https://rise-of-stats.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.options('*', cors());
app.use(express.json());

// 📂 Upload-Ordner erstellen
const uploadsOverviewDir = path.join(__dirname, 'uploads', 'overview');
const uploadsHonorDir = path.join(__dirname, 'uploads', 'honor');

[uploadsOverviewDir, uploadsHonorDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Hilfsfunktion: Excel / CSV einlesen
function parseExcel(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.csv') {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rows = fileContent
          .split(/\r?\n/)
          .map((line) => line.split(';').map((v) => v.trim()))
          .filter((row) => row.length > 1);
        if (rows.length === 0) {
          return resolve({ headers: [], data: [] });
        }
        const headers = rows[0].map((h) => (h ? h.toString() : ''));
        const data = rows.slice(1).filter((row) => row.length > 0);
        return resolve({ headers, data });
      } else {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
          return resolve({ headers: [], data: [] });
        }

        const headers = jsonData[0].map((h) => (h ? h.toString() : ''));
        const data = jsonData.slice(1).filter((row) => row.length > 0);

        resolve({ headers, data });
      }
    } catch (error) {
      reject(error);
    }
  });
}

// ==================== AUTH-MIDDLEWARES ====================

function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Kein Token vorhanden' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Ungültiger Token' });
    req.user = user;
    next();
  });
}

// 🔐 Admin / R5 middleware (für Admin-Endpunkte)
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  try {
    const dbUser = await get('SELECT role FROM users WHERE id = $1', [
      req.user.id,
    ]);

    if (!dbUser) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const role = dbUser.role;

    // Nur 'admin' hat volle Rechte über alle Endpunkte. 'r5' sollte nur spezifische Rechte haben.
    // Da hier alle Admin-Endpunkte über requireAdmin laufen, lassen wir es vorerst nur für 'admin' und 'r5' zu.
    // Anmerkung: Später muss hier unterschieden werden, ob der Endpunkt von einem R5 ausgeführt werden darf.
    // Für die Kingdom-Verwaltung sollten NUR Superadmins ('admin') Zugriff haben.
    if (role !== 'admin' && role !== 'r5') {
      return res
        .status(403)
        .json({ error: 'Admin oder R5 Rechte erforderlich' });
    }

    req.user.role = role;
    next();
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    return res
      .status(500)
      .json({ error: 'Fehler bei der Admin-/R5-Rechteprüfung' });
  }
}

// ==================== GOV-ID-HELPER (Postgres) ====================

function findColumnIndex(headers, possibleNames) {
  if (!Array.isArray(headers)) return undefined;
  const normalizedHeaders = headers.map((h) =>
    h ? h.toString().trim().toLowerCase() : ''
  );
  for (const name of possibleNames) {
    const idx = normalizedHeaders.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return undefined;
}

async function userGovIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  if (!governorId) return false;

  try {
    const row = await get(
      'SELECT id FROM users WHERE governor_id = $1 LIMIT 1',
      [governorId]
    );
    return !!row;
  } catch (error) {
    console.error('Error checking governor_id in users table:', error);
    return false;
  }
}

async function governorIdExists(governorIdRaw) {
  if (!governorIdRaw) return false;
  const governorId = String(governorIdRaw).trim();
  if (!governorId) return false;

  const tables = ['overview_files', 'honor_files'];
  const possibleGovHeaders = ['governor id', 'governorid', 'gov id'];

  try {
    for (const table of tables) {
      const rows = await all(`SELECT headers, data FROM ${table}`);
      for (const row of rows) {
        const headers = JSON.parse(row.headers || '[]');
        const data = JSON.parse(row.data || '[]');

        const govIdx = findColumnIndex(headers, possibleGovHeaders);
        if (govIdx === undefined) continue;

        for (const r of data) {
          const value = r[govIdx];
          if (value == null) continue;
          const v = String(value).trim();
          if (v === governorId) {
            console.log(`✅ Found governorId ${governorId} in table ${table}`);
            return true;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error while searching governorId:', e);
    return false;
  }

  console.log(`❌ governorId ${governorId} not found in any uploaded data`);
  return false;
}

// ==================== MULTER-CONFIG ====================

const overviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsOverviewDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const honorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsHonorDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const allowedExtensions = ['.xlsx', '.xls', '.csv'];

const overviewUpload = multer({
  storage: overviewStorage,
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const honorUpload = multer({
  storage: honorStorage,
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Nur Excel und CSV Dateien sind erlaubt'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// ==================== AUTH ENDPOINTS ====================

app.post('/api/auth/check-gov-id', async (req, res) => {
  try {
    const { governorId } = req.body;

    if (!governorId || !String(governorId).trim()) {
      return res
        .status(400)
        .json({ exists: false, error: 'Gov ID wird benötigt' });
    }

    const existsInUsers = await userGovIdExists(governorId);
    const existsInFiles = await governorIdExists(governorId);

    res.json({
      exists: existsInUsers || existsInFiles,
      existsInUsers,
      existsInFiles,
    });
  } catch (err) {
    console.error('check-gov-id error:', err);
    res.status(500).json({ error: 'Gov ID check failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password, governorId } = req.body;

    if (!email || !username || !password || !governorId) {
      return res.status(400).json({
        error: 'Email, Benutzername, Passwort und Gov ID werden benötigt',
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const normalizedGovId = String(governorId).trim();

    if (await userGovIdExists(normalizedGovId)) {
      return res.status(400).json({
        error: 'Für diese Gov ID existiert bereits ein Account.',
      });
    }

    const existingUser = await get(
      'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [email, username]
    );

    if (existingUser) {
      return res.status(400).json({
        error: 'Email oder Benutzername ist bereits vergeben',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'user-' + Date.now();

    await query(
      `
      INSERT INTO users (
        id,
        email,
        username,
        password_hash,
        is_approved,
        role,
        governor_id,
        can_access_honor,
        can_access_analytics,
        can_access_overview
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        userId,
        email,
        username,
        passwordHash,
        false,
        'user',
        normalizedGovId,
        false,
        false,
        false,
      ]
    );

    return res.json({
      message:
        'Registrierung erfolgreich. Bitte warten Sie auf die Freigabe durch einen Administrator.',
      user: {
        id: userId,
        email,
        username,
        isApproved: false,
        role: 'user',
        governorId: normalizedGovId,
        canAccessHonor: false,
        canAccessAnalytics: false,
        canAccessOverview: false,
      },
    });
  } catch (error) {
    console.error('❌ Error during registration:', error);
    return res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'Benutzername und Passwort werden benötigt' });
    }

    const user = await get('SELECT * FROM users WHERE username = $1', [
      username,
    ]);

    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      isApproved: !!user.is_approved,
      governorId: user.governor_id || null,
      canAccessHonor: !!user.can_access_honor,
      canAccessAnalytics: !!user.can_access_analytics,
      canAccessOverview: !!user.can_access_overview,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isApproved: !!user.is_approved,
        role: user.role,
        governorId: user.governor_id || null,
        canAccessHonor: !!user.can_access_honor,
        canAccessAnalytics: !!user.can_access_analytics,
        canAccessOverview: !!user.can_access_overview,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

app.get('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);

    if (!user) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      isApproved: !!user.is_approved,
      role: user.role,
      governorId: user.governor_id || null,
      canAccessHonor: !!user.can_access_honor,
      canAccessAnalytics: !!user.can_access_analytics,
      canAccessOverview: !!user.can_access_overview,
    });
  } catch (err) {
    console.error('validate error:', err);
    res.status(500).json({ error: 'Token-Validierung fehlgeschlagen' });
  }
});

// ==================== ADMIN ENDPOINTS (USERS) ====================

app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await all(
      'SELECT id, username, email, is_approved, role, governor_id, can_access_honor, can_access_analytics, can_access_overview FROM users'
    );
    res.json(users);
  } catch (error) {
    console.error('Debug users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/create-admin', async (req, res) => {
  try {
    const adminPasswordHash = bcrypt.hashSync('*3619rocks!', 10);
    await query(
      `
      INSERT INTO users (
        id, email, username, password_hash, is_approved, role,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        password_hash = EXCLUDED.password_hash,
        is_approved = EXCLUDED.is_approved,
        role = EXCLUDED.role,
        governor_id = EXCLUDED.governor_id,
        can_access_honor = EXCLUDED.can_access_honor,
        can_access_analytics = EXCLUDED.can_access_analytics,
        can_access_overview = EXCLUDED.can_access_overview
    `,
      [
        'admin-001',
        'admin@kd3619.com',
        'Stadmin',
        adminPasswordHash,
        true,
        'admin',
        null,
        true,
        true,
        true,
      ]
    );
    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Manual admin creation error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await all(
      `
      SELECT
        id, email, username, is_approved, role, created_at, kingdom_id,
        governor_id, can_access_honor, can_access_analytics, can_access_overview
      FROM users
      ORDER BY created_at DESC
    `
    );

    res.json(
      users.map((user) => ({
        id: user.id,
        email: user.email,
        username: user.username,
        isApproved: !!user.is_approved,
        role: user.role,
        createdAt: user.created_at,
        kingdomId: user.kingdom_id || null, // Hinzugefügt
        governorId: user.governor_id || null,
        canAccessHonor: !!user.can_access_honor,
        canAccessAnalytics: !!user.can_access_analytics,
        canAccessOverview: !!user.can_access_overview,
      }))
    );
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
  }
});

app.post(
  '/api/admin/users/approve',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId, approved } = req.body;

      if (!userId || typeof approved !== 'boolean') {
        return res.status(400).json({
          error:
            'Ungültige Eingabe: userId und approved (boolean) werden benötigt',
        });
      }

      const result = await query(
        'UPDATE users SET is_approved = $1 WHERE id = $2',
        [approved, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({
        success: true,
        message: `Benutzer erfolgreich ${approved ? 'freigegeben' : 'gesperrt'}`,
        changes: result.rowCount,
      });
    } catch (error) {
      console.error('💥 CRITICAL ERROR in admin/approve:', error);
      res.status(500).json({
        error: 'Interner Server Fehler',
        details: error.message,
      });
    }
  }
);

app.post(
  '/api/admin/users/access',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId, canAccessHonor, canAccessAnalytics, canAccessOverview } =
        req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId wird benötigt' });
      }

      const result = await query(
        `
        UPDATE users
        SET
          can_access_honor = $1,
          can_access_analytics = $2,
          can_access_overview = $3
        WHERE id = $4
      `,
        [!!canAccessHonor, !!canAccessAnalytics, !!canAccessOverview, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({
        success: true,
        message: 'Zugriffsrechte erfolgreich aktualisiert',
      });
    } catch (error) {
      console.error('Error in admin/users/access:', error);
      res.status(500).json({ error: 'Interner Server Fehler' });
    }
  }
);

app.post(
  '/api/admin/users/role',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId, role } = req.body;

      if (!userId || !role) {
        return res.status(400).json({
          error: 'userId und role werden benötigt',
        });
      }

      const result = await query('UPDATE users SET role = $1 WHERE id = $2', [
        role,
        userId,
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({
        success: true,
        message: 'Rolle erfolgreich aktualisiert',
      });
    } catch (error) {
      console.error('Error in admin/users/role:', error);
      res.status(500).json({ error: 'Interner Server Fehler' });
    }
  }
);

app.delete(
  '/api/admin/users/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;

      const result = await query('DELETE FROM users WHERE id = $1', [userId]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ success: true, message: 'Benutzer erfolgreich gelöscht' });
    } catch (error) {
      console.error('Error in admin/users delete:', error);
      res.status(500).json({ error: 'Interner Server Fehler' });
    }
  }
);

// ==================== KINGDOM ADMIN ENDPOINTS ====================

// Liste aller Königreiche (nur admin/r5)
app.get(
  '/api/admin/kingdoms',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const kingdoms = await all(
        `
        SELECT
          k.id,
          k.display_name,
          k.slug,
          k.rok_identifier,
          k.status,
          k.plan,
          k.created_at,
          k.updated_at,
          k.owner_user_id,
          u.username AS owner_username,
          u.email   AS owner_email
        FROM kingdoms k
        LEFT JOIN users u ON u.id = k.owner_user_id
        ORDER BY k.created_at DESC
        `
      );

      res.json(
        kingdoms.map((k) => ({
          id: k.id,
          displayName: k.display_name,
          slug: k.slug,
          rokIdentifier: k.rok_identifier,
          status: k.status,
          plan: k.plan,
          createdAt: k.created_at,
          updatedAt: k.updated_at,
          ownerUserId: k.owner_user_id || null,
          ownerUsername: k.owner_username || null,
          ownerEmail: k.owner_email || null,
        }))
      );
    } catch (error) {
      console.error('Error fetching kingdoms:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Königreiche' });
    }
  }
);

// Neues Königreich anlegen (nur admin/r5)
// Body: { displayName, slug, rokIdentifier, status?, plan?, ownerUserId? }
app.post(
  '/api/admin/kingdoms',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        displayName,
        slug,
        rokIdentifier,
        status = 'active',
        plan = 'free',
        ownerUserId = null,
      } = req.body;

      if (!displayName || !slug) {
        return res.status(400).json({
          error: 'displayName und slug werden benötigt',
        });
      }

      const normalizedSlug = String(slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-');

      const kingdomId = 'kdm-' + Date.now();

      await query(
        `
        INSERT INTO kingdoms (
          id, display_name, slug, rok_identifier, status, plan, owner_user_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          kingdomId,
          displayName,
          normalizedSlug,
          rokIdentifier || null,
          status,
          plan,
          ownerUserId || null,
        ]
      );

      res.json({
        id: kingdomId,
        displayName,
        slug: normalizedSlug,
        rokIdentifier: rokIdentifier || null,
        status,
        plan,
        ownerUserId: ownerUserId || null,
      });
    } catch (error) {
      console.error('Error creating kingdom:', error);

      if (error.message && error.message.includes('duplicate key')) {
        return res.status(400).json({
          error: 'Slug ist bereits vergeben. Bitte einen anderen wählen.',
        });
      }

      res.status(500).json({ error: 'Fehler beim Anlegen des Königreichs' });
    }
  }
);

// 👑 NEU: R5-Rolle zuweisen und Kingdom-Owner setzen
// Body: { r5UserId }
app.post(
  '/api/admin/kingdoms/:id/assign-r5',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error:
          'Nur Superadmins (Rolle "admin") dürfen R5-Rollen zuweisen und Königreiche übertragen.',
      });
    }
    
    try {
      const kingdomId = req.params.id;
      const { r5UserId } = req.body;

      if (!kingdomId || !r5UserId) {
        return res.status(400).json({ error: 'kingdomId und r5UserId werden benötigt' });
      }

      const kingdom = await get(
        'SELECT id, display_name FROM kingdoms WHERE id = $1 LIMIT 1',
        [kingdomId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Königreich nicht gefunden' });
      }

      const userToAssign = await get(
        'SELECT id FROM users WHERE id = $1 LIMIT 1',
        [r5UserId]
      );
      if (!userToAssign) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      
      // Nutze die neue DB-Funktion, die beides in einem Schritt macht
      await assignR5(r5UserId, kingdomId);

      // Aktualisierte Kingdom-Daten zurücksenden (inkl. neuem Owner)
      const updated = await get(
        `
        SELECT
          k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.updated_at, k.owner_user_id,
          u.username AS owner_username, u.email AS owner_email
        FROM kingdoms k
        LEFT JOIN users u ON u.id = k.owner_user_id
        WHERE k.id = $1
        `,
        [kingdomId]
      );

      res.json({
        success: true,
        message: `Benutzer ${r5UserId} erfolgreich als R5 für ${updated.display_name} zugewiesen.`,
        kingdom: updated,
      });
    } catch (error) {
      console.error('Error assigning R5:', error);
      res.status(500).json({ error: 'Fehler beim Zuweisen der R5-Rolle' });
    }
  }
);

// 🔒 NEU: Status eines Königreichs setzen (active / inactive)
app.post(
  '/api/admin/kingdoms/:id/status',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error:
          'Nur Superadmins (Rolle "admin") dürfen den Kingdom-Status ändern.',
      });
    }

    try {
      const kingdomId = req.params.id;
      const { status } = req.body;

      const allowed = ['active', 'inactive'];
      if (!status || !allowed.includes(status)) {
        return res.status(400).json({
          error: `Ungültiger Status. Erlaubt: ${allowed.join(', ')}`,
        });
      }

      const k = await get(
        'SELECT id, slug FROM kingdoms WHERE id = $1 LIMIT 1',
        [kingdomId]
      );
      if (!k) {
        return res.status(404).json({ error: 'Königreich nicht gefunden' });
      }
      
      // Nutze die neue DB-Funktion
      await updateKingdomStatus(kingdomId, status);

      const updated = await get(
        `
        SELECT
          k.id, k.display_name, k.slug, k.rok_identifier, k.status, k.plan, k.updated_at, k.owner_user_id,
          u.username AS owner_username, u.email AS owner_email
        FROM kingdoms k
        LEFT JOIN users u ON u.id = k.owner_user_id
        WHERE k.id = $1
        `,
        [kingdomId]
      );

      res.json({
        id: updated.id,
        displayName: updated.display_name,
        slug: updated.slug,
        rokIdentifier: updated.rok_identifier,
        status: updated.status,
        plan: updated.plan,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
        ownerUserId: updated.owner_user_id || null,
        ownerUsername: updated.owner_username || null,
        ownerEmail: updated.owner_email || null,
      });
    } catch (error) {
      console.error('Error updating kingdom status:', error);
      res
        .status(500)
        .json({ error: 'Fehler beim Aktualisieren des Kingdom-Status' });
    }
  }
);

// ❌ NEU: Königreich löschen (hart) – Default-Kingdom wird geschützt
app.delete(
  '/api/admin/kingdoms/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error:
          'Nur Superadmins (Rolle "admin") dürfen Königreiche löschen.',
      });
    }

    try {
      const kingdomId = req.params.id;

      const k = await get(
        'SELECT id, slug FROM kingdoms WHERE id = $1 LIMIT 1',
        [kingdomId]
      );
      if (!k) {
        return res.status(404).json({ error: 'Königreich nicht gefunden' });
      }

      // Safety: Default-Kingdom nicht löschen
      if (k.slug === 'default-kingdom') {
        return res.status(400).json({
          error: 'Das Default-Kingdom kann nicht gelöscht werden',
        });
      }
      
      // Nutze die neue DB-Funktion
      const deletedCount = await deleteKingdom(kingdomId);

      if (deletedCount > 0) {
        res.json({ success: true, message: 'Königreich erfolgreich gelöscht (inkl. zugehöriger Benutzer/Dateien)' });
      } else {
        res.status(404).json({ error: 'Königreich nicht gefunden' });
      }

    } catch (error) {
      console.error('Error deleting kingdom:', error);
      res.status(500).json({ error: 'Fehler beim Löschen des Königreichs' });
    }
  }
);


// ==================== PUBLIC KINGDOM ENDPOINTS ====================

// Hilfsfunktion: Kingdom per slug holen
async function findKingdomBySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  try {
    const kingdom = await get(
      `
      SELECT
        id,
        display_name,
        slug,
        rok_identifier,
        status,
        plan,
        created_at,
        updated_at
      FROM kingdoms
      WHERE LOWER(slug) = $1
      LIMIT 1
      `,
      [normalized]
    );
    return kingdom || null;
  } catch (error) {
    console.error('Error fetching kingdom by slug:', error);
    return null;
  }
}

// Metadaten zu einem Königreich (public)
app.get('/api/public/kingdom/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const kingdom = await findKingdomBySlug(slug);

    if (!kingdom) {
      return res.status(404).json({ error: 'Königreich nicht gefunden' });
    }

    res.json({
      id: kingdom.id,
      displayName: kingdom.display_name,
      slug: kingdom.slug,
      rokIdentifier: kingdom.rok_identifier,
      status: kingdom.status,
      plan: kingdom.plan,
      createdAt: kingdom.created_at,
      updatedAt: kingdom.updated_at,
    });
  } catch (error) {
    console.error('Error in public kingdom meta:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Königreichs' });
  }
});

// Overview-Files für ein Königreich (public)
app.get('/api/public/kingdom/:slug/overview-files', async (req, res) => {
  try {
    const { slug } = req.params;
    const kingdom = await findKingdomBySlug(slug);

    if (!kingdom) {
      return res.status(404).json({ error: 'Königreich nicht gefunden' });
    }

    const rows = await all(
      `
      SELECT * FROM overview_files
      WHERE kingdom_id = $1
      ORDER BY fileOrder, uploadDate
      `,
      [kingdom.id]
    );

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching public overview files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Honor-Files für ein Königreich (public)
app.get('/api/public/kingdom/:slug/honor-files', async (req, res) => {
  try {
    const { slug } = req.params;
    const kingdom = await findKingdomBySlug(slug);

    if (!kingdom) {
      return res.status(404).json({ error: 'Königreich nicht gefunden' });
    }

    const rows = await all(
      `
      SELECT * FROM honor_files
      WHERE kingdom_id = $1
      ORDER BY fileOrder, uploadDate
      `,
      [kingdom.id]
    );

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching public honor files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// ==================== OVERVIEW FILES ====================

// 🚨 WICHTIG: Route mit Token schützen, damit der User authentifiziert sein muss
app.get('/overview/files-data', authenticateToken, async (req, res) => { 
  try {
    // Später muss hier die Kingdom-ID aus dem authentifizierten User-Objekt (req.user) verwendet werden.
    // Für den Moment bleibt es beim Default-Kingdom
    const rows = await all(
      `
      SELECT * FROM overview_files
      WHERE kingdom_id = $1 
      ORDER BY fileOrder, uploadDate
      `,
      ['kdm-default']
    );

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching overview files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/overview/upload', overviewUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const { headers, data } = await parseExcel(req.file.path);

    const id = 'ov-' + Date.now();
    const uploadDate = new Date().toISOString();
    const kingdomId = 'kdm-default';
    const uploadedByUserId = null; // später: req.user?.id bei Login-gebundenen Uploads

    const newFile = {
      id,
      name: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      uploadDate,
      headers: JSON.stringify(headers),
      data: JSON.stringify(data),
      kingdom_id: kingdomId,
      uploaded_by_user_id: uploadedByUserId,
    };

    await query(
      `
      INSERT INTO overview_files
        (id, name, filename, path, size, uploadDate, headers, data, kingdom_id, uploaded_by_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        newFile.id,
        newFile.name,
        newFile.filename,
        newFile.path,
        newFile.size,
        newFile.uploadDate,
        newFile.headers,
        newFile.data,
        newFile.kingdom_id,
        newFile.uploaded_by_user_id,
      ]
    );

    res.json({
      message: 'Datei erfolgreich hochgeladen',
      file: {
        ...newFile,
        headers,
        data,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen: ' + error.message });
  }
});

app.delete('/overview/files/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    const file = await get('SELECT * FROM overview_files WHERE id = $1', [
      fileId,
    ]);

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const result = await query('DELETE FROM overview_files WHERE id = $1', [
      fileId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    res.json({ message: 'Datei erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.post('/overview/files/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Ungültige Reihenfolge' });
    }

    for (let index = 0; index < order.length; index++) {
      const id = order[index];
      await query(
        'UPDATE overview_files SET fileOrder = $1 WHERE id = $2',
        [index, id]
      );
    }

    res.json({ message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    console.error('Reorder error:', error);
    res
      .status(500)
      .json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
  }
});

// ==================== HONOR FILES ====================

// 🚨 WICHTIG: Route mit Token schützen, damit der User authentifiziert sein muss
app.get('/honor/files-data', authenticateToken, async (req, res) => {
  try {
    // Später muss hier die Kingdom-ID aus dem authentifizierten User-Objekt (req.user) verwendet werden.
    // Für den Moment bleibt es beim Default-Kingdom
    const rows = await all(
      `
      SELECT * FROM honor_files
      WHERE kingdom_id = $1
      ORDER BY fileOrder, uploadDate
      `,
      ['kdm-default']
    );

    const files = rows.map((row) => ({
      ...row,
      headers: JSON.parse(row.headers || '[]'),
      data: JSON.parse(row.data || '[]'),
    }));

    res.json(files);
  } catch (error) {
    console.error('Error fetching honor files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/honor/upload', honorUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const { headers, data } = await parseExcel(req.file.path);

    const id = 'hon-' + Date.now();
    const uploadDate = new Date().toISOString();
    const kingdomId = 'kdm-default';
    const uploadedByUserId = null;

    const newFile = {
      id,
      name: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      uploadDate,
      headers: JSON.stringify(headers),
      data: JSON.stringify(data),
      kingdom_id: kingdomId,
      uploaded_by_user_id: uploadedByUserId,
    };

    await query(
      `
      INSERT INTO honor_files
        (id, name, filename, path, size, uploadDate, headers, data, kingdom_id, uploaded_by_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
      [
        newFile.id,
        newFile.name,
        newFile.filename,
        newFile.path,
        newFile.size,
        newFile.uploadDate,
        newFile.headers,
        newFile.data,
        newFile.kingdom_id,
        newFile.uploaded_by_user_id,
      ]
    );

    res.json({
      message: 'Datei erfolgreich hochgeladen',
      file: {
        ...newFile,
        headers,
        data,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload fehlgeschlagen: ' + error.message });
  }
});

app.delete('/honor/files/:id', async (req, res) => {
  try {
    const fileId = req.params.id;

    const file = await get('SELECT * FROM honor_files WHERE id = $1', [fileId]);

    if (!file) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    const result = await query('DELETE FROM honor_files WHERE id = $1', [
      fileId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Datei nicht gefunden' });
    }

    res.json({ message: 'Datei erfolgreich gelöscht' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Löschen fehlgeschlagen' });
  }
});

app.post('/honor/files/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Ungültige Reihenfolge' });
    }

    for (let index = 0; index < order.length; index++) {
      const id = order[index];
      await query(
        'UPDATE honor_files SET fileOrder = $1 WHERE id = $2',
        [index, id]
      );
    }

    res.json({ message: 'Reihenfolge aktualisiert' });
  } catch (error) {
    console.error('Reorder error:', error);
    res
      .status(500)
      .json({ error: 'Reihenfolge konnte nicht aktualisiert werden' });
  }
});

// ==================== HEALTH & ROOT ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'Backend läuft',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Postgres via DATABASE_URL',
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'KD3619 Backend API',
    version: '2.4.1-pg-kingdom-r5-fix', // Version aktualisiert
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/validate',
        'POST /api/auth/check-gov-id',
      ],
      admin: [
        'GET /api/admin/users',
        'POST /api/admin/users/approve',
        'POST /api/admin/users/access',
        'POST /api/admin/users/role',
        'DELETE /api/admin/users/:id',
        'POST /api/admin/create-admin',
        'GET /api/admin/kingdoms',
        'POST /api/admin/kingdoms',
        'POST /api/admin/kingdoms/:id/assign-r5', 
        'POST /api/admin/kingdoms/:id/status',    
        'DELETE /api/admin/kingdoms/:id',         
      ],
      public: [
        'GET /api/public/kingdom/:slug',
        'GET /api/public/kingdom/:slug/overview-files',
        'GET /api/public/kingdom/:slug/honor-files',
      ],
      debug: ['GET /api/debug/users'],
      overview: [
        'GET /overview/files-data (Requires Token!)', // HINWEIS
        'POST /overview/upload',
        'DELETE /overview/files/:id',
        'POST /overview/files/reorder',
      ],
      honor: [
        'GET /honor/files-data (Requires Token!)', // HINWEIS
        'POST /honor/upload',
        'DELETE /honor/files/:id',
        'POST /honor/files/reorder',
      ],
      health: 'GET /health',
    },
  });
});

// ==================== SERVER START ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server läuft auf Port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Datenbank: Postgres via DATABASE_URL`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
}); 66