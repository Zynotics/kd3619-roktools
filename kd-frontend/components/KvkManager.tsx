import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { KvkEvent, UploadedFile, CreateKvkEventPayload } from '../types';
import { fetchKvkEvents, createKvkEvent, deleteKvkEvent } from '../api';
import { formatNumber } from '../utils'; // Optional, für schöne Darstellung falls nötig

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const KvkManager: React.FC = () => {
  const { token, user } = useAuth();
  
  // Daten-State
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form-State
  const [name, setName] = useState('');
  const [startFileId, setStartFileId] = useState('');
  const [endFileId, setEndFileId] = useState('');
  const [selectedHonorFileIds, setSelectedHonorFileIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Events laden
      const eventsData = await fetchKvkEvents();
      setEvents(eventsData);

      // 2. Dateien laden (Wir nutzen hier direkt fetch, da wir die Endpoints kennen)
      const ovRes = await fetch(`${API_BASE_URL}/overview/files-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ovRes.ok) setOverviewFiles(await ovRes.json());

      const honRes = await fetch(`${API_BASE_URL}/honor/files-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (honRes.ok) setHonorFiles(await honRes.json());

    } catch (err: any) {
      console.error(err);
      setError('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startFileId || !endFileId) {
      alert('Bitte Namen, Start-Datei und End-Datei angeben.');
      return;
    }

    try {
      const payload: CreateKvkEventPayload = {
        name,
        startFileId,
        endFileId,
        honorFileIds: selectedHonorFileIds,
        isPublic,
        // kingdomId wird im Backend automatisch vom User genommen (außer Admin überschreibt es)
      };

      await createKvkEvent(payload);
      
      // Reset Form
      setName('');
      setStartFileId('');
      setEndFileId('');
      setSelectedHonorFileIds([]);
      setIsPublic(false);
      
      // Reload
      loadData();
      alert('KvK Event erfolgreich angelegt!');
    } catch (err: any) {
      alert(err.message || 'Fehler beim Erstellen');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Event wirklich löschen?')) return;
    try {
      await deleteKvkEvent(id);
      loadData();
    } catch (err) {
      alert('Fehler beim Löschen');
    }
  };

  // Helper für Checkbox-Handling bei Honor Files
  const toggleHonorFile = (id: string) => {
    setSelectedHonorFileIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (!user || (user.role !== 'r5' && user.role !== 'admin')) {
    return <div className="p-4 text-red-500">Zugriff verweigert. Nur für R5/Admin.</div>;
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-yellow-500">⚔️ KvK Manager</h1>

      {error && <div className="mb-4 p-3 bg-red-800 text-white rounded">{error}</div>}

      {/* --- CREATE FORM --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Neues Event anlegen</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          
          {/* Name & Public Toggle */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Event Name</label>
              <input 
                type="text" 
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="z.B. KvK Season 3"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="w-32 flex items-center justify-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="mr-2 w-5 h-5 accent-yellow-500"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                />
                <span className={isPublic ? "text-green-400 font-bold" : "text-gray-500"}>
                  {isPublic ? 'Öffentlich' : 'Privat'}
                </span>
              </label>
            </div>
          </div>

          {/* Stats Config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-750 bg-opacity-50 rounded border border-gray-700">
            <div>
              <label className="block text-sm text-yellow-200 mb-1">Start-Datei (Basis)</label>
              <select 
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                value={startFileId}
                onChange={e => setStartFileId(e.target.value)}
              >
                <option value="">-- Wähle Start-Datei --</option>
                {overviewFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({new Date(f.uploadDate || '').toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-yellow-200 mb-1">End-Datei (Aktuell)</label>
              <select 
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                value={endFileId}
                onChange={e => setEndFileId(e.target.value)}
              >
                <option value="">-- Wähle End-Datei --</option>
                {overviewFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({new Date(f.uploadDate || '').toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Honor Config */}
          <div className="p-4 bg-gray-750 bg-opacity-50 rounded border border-gray-700">
            <label className="block text-sm text-purple-300 mb-2">Verknüpfte Honor-Dateien (für Ranking)</label>
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {honorFiles.length === 0 && <span className="text-gray-500 italic">Keine Honor-Dateien gefunden.</span>}
              {honorFiles.map(f => (
                <label key={f.id} className="flex items-center space-x-2 bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-600">
                  <input 
                    type="checkbox"
                    checked={selectedHonorFileIds.includes(f.id)}
                    onChange={() => toggleHonorFile(f.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs truncate" title={f.name}>{f.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2 px-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold rounded hover:from-yellow-500 hover:to-yellow-400 transition"
          >
            {loading ? 'Lädt...' : 'KvK Event Speichern'}
          </button>
        </form>
      </div>

      {/* --- EVENT LIST --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Aktive Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-400">Noch keine Events angelegt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="p-2">Name</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Stats Files</th>
                  <th className="p-2">Honor Files</th>
                  <th className="p-2 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {events.map(ev => {
                  const startF = overviewFiles.find(f => f.id === ev.startFileId);
                  const endF = overviewFiles.find(f => f.id === ev.endFileId);
                  const honorCount = ev.honorFileIds?.length || 0;

                  return (
                    <tr key={ev.id} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="p-2 font-medium text-white">{ev.name}</td>
                      <td className="p-2">
                        {ev.isPublic ? (
                          <span className="px-2 py-1 bg-green-900 text-green-200 rounded text-xs">Public</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Privat</span>
                        )}
                      </td>
                      <td className="p-2 text-gray-300">
                        <div className="flex flex-col text-xs">
                          <span title={startF?.name}>Start: {startF ? (startF.name.substring(0, 15) + '...') : <span className="text-red-400">Missing</span>}</span>
                          <span title={endF?.name}>Ende: {endF ? (endF.name.substring(0, 15) + '...') : <span className="text-red-400">Missing</span>}</span>
                        </div>
                      </td>
                      <td className="p-2 text-gray-300">
                        {honorCount} Dateien
                      </td>
                      <td className="p-2 text-right">
                        <button 
                          onClick={() => handleDelete(ev.id)}
                          className="text-red-400 hover:text-red-300 hover:underline"
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default KvkManager;