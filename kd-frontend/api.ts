// api.ts
import { CreateKvkEventPayload, KvkEvent } from './types';

// Basis-URL (Nutzt Umgebungsvariable von Vite oder Fallback auf localhost)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Hilfsfunktion für Header mit Auth-Token
 */
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ==================== KVK ADMIN API ====================

/**
 * Holt alle KvK Events (für Admin/R5)
 * Optional: kingdomId filter
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
 * Erstellt ein neues KvK Event
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
 * Holt öffentliche KvK Events für ein Königreich (basierend auf Slug)
 */
export async function fetchPublicKvkEvents(kingdomSlug: string): Promise<KvkEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/public/kingdom/${kingdomSlug}/kvk-events`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch public KvK events');
  }
  
  return res.json();
}