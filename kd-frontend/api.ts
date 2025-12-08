// api.ts
import { CreateKvkEventPayload, KvkEvent } from './types';

// Zentrale URL-Konfiguration
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

/**
 * Hilfsfunktion für Header mit Auth-Token
 */
function getAuthHeaders() {
  // Wir lesen 'authToken', wie es im AuthContext gesetzt wird
  const token = localStorage.getItem('authToken'); 
  
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Exportiere die URL für die Nutzung in Komponenten
export { API_BASE_URL };

// ==================== KVK ADMIN API ====================

/**
 * Holt alle KvK Events (für Admin/R5)
 * Endpoint: GET /api/admin/kvk/events
 */
export async function fetchKvkEvents(kingdomId?: string): Promise<KvkEvent[]> {
  let url = `${API_BASE_URL}/api/admin/kvk/events`;
  if (kingdomId) {
    url += `?kingdomId=${kingdomId}`;
  }
    
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch KvK events');
  }
  
  return res.json();
}

/**
 * Erstellt ein neues KvK Event (Modular: Mit Fights Array)
 * Endpoint: POST /api/admin/kvk/events
 */
export async function createKvkEvent(payload: CreateKvkEventPayload): Promise<KvkEvent> {
  const res = await fetch(`${API_BASE_URL}/api/admin/kvk/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create KvK event');
  }
  
  return res.json();
}

/**
 * Aktualisiert ein bestehendes KvK Event
 * Endpoint: PUT /api/admin/kvk/events/:id
 */
export async function updateKvkEvent(id: string, payload: Partial<CreateKvkEventPayload>): Promise<KvkEvent> {
  const res = await fetch(`${API_BASE_URL}/api/admin/kvk/events/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update KvK event');
  }
  
  return res.json();
}

/**
 * Löscht ein KvK Event
 * Endpoint: DELETE /api/admin/kvk/events/:id
 */
export async function deleteKvkEvent(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/kvk/events/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete KvK event');
  }
}

// ==================== PUBLIC API ====================

/**
 * Holt öffentliche KvK Events für ein Königreich
 * Endpoint: GET /api/public/kingdom/:slug/kvk-events
 */
export async function fetchPublicKvkEvents(kingdomSlug: string): Promise<KvkEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/public/kingdom/${kingdomSlug}/kvk-events`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch public KvK events');
  }
  
  return res.json();
}

// ==================== FILE MANAGEMENT API ====================

/**
 * Sortiert Dateien neu (Overview, Honor oder Activity)
 */
export async function reorderFiles(type: 'overview' | 'honor' | 'activity', fileIds: string[]): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/${type}/files/reorder`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ order: fileIds }),
    });

    if (!res.ok) {
        throw new Error('Failed to reorder files');
    }
}

/**
 * Löscht eine Datei
 */
export async function deleteFile(type: 'overview' | 'honor' | 'activity', fileId: string): Promise<void> {
     const res = await fetch(`${API_BASE_URL}/${type}/files/${fileId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!res.ok) {
        throw new Error('Failed to delete file');
    }
}