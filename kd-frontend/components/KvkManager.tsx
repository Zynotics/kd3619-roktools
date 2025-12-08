import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { KvkEvent, UploadedFile, CreateKvkEventPayload, KvkFight } from '../types';
import { fetchKvkEvents, createKvkEvent, deleteKvkEvent, API_BASE_URL } from '../api';
import FileReorderList from './FileReorderList';

// Einfache ID-Generator Funktion für das Frontend (statt externer UUID Library)
const generateTempId = () => Math.random().toString(36).substring(2, 11);

const KvkManager: React.FC = () => {
  const { token, user } = useAuth();
  
  // --- Daten-State ---
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Form-State für neues Event ---
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedHonorFileIds, setSelectedHonorFileIds] = useState<string[]>([]);

  // --- Form-State für "Fight Builder" ---
  const [fights, setFights] = useState<KvkFight[]>([]); // Liste der geplanten Kämpfe
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
      // 1. Events laden
      const eventsData = await fetchKvkEvents();
      setEvents(eventsData);

      // 2. Dateien laden
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

  // --- Fight Builder Logik ---
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
    
    // Reset Fight Inputs
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  const handleRemoveFight = (id: string) => {
      setFights(fights.filter(f => f.id !== id));
  };

  // --- Event Erstellung ---
  const handleCreateEvent = async () => {
    if (!name) {
      alert('Bitte einen Event-Namen angeben.');
      return;
    }
    if (fights.length === 0) {
        if(!window.confirm("Es wurden keine Kampf-Phasen definiert. Möchtest du das Event wirklich ohne Kämpfe anlegen?")) return;
    }

    try {
      const payload: CreateKvkEventPayload = {
        name,
        fights: fights, // Hier übergeben wir das Array der Kämpfe
        honorFileIds: selectedHonorFileIds,
        isPublic,
      };

      await createKvkEvent(payload);
      
      // Reset Main Form
      setName('');
      setFights([]);
      setSelectedHonorFileIds([]);
      setIsPublic(false);
      
      // Reset Fight Inputs (zur Sicherheit)
      setTempFightName('');
      setTempStartFileId('');
      setTempEndFileId('');

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

  const toggleHonorFile = (id: string) => {
    setSelectedHonorFileIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Helper zum Finden von Dateinamen für die Anzeige
  const getFileName = (id: string) => {
      const f = overviewFiles.find(file => file.id === id);
      return f ? f.name : 'Unbekannte Datei';
  };

  if (!user || (user.role !== 'r5' && user.role !== 'admin')) {
    return <div className="p-4 text-red-500">Zugriff verweigert. Nur für R5/Admin.</div>;
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-yellow-500">⚔️ KvK Manager (Modular)</h1>

      {error && <div className="mb-4 p-3 bg-red-800 text-white rounded">{error}</div>}

      {/* --- CREATE EVENT SECTION --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8 border border-gray-700">
        <h2 className="text-xl font-semibold mb-6 text-white border-b border-gray-700 pb-2">Neues Event konfigurieren</h2>
        
        <div className="space-y-6">
          
          {/* 1. Basic Info */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Event Name (z.B. "KvK Season 3")</label>
              <input 
                type="text" 
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                placeholder="Name des Events"
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

          {/* 2. Fight Builder Area */}
          <div className="bg-gray-750 bg-opacity-40 p-4 rounded border border-gray-600">
              <h3 className="text-lg font-medium text-yellow-200 mb-3">Bereich A: Kampf-Phasen ("Fights")</h3>
              <p className="text-xs text-gray-400 mb-4">Definiere hier einzelne Kämpfe (z.B. "Pass 4"). Wähle den Snapshot DAVOR und DANACH. Zeiträume zwischen Kämpfen werden ignoriert.</p>
              
              {/* Form to add a single fight */}
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end mb-4">
                  <div className="md:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Kampf Name</label>
                      <input 
                          type="text" 
                          placeholder="z.B. Ruins Fight 1" 
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                          value={tempFightName}
                          onChange={e => setTempFightName(e.target.value)}
                      />
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">Start Snapshot</label>
                      <select 
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                          value={tempStartFileId}
                          onChange={e => setTempStartFileId(e.target.value)}
                      >
                          <option value="">-- Datei wählen --</option>
                          {overviewFiles.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                      </select>
                  </div>
                  <div className="md:col-span-2">
                      <label className="block text-xs text-gray-400 mb-1">End Snapshot</label>
                      <select 
                          className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                          value={tempEndFileId}
                          onChange={e => setTempEndFileId(e.target.value)}
                      >
                          <option value="">-- Datei wählen --</option>
                          {overviewFiles.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                      </select>
                  </div>
                  <div className="md:col-span-1">
                      <button 
                        onClick={handleAddFight}
                        className="w-full py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded"
                      >
                          + Add
                      </button>
                  </div>
              </div>

              {/* List of added fights */}
              {fights.length > 0 && (
                  <div className="mt-2 bg-gray-900 rounded border border-gray-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-800 text-gray-400">
                              <tr>
                                  <th className="p-2">Kampf Name</th>
                                  <th className="p-2">Start</th>
                                  <th className="p-2">Ende</th>
                                  <th className="p-2 w-20"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700">
                              {fights.map((fight, idx) => (
                                  <tr key={fight.id || idx}>
                                      <td className="p-2 text-yellow-100 font-medium">{fight.name}</td>
                                      <td className="p-2 text-gray-400 text-xs truncate max-w-[150px]">{getFileName(fight.startFileId)}</td>
                                      <td className="p-2 text-gray-400 text-xs truncate max-w-[150px]">{getFileName(fight.endFileId)}</td>
                                      <td className="p-2 text-right">
                                          <button 
                                            onClick={() => handleRemoveFight(fight.id)}
                                            className="text-red-400 hover:text-red-200 text-xs uppercase font-bold"
                                          >
                                              Entf.
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>

          {/* 3. Honor Files Selection */}
          <div className="p-4 bg-gray-750 bg-opacity-40 rounded border border-gray-600">
            <h3 className="text-lg font-medium text-purple-300 mb-3">Bereich B: Honor (Ehrenpunkte)</h3>
            <p className="text-xs text-gray-400 mb-2">Wähle alle Honor-Scan Dateien aus, die den Verlauf über den gesamten KvK-Zeitraum zeigen.</p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 bg-gray-900 p-3 rounded border border-gray-700">
              {honorFiles.length === 0 && <span className="text-gray-500 italic">Keine Honor-Dateien gefunden.</span>}
              {honorFiles.map(f => (
                <label key={f.id} className="flex items-center space-x-2 p-1 hover:bg-gray-800 rounded cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={selectedHonorFileIds.includes(f.id)}
                    onChange={() => toggleHonorFile(f.id)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-gray-300 truncate" title={f.name}>{f.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. Submit Button */}
          <button 
            onClick={handleCreateEvent}
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold text-lg rounded shadow hover:from-yellow-500 hover:to-yellow-400 transition transform hover:scale-[1.01]"
          >
            {loading ? 'Speichere Event...' : '🚀 Event Erstellen'}
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
                  <th className="p-3">Sichtbarkeit</th>
                  <th className="p-3">Kämpfe</th>
                  <th className="p-3">Honor Files</th>
                  <th className="p-3">Erstellt am</th>
                  <th className="p-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-700">
                {events.map(ev => {
                  const fightCount = ev.fights ? ev.fights.length : 0;
                  const honorCount = ev.honorFileIds?.length || 0;

                  return (
                    <tr key={ev.id} className="hover:bg-gray-750 transition-colors">
                      <td className="p-3 font-bold text-white">{ev.name}</td>
                      <td className="p-3">
                        {ev.isPublic ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-200 border border-green-700">
                            Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600">
                            Privat
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-yellow-200">
                        {fightCount} Phasen
                        {fightCount > 0 && (
                            <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                                {ev.fights.map(f => f.name).join(", ")}
                            </div>
                        )}
                      </td>
                      <td className="p-3 text-purple-300">
                        {honorCount} Dateien
                      </td>
                      <td className="p-3 text-gray-500">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => handleDelete(ev.id)}
                          className="text-red-400 hover:text-red-200 hover:underline text-xs font-bold"
                        >
                          LÖSCHEN
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

      {/* --- FILE MANAGEMENT --- */}
      <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">📂 Allgemeine Dateiverwaltung</h2>
          <p className="text-gray-400 text-sm mb-6">
            Hier verwaltest du die "Rohdaten" (Uploads). Die Zuordnung zu Events passiert oben im Manager.
            Das Sortieren hier hat Einfluss auf die Reihenfolge in Standard-Diagrammen.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FileReorderList 
                type="overview" 
                files={overviewFiles} 
                onUpdate={loadData} 
              />
              <FileReorderList 
                type="honor" 
                files={honorFiles} 
                onUpdate={loadData} 
              />
          </div>
      </div>

    </div>
  );
};

export default KvkManager;