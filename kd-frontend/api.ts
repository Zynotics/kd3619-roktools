// api.ts
import { CreateKvkEventPayload, KvkEvent } from './types';

// 🔧 KORREKTUR: Einheitliche URL-Logik wie in App.tsx
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

/**
 * Hilfsfunktion für Header mit Auth-Token
 */
function getAuthHeaders() {
  const token = localStorage.getItem('token'); // Achtung: Prüfe, ob du 'token' oder 'authToken' nutzt. App.tsx nutzt 'authToken' beim Redirect, Login nutzt 'token'.
  // Um sicherzugehen, nutzen wir hier das, was im AuthContext gespeichert wird (meist 'token').
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Exportiere die URL, damit Komponenten sie nutzen können
export { API_BASE_URL };

// ==================== KVK ADMIN API ====================

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

export async function fetchPublicKvkEvents(kingdomSlug: string): Promise<KvkEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/public/kingdom/${kingdomSlug}/kvk-events`);
  
  if (!res.ok) {
    throw new Error('Failed to fetch public KvK events');
  }
  
  return res.json();
}