// routes/kvk.js – KvK Manager Endpoints

const express = require('express');
const {
  createKvkEvent, getKvkEvents, getAllKvkEvents, getKvkEventById, updateKvkEvent, deleteKvkEvent,
} = require('../db-pg');
const { authenticateToken, requireKvkManager } = require('../middleware/auth');
const { findKingdomBySlug, ensureFilesBelongToKingdom } = require('../helpers');
const { logActivity } = require('../helpers/logger');

const router = express.Router();

// Alle Events abrufen (mit optionaler Pagination via ?page=1&limit=20)
router.get('/', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let kingdomId = isAdmin ? (req.query.kingdomId || req.user.kingdomId) : req.user.kingdomId;

    if (!kingdomId && isAdmin && req.query.slug) {
      const kingdom = await findKingdomBySlug(req.query.slug);
      if (!kingdom) return res.status(400).json({ error: 'Invalid kingdom slug' });
      kingdomId = kingdom.id;
    }

    let events;
    if (!kingdomId && isAdmin) {
      events = await getAllKvkEvents();
    } else if (!kingdomId) {
      return res.status(400).json({ error: 'Kingdom ID is required' });
    } else {
      events = await getKvkEvents(kingdomId);
    }

    // Pagination (opt-in)
    if (req.query.page) {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const total = events.length;
      const paginated = events.slice((page - 1) * limit, page * limit);
      return res.json({ data: paginated, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load KvK events' });
  }
});

// Event erstellen
router.post('/', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const {
      name, fights, eventStartFileId, honorStartFileId, honorEndFileId,
      dkpFormula, goalsFormula, isPublic, rankingPublic, honorPublic,
      isRankingPublic, isHonorPublic, kingdomId: bodyKingdomId,
    } = req.body;

    let targetKingdomId = req.user.kingdomId;
    if (req.user.role === 'admin') {
      if (bodyKingdomId) {
        targetKingdomId = bodyKingdomId;
      } else if (req.query.slug) {
        const slugKingdom = await findKingdomBySlug(req.query.slug);
        if (!slugKingdom) return res.status(400).json({ error: 'Invalid kingdom slug' });
        targetKingdomId = slugKingdom.id;
      }
    }

    if (!targetKingdomId) return res.status(400).json({ error: 'No kingdom assigned.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    try {
      await ensureFilesBelongToKingdom([eventStartFileId, honorStartFileId, honorEndFileId], targetKingdomId);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const resolvedRankingPublic = rankingPublic ?? isRankingPublic;
    const resolvedHonorPublic = honorPublic ?? isHonorPublic;

    const newEvent = {
      id: 'kvk-' + Date.now(),
      name,
      kingdomId: targetKingdomId,
      fights: fights || [],
      eventStartFileId,
      honorStartFileId,
      honorEndFileId,
      dkpFormula: dkpFormula || null,
      goalsFormula: goalsFormula || null,
      isPublic: !!isPublic,
      isRankingPublic: resolvedRankingPublic ?? isPublic ?? true,
      isHonorPublic: resolvedHonorPublic ?? isPublic ?? true,
      createdAt: new Date().toISOString(),
    };

    const created = await createKvkEvent(newEvent);
    logActivity({ userId: req.user.id, username: req.user.username, role: req.user.role, action: 'kvk_event_create', entityType: 'kvk_event', entityId: newEvent.id, details: { name }, kingdomId: targetKingdomId });
    res.json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create KvK event' });
  }
});

// Event bearbeiten
router.put('/:id', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const {
      name, fights, eventStartFileId, honorStartFileId, honorEndFileId,
      dkpFormula, goalsFormula, isPublic, rankingPublic, honorPublic, isRankingPublic, isHonorPublic,
    } = req.body;
    const eventId = req.params.id;

    const existing = await getKvkEventById(eventId);
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      await ensureFilesBelongToKingdom([eventStartFileId, honorStartFileId, honorEndFileId], existing.kingdomId);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const resolvedRankingPublic = rankingPublic ?? isRankingPublic;
    const resolvedHonorPublic = honorPublic ?? isHonorPublic;

    const updated = await updateKvkEvent(eventId, {
      name, fights, eventStartFileId, honorStartFileId, honorEndFileId,
      dkpFormula: dkpFormula || null,
      goalsFormula: goalsFormula || null,
      isPublic,
      isRankingPublic: resolvedRankingPublic ?? existing.isRankingPublic ?? existing.isPublic,
      isHonorPublic: resolvedHonorPublic ?? existing.isHonorPublic ?? existing.isPublic,
    });
    logActivity({ userId: req.user.id, username: req.user.username, role: req.user.role, action: 'kvk_event_update', entityType: 'kvk_event', entityId: eventId, details: { name }, kingdomId: existing.kingdomId });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update KvK event' });
  }
});

// Event löschen
router.delete('/:id', authenticateToken, requireKvkManager, async (req, res) => {
  try {
    const existing = await getKvkEventById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (req.user.role !== 'admin' && existing.kingdomId !== req.user.kingdomId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await deleteKvkEvent(req.params.id);
    logActivity({ userId: req.user.id, username: req.user.username, role: req.user.role, action: 'kvk_event_delete', entityType: 'kvk_event', entityId: req.params.id, details: { name: existing.name }, kingdomId: existing.kingdomId });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete KvK event' });
  }
});

module.exports = router;
