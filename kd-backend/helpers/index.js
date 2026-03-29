// helpers/index.js – Shared utility functions

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { get, all, getAppSetting, setAppSetting } = require('../db-pg');

const R5_SHOP_VISIBILITY_KEY = 'r5_shop_enabled';

// FIX: Postgres gibt Spalten kleingeschrieben zurück. Frontend braucht CamelCase.
function normalizeFileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    uploadDate: row.uploaddate || row.uploadDate || row.created_at || new Date().toISOString(),
    size: row.size,
    kingdomId: row.kingdom_id,
    headers: typeof row.headers === 'string' ? JSON.parse(row.headers || '[]') : (row.headers || []),
    data: typeof row.data === 'string' ? JSON.parse(row.data || '[]') : (row.data || []),
  };
}

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
        if (rows.length === 0) return resolve({ headers: [], data: [] });
        const headers = rows[0].map((h) => (h ? h.toString() : ''));
        const data = rows.slice(1).filter((row) => row.length > 0);
        return resolve({ headers, data });
      } else {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!jsonData || jsonData.length === 0) return resolve({ headers: [], data: [] });
        // Auto-detect header row: skip title/subtitle rows (1-2 non-empty cells)
        let headerRowIdx = 0;
        while (headerRowIdx < jsonData.length) {
          const row = jsonData[headerRowIdx];
          const nonEmpty = Array.isArray(row) ? row.filter(v => v !== '' && v !== null && v !== undefined).length : 0;
          if (nonEmpty >= 3) break;
          headerRowIdx++;
        }
        if (headerRowIdx >= jsonData.length) headerRowIdx = 0; // fallback
        const headers = jsonData[headerRowIdx].map((h) => (h ? h.toString() : ''));
        const data = jsonData.slice(headerRowIdx + 1).filter((row) => row.length > 0);
        resolve({ headers, data });
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function getR5ShopVisibilitySetting() {
  const entry = await getAppSetting(R5_SHOP_VISIBILITY_KEY);
  if (!entry || entry.value == null) return false;
  return String(entry.value).toLowerCase() === 'true';
}

async function setR5ShopVisibilitySetting(enabled) {
  return setAppSetting(R5_SHOP_VISIBILITY_KEY, enabled ? 'true' : 'false');
}

// (Behalten für Legacy-Kompatibilität)
function findColumnIndex(headers, possibleNames) {
  if (!Array.isArray(headers)) return undefined;
  const normalizedHeaders = headers.map((h) => (h ? h.toString().trim().toLowerCase() : ''));
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
    const row = await get('SELECT id FROM users WHERE governor_id = $1 LIMIT 1', [governorId]);
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
          if (String(value).trim() === governorId) return true;
        }
      }
    }
  } catch (e) {
    console.error('Error while searching governorId:', e);
    return false;
  }
  return false;
}

async function findKingdomBySlug(slug) {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  try {
    return await get(
      'SELECT id, display_name, slug, rok_identifier, status, plan, created_at, updated_at FROM kingdoms WHERE LOWER(slug) = $1 LIMIT 1',
      [normalized]
    );
  } catch (error) {
    console.error('Error fetching kingdom by slug:', error);
    return null;
  }
}

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(base) {
  let slug = base;
  let counter = 1;
  while (slug && (await findKingdomBySlug(slug))) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

async function ensureFilesBelongToKingdom(fileIds = [], kingdomId) {
  if (!kingdomId) throw new Error('No kingdom specified');

  for (const fileId of fileIds.filter(Boolean)) {
    const table = fileId.startsWith('ov-')
      ? 'overview_files'
      : fileId.startsWith('hon-')
      ? 'honor_files'
      : fileId.startsWith('act-')
      ? 'activity_files'
      : null;

    if (!table) throw new Error(`Unknown file type for ${fileId}`);

    const record = await get(`SELECT kingdom_id FROM ${table} WHERE id = $1`, [fileId]);
    if (!record) throw new Error(`File ${fileId} was not found.`);
    if (record.kingdom_id !== kingdomId) {
      throw new Error(`File ${fileId} does not belong to this kingdom.`);
    }
  }
}

async function resolveKingdomIdFromRequest(req, { allowDefaultForAdmin = false } = {}) {
  const { role, kingdomId } = req.user || {};
  let targetKingdomId = kingdomId || null;

  if (req.query && req.query.slug) {
    const k = await findKingdomBySlug(req.query.slug);
    if (!k) throw new Error('Invalid kingdom slug');

    if (role !== 'admin' && kingdomId && kingdomId !== k.id) {
      throw new Error('No access to this kingdom. Please use the public view.');
    }

    targetKingdomId = k.id;
  }

  if (!targetKingdomId && allowDefaultForAdmin && role === 'admin') {
    targetKingdomId = 'kdm-default';
  }

  if (!targetKingdomId) {
    throw new Error('No kingdom context found');
  }

  return targetKingdomId;
}

module.exports = {
  normalizeFileRow,
  parseExcel,
  getR5ShopVisibilitySetting,
  setR5ShopVisibilitySetting,
  findColumnIndex,
  userGovIdExists,
  governorIdExists,
  findKingdomBySlug,
  slugify,
  generateUniqueSlug,
  ensureFilesBelongToKingdom,
  resolveKingdomIdFromRequest,
};
