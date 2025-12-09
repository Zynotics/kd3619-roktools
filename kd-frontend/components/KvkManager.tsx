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
  
  // Honor Range Selection
  const [honorStartId, setHonorStartId] = useState('');
  const [honorEndId, setHonorEndId] = useState('');

  // Fights List
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
      setError('Failed to load data from server.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingEventId(null);
    setName('');
    setIsPublic(false);
    setHonorStartId('');
    setHonorEndId('');
    setFights([]);
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  const handleEditClick = (ev: KvkEvent) => {
    setEditingEventId(ev.id);
    setName(ev.name);
    setIsPublic(ev.isPublic);
    setHonorStartId(ev.honorStartFileId || '');
    setHonorEndId(ev.honorEndFileId || '');
    setFights(ev.fights || []);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Upload Helper ---
  const handleDirectUpload = async (file: File, type: 'overview' | 'honor') => {
      if (!file) return;
      
      const formData = new FormData();
      formData.append('file', file);
      
      const endpoint = type === 'overview' ? '/overview/upload' : '/honor/upload';
      const label = type === 'overview' ? 'Overview' : 'Honor';

      try {
          setLoading(true);
          const res = await fetch(`${API_BASE_URL}${endpoint}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData
          });
          
          if (!res.ok) throw new Error('Upload failed');
          
          await loadData(); // Refresh lists
          alert(`${label} file uploaded successfully!`);
      } catch (e) {
          alert(`Error uploading ${label} file.`);
      } finally {
          setLoading(false);
      }
  };

  // --- Fight Logic ---
  const handleAddFight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempFightName || !tempStartFileId || !tempEndFileId) {
        alert("Please provide a Name, Start Snapshot, and End Snapshot for this battle phase.");
        return;
    }

    const newFight: KvkFight = {
        id: generateTempId(),
        name: tempFightName,
        startFileId: tempStartFileId,
        endFileId: tempEndFileId
    };

    setFights([...fights, newFight]);
    
    // Reset inputs for next entry
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  const handleRemoveFight = (id: string) => {
      setFights(fights.filter(f => f.id !== id));
  };

  // --- Submit Logic ---
  const handleSubmit = async () => {
    if (!name) {
      alert('Please enter an Event Name.');
      return;
    }
    
    const payload: CreateKvkEventPayload = {
        name,
        fights,
        honorStartFileId: honorStartId,
        honorEndFileId: honorEndId,
        isPublic,
    };

    setLoading(true);
    try {
        if (editingEventId) {
            await updateKvkEvent(editingEventId, payload);
            alert('Event successfully updated!');
        } else {
            await createKvkEvent(payload);
            alert('Event successfully created!');
        }
        resetForm();
        loadData();
    } catch (err: any) {
        alert(err.message || 'Error saving event');
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteKvkEvent(id);
      loadData();
    } catch (err) {
      alert('Error deleting event');
    }
  };

  // Helper to display file names safely
  const getFileName = (id: string, list: UploadedFile[]) => {
      const f = list.find(file => file.id === id);
      return f ? f.name : 'Unknown File';
  };

  if (!user || (user.role !== 'admin' && user.role !== 'r5')) {
    return <div className="p-8 text-center text-red-500 font-bold">Access Denied. Admins or R5 only.</div>;
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen font-sans">
      
      {/* HEADER & UPLOADS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-700 pb-6">
        <div>
            <h1 className="text-3xl font-bold text-yellow-500 tracking-wide">⚔️ KvK Event Manager</h1>
            <p className="text-gray-400 text-sm mt-1">Configure battle phases and honor tracking ranges.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
             {/* Unified Upload Button: Overview */}
             <div className="relative overflow-hidden group">
                <button className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded shadow-md font-medium flex items-center transition-colors">
                    <span className="mr-2">⬆️</span> Upload Overview
                </button>
                <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv"
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={(e) => e.target.files && handleDirectUpload(e.target.files[0], 'overview')}
                />
             </div>

             {/* Unified Upload Button: Honor */}
             <div className="relative overflow-hidden group">
                <button className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded shadow-md font-medium flex items-center transition-colors">
                    <span className="mr-2">⬆️</span> Upload Honor
                </button>
                <input 
                    type="file" 
                    accept=".xlsx,.xls,.csv"
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={(e) => e.target.files && handleDirectUpload(e.target.files[0], 'honor')}
                />
             </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded">{error}</div>}

      {/* --- EVENT EDITOR --- */}
      <div className={`p-6 rounded-xl shadow-lg mb-10 border transition-colors duration-300 ${editingEventId ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex justify-between items-center mb-6 border-b border-gray-600 pb-3">
            <h2 className="text-xl font-bold text-white flex items-center">
                {editingEventId ? (
                    <>✏️ Edit Event: <span className="ml-2 text-blue-300 font-mono">{name}</span></>
                ) : (
                    <>✨ Create New Event</>
                )}
            </h2>
            {editingEventId && (
                <button onClick={resetForm} className="text-gray-400 hover:text-white underline text-sm">
                    Cancel Editing
                </button>
            )}
        </div>
        
        <div className="space-y-8">
          
          {/* 1. MAIN SETTINGS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Event Name</label>
              <input 
                type="text" 
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                placeholder="e.g. KvK Season 3 - The Great War"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="md:col-span-1 flex items-end pb-2">
              <label className="flex items-center cursor-pointer select-none group">
                <input 
                  type="checkbox" 
                  className="mr-3 w-5 h-5 accent-green-500 cursor-pointer"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                />
                <div className="flex flex-col">
                    <span className={`font-bold ${isPublic ? "text-green-400" : "text-gray-500"}`}>
                    {isPublic ? 'Public Visible' : 'Private Draft'}
                    </span>
                    <span className="text-[10px] text-gray-500">
                        {isPublic ? 'Visible to everyone' : 'Only admins can see this'}
                    </span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              {/* 2. AREA A: FIGHTS */}
              <div className="bg-gray-900/40 p-5 rounded-lg border border-gray-600/50">
                  <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-yellow-500">⚔️ Battle Phases (Fights)</h3>
                        <p className="text-xs text-gray-400">Define precise battle windows. Growth between fights is ignored.</p>
                      </div>
                      <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full">{fights.length} Fights</span>
                  </div>
                  
                  {/* Fights List */}
                  <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {fights.length === 0 && <div className="text-gray-500 text-sm italic text-center py-4 border border-dashed border-gray-700 rounded">No fights defined yet.</div>}
                      {fights.map((fight, idx) => (
                          <div key={fight.id || idx} className="bg-gray-800 p-3 rounded border border-gray-700 flex items-center justify-between group hover:border-gray-500 transition-colors">
                              <div className="overflow-hidden">
                                  <div className="font-bold text-sm text-white flex items-center">
                                      <span className="bg-yellow-900/50 text-yellow-200 text-[10px] px-1.5 py-0.5 rounded mr-2">#{idx + 1}</span>
                                      {fight.name}
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-1 grid grid-cols-[auto_1fr] gap-x-2 items-center">
                                      <span className="text-green-500/70">START:</span> 
                                      <span className="truncate">{getFileName(fight.startFileId, overviewFiles)}</span>
                                      <span className="text-red-500/70">END:</span>
                                      <span className="truncate">{getFileName(fight.endFileId, overviewFiles)}</span>
                                  </div>
                              </div>
                              <button 
                                onClick={() => handleRemoveFight(fight.id)}
                                className="ml-2 text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                                title="Remove Fight"
                              >
                                  ✕
                              </button>
                          </div>
                      ))}
                  </div>

                  {/* Add Fight Inputs */}
                  <div className="bg-gray-800 p-3 rounded border border-gray-600">
                      <label className="text-[10px] text-gray-400 uppercase font-bold mb-2 block">Add New Phase</label>
                      <div className="flex flex-col gap-2">
                          <input 
                              type="text" 
                              placeholder="Fight Name (e.g. Ruins Fight 1)" 
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-yellow-500 outline-none"
                              value={tempFightName}
                              onChange={e => setTempFightName(e.target.value)}
                          />
                          <div className="grid grid-cols-2 gap-2">
                              <select 
                                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-yellow-500 outline-none"
                                  value={tempStartFileId}
                                  onChange={e => setTempStartFileId(e.target.value)}
                              >
                                  <option value="">-- Start Snapshot --</option>
                                  {overviewFiles.map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                              </select>
                              <select 
                                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-yellow-500 outline-none"
                                  value={tempEndFileId}
                                  onChange={e => setTempEndFileId(e.target.value)}
                              >
                                  <option value="">-- End Snapshot --</option>
                                  {overviewFiles.map(f => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                  ))}
                              </select>
                          </div>
                          <button 
                            onClick={handleAddFight}
                            className="mt-1 w-full py-1.5 bg-gray-600 hover:bg-yellow-600 hover:text-black text-white text-xs font-bold uppercase rounded transition-colors"
                          >
                              + Add Fight
                          </button>
                      </div>
                  </div>
              </div>

              {/* 3. AREA B: HONOR */}
              <div className="bg-gray-900/40 p-5 rounded-lg border border-gray-600/50 flex flex-col">
                <div>
                    <h3 className="text-lg font-bold text-purple-400">🎖️ Honor Tracking</h3>
                    <p className="text-xs text-gray-400 mb-4">Select the overall timeframe for honor points. All files uploaded between Start and End will be graphed.</p>
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-6">
                    <div>
                        <label className="block text-xs text-purple-300 mb-1 font-bold uppercase">Start File (Beginning of KvK)</label>
                        <select 
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            value={honorStartId}
                            onChange={e => setHonorStartId(e.target.value)}
                        >
                            <option value="">-- Select Start --</option>
                            {honorFiles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center text-purple-500 text-2xl">⬇️</div>

                    <div>
                        <label className="block text-xs text-purple-300 mb-1 font-bold uppercase">End File (Latest Scan)</label>
                        <select 
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            value={honorEndId}
                            onChange={e => setHonorEndId(e.target.value)}
                        >
                            <option value="">-- Select End --</option>
                            {honorFiles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
              </div>

          </div>

          {/* 4. MAIN ACTION BUTTON */}
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 px-6 font-bold text-xl rounded shadow-lg transition-all transform hover:scale-[1.005] active:scale-[0.99] ${
                editingEventId 
                ? 'bg-gradient-to-r from-blue-700 to-blue-500 text-white hover:from-blue-600 hover:to-blue-400' 
                : 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black hover:from-yellow-500 hover:to-yellow-400'
            }`}
          >
            {loading ? 'Processing...' : (editingEventId ? '💾 Save Changes' : '🚀 Create Event')}
          </button>
        </div>
      </div>

      {/* --- EVENT LIST TABLE --- */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
        <h2 className="text-xl font-semibold mb-4 text-white">Manage Existing Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-400 italic py-4">No events found. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700 uppercase text-xs">
                  <th className="p-3">Event Name</th>
                  <th className="p-3 text-center">Visibility</th>
                  <th className="p-3">Config</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-700">
                {events.map(ev => (
                    <tr key={ev.id} className={`hover:bg-gray-700/50 transition-colors ${editingEventId === ev.id ? 'bg-blue-900/20' : ''}`}>
                      <td className="p-3 font-bold text-white text-lg">{ev.name}</td>
                      <td className="p-3 text-center">
                        {ev.isPublic 
                            ? <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-900 text-green-200 border border-green-700 font-bold">Public</span>
                            : <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 border border-gray-600">Private</span>
                        }
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center text-yellow-500 font-medium">
                                <span className="w-20 text-xs text-gray-500 uppercase">Fights:</span>
                                ⚔️ {ev.fights?.length || 0}
                            </div>
                            <div className="flex items-center text-purple-400 font-medium">
                                <span className="w-20 text-xs text-gray-500 uppercase">Honor:</span>
                                {ev.honorStartFileId && ev.honorEndFileId ? '✅ Configured' : '⚠️ Missing'}
                            </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleEditClick(ev)}
                              className="bg-blue-900/40 hover:bg-blue-800 text-blue-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(ev.id)}
                              className="bg-red-900/40 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                            >
                              Delete
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- REORDER COMPONENT SECTION --- */}
      <div className="mt-12 pt-8 border-t border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">📂 File Organization</h2>
          <p className="text-gray-400 text-sm mb-4">Drag and drop files to change the default order in history charts.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FileReorderList type="overview" files={overviewFiles} onUpdate={loadData} />
              <FileReorderList type="honor" files={honorFiles} onUpdate={loadData} />
          </div>
      </div>
    </div>
  );
};

export default KvkManager;