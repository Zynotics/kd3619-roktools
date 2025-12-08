import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { KvkEvent, UploadedFile, CreateKvkEventPayload, KvkFight } from '../types';
import { fetchKvkEvents, createKvkEvent, updateKvkEvent, deleteKvkEvent, API_BASE_URL } from '../api';
import FileReorderList from './FileReorderList';

const generateTempId = () => Math.random().toString(36).substring(2, 11);

const KvkManager: React.FC = () => {
  const { token, user } = useAuth();
  
  // --- Data State ---
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Editing State ---
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // --- Form State ---
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedHonorFileIds, setSelectedHonorFileIds] = useState<string[]>([]);
  const [fights, setFights] = useState<KvkFight[]>([]); 

  // --- Temporary Fight Input State ---
  const [tempFightName, setTempFightName] = useState('');
  const [tempStartFileId, setTempStartFileId] = useState('');
  const [tempEndFileId, setTempEndFileId] = useState('');

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const eventsData = await fetchKvkEvents();
      setEvents(eventsData);

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

  // --- Reset Form ---
  const resetForm = () => {
    setEditingEventId(null);
    setName('');
    setIsPublic(false);
    setSelectedHonorFileIds([]);
    setFights([]);
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  // --- Edit Mode Trigger ---
  const handleEditClick = (ev: KvkEvent) => {
    setEditingEventId(ev.id);
    setName(ev.name);
    setIsPublic(ev.isPublic);
    // Sicherstellen, dass Arrays existieren
    setSelectedHonorFileIds(ev.honorFileIds || []);
    setFights(ev.fights || []);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Fight Management ---
  const handleAddFight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempFightName || !tempStartFileId || !tempEndFileId) {
        alert("Bitte Name, Start-Datei und End-Datei für den Kampf auswählen.");
        return;
    }

    const newFight: KvkFight = {
        id: generateTempId(),
        name: tempFightName,
        startFileId: tempStartFileId,
        endFileId: tempEndFileId
    };

    setFights([...fights, newFight]);
    
    // Reset Inputs, aber nicht die Listen
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  const handleRemoveFight = (id: string) => {
      setFights(fights.filter(f => f.id !== id));
  };

  // --- Create or Update Event ---
  const handleSubmit = async () => {
    if (!name) {
      alert('Bitte einen Event-Namen angeben.');
      return;
    }
    
    const payload: CreateKvkEventPayload = {
        name,
        fights,
        honorFileIds: selectedHonorFileIds,
        isPublic,
    };

    setLoading(true);
    try {
        if (editingEventId) {
            // UPDATE
            await updateKvkEvent(editingEventId, payload);
            alert('Event erfolgreich aktualisiert!');
        } else {
            // CREATE
            await createKvkEvent(payload);
            alert('Event erfolgreich erstellt!');
        }
        resetForm();
        loadData();
    } catch (err: any) {
        alert(err.message || 'Fehler beim Speichern');
    } finally {
        setLoading(false);
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

  const toggleHonorFile = (id: string) => {
    setSelectedHonorFileIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getFileName = (id: string) => {
      const f = overviewFiles.find(file => file.id === id);
      return f ? f.name : 'Unbekannte Datei';
  };

  if (!user) {
    return <div className="p-4 text-red-500">Zugriff verweigert.</div>;
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-yellow-500">⚔️ KvK Manager</h1>
        {editingEventId && (
            <button onClick={resetForm} className="text-gray-400 hover:text-white underline">
                Bearbeitung abbrechen
            </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-800 text-white rounded">{error}</div>}

      {/* --- FORM SECTION (Create & Edit) --- */}
      <div className={`p-6 rounded-lg shadow-lg mb-8 border ${editingEventId ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
        <h2 className="text-xl font-semibold mb-6 text-white border-b border-gray-600 pb-2 flex items-center">
            {editingEventId ? (
                <>✏️ Event bearbeiten: <span className="ml-2 text-blue-300">{name}</span></>
            ) : (
                <>✨ Neues Event erstellen</>
            )}
        </h2>
        
        <div className="space-y-6">
          
          {/* 1. Basic Info */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Event Name</label>
              <input 
                type="text" 
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                placeholder="z.B. KvK Season 3"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="w-32 flex items-center justify-center pt-6">
              <label className="flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  className="mr-2 w-5 h-5 accent-yellow-500 cursor-pointer"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                />
                <span className={isPublic ? "text-green-400 font-bold" : "text-gray-500"}>
                  {isPublic ? 'Öffentlich' : 'Privat'}
                </span>
              </label>
            </div>
          </div>

          {/* 2. Fight Builder */}
          <div className="bg-gray-900/50 p-4 rounded border border-gray-600">
              <h3 className="text-lg font-medium text-yellow-200 mb-3">Kampf-Phasen</h3>
              
              {/* Existing Fights List */}
              <div className="mb-4 space-y-2">
                  {fights.length === 0 && <p className="text-gray-500 text-sm italic">Noch keine Phasen definiert.</p>}
                  {fights.map((fight, idx) => (
                      <div key={fight.id || idx} className="flex items-center bg-gray-800 p-2 rounded border border-gray-700">
                          <span className="bg-yellow-900 text-yellow-200 text-xs px-2 py-1 rounded mr-3">{idx + 1}</span>
                          <div className="flex-1">
                              <div className="font-bold text-sm text-white">{fight.name}</div>
                              <div className="text-xs text-gray-400 flex gap-4 mt-1">
                                  <span>Start: <span className="text-gray-300">{getFileName(fight.startFileId)}</span></span>
                                  <span>➜</span>
                                  <span>Ende: <span className="text-gray-300">{getFileName(fight.endFileId)}</span></span>
                              </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveFight(fight.id)}
                            className="ml-4 text-red-400 hover:bg-red-900/30 p-2 rounded"
                          >
                              🗑️
                          </button>
                      </div>
                  ))}
              </div>

              {/* Add New Fight Form */}
              <div className="bg-gray-800 p-3 rounded border border-gray-600">
                  <div className="text-xs text-gray-400 mb-2 uppercase font-bold">Neue Phase hinzufügen</div>
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                      <div className="md:col-span-2">
                          <input 
                              type="text" 
                              placeholder="Name (z.B. Pass 4)" 
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                              value={tempFightName}
                              onChange={e => setTempFightName(e.target.value)}
                          />
                      </div>
                      <div className="md:col-span-2">
                          <select 
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                              value={tempStartFileId}
                              onChange={e => setTempStartFileId(e.target.value)}
                          >
                              <option value="">Start-Snapshot wählen...</option>
                              {overviewFiles.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                          </select>
                      </div>
                      <div className="md:col-span-2">
                          <select 
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                              value={tempEndFileId}
                              onChange={e => setTempEndFileId(e.target.value)}
                          >
                              <option value="">End-Snapshot wählen...</option>
                              {overviewFiles.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                          </select>
                      </div>
                      <div className="md:col-span-1">
                          <button 
                            onClick={handleAddFight}
                            className="w-full py-1 bg-green-700 hover:bg-green-600 text-white text-sm font-bold rounded transition"
                          >
                              Hinzufügen
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          {/* 3. Honor Files */}
          <div className="p-4 bg-gray-900/50 rounded border border-gray-600">
            <h3 className="text-lg font-medium text-purple-300 mb-2">Honor Tracking Dateien</h3>
            <div className="max-h-32 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {honorFiles.length === 0 && <span className="text-gray-500 italic">Keine Honor-Dateien hochgeladen.</span>}
              {honorFiles.map(f => (
                <label key={f.id} className={`flex items-center space-x-2 p-1 rounded cursor-pointer ${selectedHonorFileIds.includes(f.id) ? 'bg-purple-900/40' : 'hover:bg-gray-800'}`}>
                  <input 
                    type="checkbox"
                    checked={selectedHonorFileIds.includes(f.id)}
                    onChange={() => toggleHonorFile(f.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-gray-300 truncate">{f.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-3 px-4 font-bold text-lg rounded shadow transition transform hover:scale-[1.01] ${
                editingEventId 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500' 
                : 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black hover:from-yellow-500'
            }`}
          >
            {loading ? 'Verarbeite...' : (editingEventId ? '💾 Änderungen Speichern' : '🚀 Event Erstellen')}
          </button>
        </div>
      </div>

      {/* --- EVENT LIST --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Existierende Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-400">Keine Events vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 uppercase text-xs">
                  <th className="p-3">Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Konfiguration</th>
                  <th className="p-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-700">
                {events.map(ev => (
                    <tr key={ev.id} className={`hover:bg-gray-750 transition-colors ${editingEventId === ev.id ? 'bg-blue-900/20' : ''}`}>
                      <td className="p-3 font-bold text-white">{ev.name}</td>
                      <td className="p-3">
                        {ev.isPublic 
                            ? <span className="px-2 py-0.5 rounded text-xs bg-green-900 text-green-200 border border-green-700">Public</span>
                            : <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">Private</span>
                        }
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-yellow-200 text-xs">
                                ⚔️ {ev.fights?.length || 0} Phasen
                            </span>
                            <span className="text-purple-300 text-xs">
                                🎖️ {ev.honorFileIds?.length || 0} Dateien
                            </span>
                        </div>
                      </td>
                      <td className="p-3 text-right space-x-3">
                        <button 
                          onClick={() => handleEditClick(ev)}
                          className="text-blue-400 hover:text-blue-200 text-xs font-bold uppercase"
                        >
                          Bearbeiten
                        </button>
                        <button 
                          onClick={() => handleDelete(ev.id)}
                          className="text-red-400 hover:text-red-200 text-xs font-bold uppercase"
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- FILE MANAGEMENT --- */}
      <div className="mt-12 pt-8 border-t border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">📂 Datei-Rohdaten Verwaltung</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FileReorderList type="overview" files={overviewFiles} onUpdate={loadData} />
              <FileReorderList type="honor" files={honorFiles} onUpdate={loadData} />
          </div>
      </div>
    </div>
  );
};

export default KvkManager;