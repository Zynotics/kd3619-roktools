import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { KvkEvent, UploadedFile, CreateKvkEventPayload, KvkFight, DkpFormula, GoalsFormula, GoalsPowerBracket } from '../types';
import { fetchKvkEvents, createKvkEvent, updateKvkEvent, deleteKvkEvent, API_BASE_URL } from '../api';
import FileReorderList from './FileReorderList';

const generateTempId = () => Math.random().toString(36).substring(2, 11);

const createDefaultDkpFormula = (): DkpFormula => ({
  t1: { enabled: false, points: 0 },
  t2: { enabled: false, points: 0 },
  t3: { enabled: false, points: 0 },
  t4: { enabled: false, points: 0 },
  t5: { enabled: false, points: 0 },
  deadTroops: { enabled: false, points: 0 },
});

const createDefaultGoalsFormula = (): GoalsFormula => ({
  basePowerToDkpPercent: 0,
  basePowerToDeadTroopsPercent: 0,
  powerBrackets: [],
});

const dkpCategories: { key: keyof DkpFormula; label: string; helper?: string }[] = [
  { key: 't1', label: 'T1 Kills' },
  { key: 't2', label: 'T2 Kills' },
  { key: 't3', label: 'T3 Kills' },
  { key: 't4', label: 'T4 Kills' },
  { key: 't5', label: 'T5 Kills' },
  { key: 'deadTroops', label: 'Dead Troops' },
];

const truncateToTwoDecimals = (value: number) => Math.trunc(value * 100) / 100;

const parseLocalizedDecimalInput = (value: string) => {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) return 0;
  return truncateToTwoDecimals(parsed);
};

const formatLocalizedDecimalValue = (value: number) => {
  if (!Number.isFinite(value)) return '';

  return truncateToTwoDecimals(value).toString().replace('.', ',');
};

const KvkManager: React.FC = () => {
  const { token, user } = useAuth();
  const queryParams = new URLSearchParams(window.location.search);
  const publicSlug = queryParams.get('slug');
  const adminSlugQuery = user?.role === 'admin' && publicSlug ? `?slug=${publicSlug}` : '';

  // --- Data State ---
  const [events, setEvents] = useState<KvkEvent[]>([]);
  const [overviewFiles, setOverviewFiles] = useState<UploadedFile[]>([]);
  const [honorFiles, setHonorFiles] = useState<UploadedFile[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- Editing State ---
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // --- Form State ---
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isRankingPublic, setIsRankingPublic] = useState(true);
  const [isHonorPublic, setIsHonorPublic] = useState(true);
  const [eventStartId, setEventStartId] = useState('');
  
  // Honor Range Selection
  const [honorStartId, setHonorStartId] = useState('');
  const [honorEndId, setHonorEndId] = useState('');

  // Fights List
  const [fights, setFights] = useState<KvkFight[]>([]);
  const [dkpFormula, setDkpFormula] = useState<DkpFormula>(createDefaultDkpFormula());
  const [goalsFormula, setGoalsFormula] = useState<GoalsFormula>(createDefaultGoalsFormula());

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
      const eventsData = await fetchKvkEvents(publicSlug ? { slug: publicSlug } : undefined);
      setEvents(eventsData);

      const ovRes = await fetch(`${API_BASE_URL}/overview/files-data${adminSlugQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (ovRes.ok) setOverviewFiles(await ovRes.json());

      const honRes = await fetch(`${API_BASE_URL}/honor/files-data${adminSlugQuery}`, {
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
    setIsRankingPublic(true);
    setIsHonorPublic(true);
    setEventStartId('');
    setHonorStartId('');
    setHonorEndId('');
    setFights([]);
    setDkpFormula(createDefaultDkpFormula());
    setGoalsFormula(createDefaultGoalsFormula());
    setTempFightName('');
    setTempStartFileId('');
    setTempEndFileId('');
  };

  const handleOpenCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditClick = (ev: KvkEvent) => {
    setEditingEventId(ev.id);
    setName(ev.name);
    setIsPublic(ev.isPublic);
    setIsRankingPublic(ev.isRankingPublic ?? ev.isPublic ?? true);
    setIsHonorPublic(ev.isHonorPublic ?? ev.isPublic ?? true);
    setEventStartId(ev.eventStartFileId || '');
    setHonorStartId(ev.honorStartFileId || '');
    setHonorEndId(ev.honorEndFileId || '');
    setFights(ev.fights || []);
    setDkpFormula(ev.dkpFormula || createDefaultDkpFormula());
    setGoalsFormula(ev.goalsFormula || createDefaultGoalsFormula());

    setIsFormOpen(true);
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

  const renderUploadButton = (type: 'overview' | 'honor') => {
    const label = type === 'overview' ? 'Analytics' : 'Honor';
    const colorClasses = type === 'overview'
      ? 'bg-blue-700 hover:bg-blue-600 group-hover:bg-blue-600'
      : 'bg-purple-700 hover:bg-purple-600 group-hover:bg-purple-600';

    return (
      <div className="relative overflow-hidden group">
        <button className={`${colorClasses} cursor-pointer text-white px-3 py-1.5 rounded shadow-md font-medium flex items-center transition-colors text-xs`}>
          <span className="mr-2">⬆️</span> Upload {label}
        </button>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => e.target.files && handleDirectUpload(e.target.files[0], type)}
        />
      </div>
    );
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

  const handleToggleDkp = (key: keyof DkpFormula, enabled: boolean) => {
    setDkpFormula(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled }
    }));
  };

  const handleDkpPointsChange = (key: keyof DkpFormula, points: number) => {
    setDkpFormula(prev => ({
      ...prev,
      [key]: { ...prev[key], points }
    }));
  };

  const handlePowerBracketChange = (
    index: number,
    field: 'minPower' | 'maxPower' | 'dkpPercent' | 'deadPercent',
    value: number | null
  ) => {
    setGoalsFormula(prev => {
      const currentBrackets = prev.powerBrackets || [];
      const nextBrackets = [...currentBrackets];
      const existing = nextBrackets[index] || { minPower: 0, maxPower: null, dkpPercent: 0, deadPercent: 0 };
      const updatedRange: GoalsPowerBracket = { ...existing, [field]: value } as GoalsPowerBracket;
      nextBrackets[index] = updatedRange;

      return { ...prev, powerBrackets: nextBrackets };
    });
  };

  const handleAddPowerBracket = () => {
    setGoalsFormula(prev => ({
      ...prev,
      powerBrackets: [
        ...(prev.powerBrackets || []),
        {
          minPower: 0,
          maxPower: null,
          dkpPercent: 0,
          deadPercent: 0,
        }
      ]
    }));
  };

  const handleRemovePowerBracket = (index: number) => {
    setGoalsFormula(prev => ({
      ...prev,
      powerBrackets: (prev.powerBrackets || []).filter((_, i) => i !== index)
    }));
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
        dkpFormula,
        goalsFormula,
        eventStartFileId: eventStartId,
        honorStartFileId: honorStartId,
        honorEndFileId: honorEndId,
        isPublic,
        isRankingPublic,
        isHonorPublic,
    };

    setLoading(true);
    try {
        if (editingEventId) {
            await updateKvkEvent(editingEventId, payload);
            alert('Event successfully updated!');
        } else {
            await createKvkEvent(payload);
            alert('Event successfully created!');
            resetForm();
        }
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

  const powerBrackets = goalsFormula.powerBrackets || [];
  const isEditorVisible = isFormOpen || !!editingEventId;

  const hasKvkAccess =
    !!user &&
    (user.role === 'admin' ||
      user.role === 'r5' ||
      (user.role === 'r4' && user.canAccessKvkManager));

  if (!hasKvkAccess) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Access Denied. Admins, R5, or authorized R4 only.
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-screen font-sans">
      
      {/* HEADER & UPLOADS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4 border-b border-gray-700 pb-6">
        <div>
            <h1 className="text-3xl font-bold text-yellow-500 tracking-wide">⚔️ KvK Event Manager</h1>
            <p className="text-gray-400 text-sm mt-1">Configure battle phases and honor tracking ranges.</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded">{error}</div>}

      <div className="flex justify-end mb-4">
        <button
          onClick={handleOpenCreateForm}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-4 py-2 rounded shadow transition-colors"
        >
          Create New Event
        </button>
      </div>

      {/* --- EVENT EDITOR --- */}
      {isEditorVisible && (
      <div className={`p-6 rounded-xl shadow-lg mb-10 border transition-colors duration-300 ${editingEventId ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
        <div className="flex justify-between items-center mb-6 border-b border-gray-600 pb-3">
            <h2 className="text-xl font-bold text-white flex items-center">
                {editingEventId ? (
                    <>✏️ Edit Event: <span className="ml-2 text-blue-300 font-mono">{name}</span></>
                ) : (
                    <>✨ Create New Event</>
                )}
            </h2>
            <div className="flex gap-3">
              {!editingEventId && isEditorVisible && (
                <button
                  onClick={() => { resetForm(); setIsFormOpen(false); }}
                  className="text-gray-400 hover:text-white underline text-sm"
                >
                  Close
                </button>
              )}
              {editingEventId && (
                  <button onClick={() => { resetForm(); setIsFormOpen(false); }} className="text-gray-400 hover:text-white underline text-sm">
                      Cancel Editing
                  </button>
              )}
            </div>
        </div>

        <div className="space-y-8">

          {/* 0. EVENT START SNAPSHOT */}
          <div className="bg-gray-900/40 p-5 rounded-lg border border-gray-600/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-cyan-300">🕛 Event Start Snapshot</h3>
                <p className="text-xs text-gray-400">Choose the day-0 scan to set the baseline for DKP goals and power calculations.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3 items-center">
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={eventStartId}
                onChange={e => setEventStartId(e.target.value)}
              >
                <option value="">-- Select event start snapshot --</option>
                {overviewFiles.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <div className="text-xs text-gray-500 bg-gray-800/70 border border-dashed border-gray-600 rounded p-3">
                <p className="font-semibold text-white mb-1">Note</p>
                <p>This snapshot sets the base power (day 0) for DKP and dead-troop goals. Any later growth is calculated from here.</p>
              </div>
            </div>
          </div>

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
            <div className="md:col-span-1 flex flex-col gap-3 pb-2">
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
                        {isPublic ? 'Visible to everyone' : 'Visible for R4/R5 of this kingdom'}
                    </span>
                </div>
              </label>

              <label className="flex items-start cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="mr-3 mt-0.5 w-4 h-4 accent-blue-400 cursor-pointer"
                  checked={isRankingPublic}
                  onChange={e => setIsRankingPublic(e.target.checked)}
                />
                <div className="flex flex-col leading-tight">
                  <span className={`font-semibold text-sm ${isRankingPublic ? 'text-blue-200' : 'text-gray-400'}`}>DKP Ranking</span>
                  <span className="text-[10px] text-gray-500">{isRankingPublic ? 'Leaderboard visible for public visitors' : 'Only R4/R5/Admin can see the ranking'}</span>
                </div>
              </label>

              <label className="flex items-start cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="mr-3 mt-0.5 w-4 h-4 accent-purple-400 cursor-pointer"
                  checked={isHonorPublic}
                  onChange={e => setIsHonorPublic(e.target.checked)}
                />
                <div className="flex flex-col leading-tight">
                  <span className={`font-semibold text-sm ${isHonorPublic ? 'text-purple-200' : 'text-gray-400'}`}>Honor Dashboard</span>
                  <span className="text-[10px] text-gray-500">{isHonorPublic ? 'Honor charts visible for public visitors' : 'Restrict honor view to R4/R5/Admin'}</span>
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

          {/* 3b. FORMULAS: DKP & GOALS */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-gray-900/40 p-5 rounded-lg border border-gray-600/50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-amber-300">🧮 DKP Formula</h3>
                  <p className="text-xs text-gray-400">Choose which kills/deads count for the DKP score and how many points they give.</p>
                </div>
              </div>

              <div className="space-y-3">
                {dkpCategories.map(cat => {
                  const entry = dkpFormula[cat.key];
                  return (
                    <div key={cat.key} className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 accent-yellow-500"
                          checked={entry.enabled}
                          onChange={(e) => handleToggleDkp(cat.key, e.target.checked)}
                        />
                        <div>
                          <div className="font-semibold text-white text-sm">{cat.label}</div>
                          {cat.helper && <div className="text-[11px] text-gray-400">{cat.helper}</div>}
                        </div>
                      </label>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-yellow-500 outline-none disabled:opacity-50"
                          value={entry.points}
                          onChange={(e) => handleDkpPointsChange(cat.key, Number(e.target.value) || 0)}
                          disabled={!entry.enabled}
                        />
                        <span className="text-xs text-gray-400">Points</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900/40 p-5 rounded-lg border border-gray-600/50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-cyan-300">🎯 Goals Formula</h3>
                  <p className="text-xs text-gray-400">Set DKP and dead troop goals per base power range.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-800/60 border border-cyan-800/50 rounded p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">Base Power Ranges</p>
                      <p className="text-[11px] text-gray-400">Set different goals by power range (e.g. 0-50M, 50-100M).</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddPowerBracket}
                      className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold px-3 py-1.5 rounded"
                    >
                      + Range
                    </button>
                  </div>

                  {powerBrackets.length === 0 && (
                    <div className="text-[12px] text-gray-400 bg-gray-900/60 border border-dashed border-gray-700 rounded p-3">
                      No ranges defined – add at least one to apply goals.
                    </div>
                  )}

                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {powerBrackets.map((range, idx) => (
                      <div key={idx} className="bg-gray-900/70 border border-gray-700 rounded p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400 font-semibold uppercase">Range #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePowerBracket(idx)}
                            className="text-red-300 hover:text-red-200 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase font-bold mb-1 block">Min Power</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 outline-none"
                              value={range.minPower}
                              onChange={(e) => handlePowerBracketChange(idx, 'minPower', Number(e.target.value) || 0)}
                              placeholder="e.g. 0"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase font-bold mb-1 block">Max Power</label>
                            <input
                              type="number"
                              min="0"
                              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 outline-none"
                              value={range.maxPower ?? ''}
                              onChange={(e) => handlePowerBracketChange(idx, 'maxPower', e.target.value === '' ? null : Number(e.target.value) || 0)}
                              placeholder="e.g. 50,000,000 (empty = open)"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase font-bold mb-1 block">DKP %</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 outline-none"
                              value={formatLocalizedDecimalValue(range.dkpPercent)}
                              onChange={(e) => handlePowerBracketChange(idx, 'dkpPercent', parseLocalizedDecimalInput(e.target.value))}
                              placeholder="e.g. 120"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-400 uppercase font-bold mb-1 block">Dead %</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-cyan-400 outline-none"
                              value={formatLocalizedDecimalValue(range.deadPercent)}
                              onChange={(e) => handlePowerBracketChange(idx, 'deadPercent', parseLocalizedDecimalInput(e.target.value))}
                              placeholder="e.g. 10"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500">DKP/dead goals apply to players within this power range. Empty Max means "up to infinity".</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-800/70 border border-dashed border-gray-600 rounded p-3">
                  <p className="font-semibold text-white mb-1">Notes</p>
                  <p>The DKP formula sets how kills/deads score points. The Goals formula defines the baseline targets each player must hit (based on base power). Configure ranges to set those targets.</p>
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
      )}

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
                            <div className="flex items-start text-amber-300 font-medium">
                                <span className="w-20 text-xs text-gray-500 uppercase mt-0.5">DKP:</span>
                                {ev.dkpFormula ? (
                                  <div className="flex flex-wrap gap-1">
                                    {dkpCategories.map(({ key, label }) => {
                                      const entry = ev.dkpFormula?.[key];
                                      if (!entry) return null;
                                      const isActive = entry.enabled;
                                      return (
                                        <span
                                          key={key}
                                          className={`text-[11px] px-2 py-1 rounded border ${
                                            isActive
                                              ? 'bg-amber-500/10 border-amber-400 text-amber-100'
                                              : 'bg-gray-700 text-gray-400 border-gray-600'
                                          }`}
                                        >
                                          {label}: {isActive ? `${entry.points} pts` : 'off'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-red-400">⚠️ Missing</span>
                                )}
                            </div>
                            <div className="flex items-start text-cyan-300 font-medium">
                                <span className="w-20 text-xs text-gray-500 uppercase mt-0.5">Goals:</span>
                                {ev.goalsFormula ? (
                                  <div className="flex flex-col gap-1">
                                    {ev.goalsFormula.powerBrackets?.length ? (
                                      <div className="flex flex-col gap-1">
                                        {ev.goalsFormula.powerBrackets.map((bracket, idx) => (
                                          <span
                                            key={`${bracket.minPower}-${bracket.maxPower ?? 'inf'}-${idx}`}
                                            className="text-[11px] px-2 py-1 rounded border border-cyan-500/30 bg-gray-800/70 text-cyan-100"
                                          >
                                            Range {idx + 1}: {bracket.minPower.toLocaleString()} - {bracket.maxPower ? bracket.maxPower.toLocaleString() : '∞'} → {bracket.dkpPercent}% DKP / {bracket.deadPercent}% Dead
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-gray-300">No power brackets defined.</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-red-400">⚠️ Missing</span>
                                )}
                            </div>
                            <div className="flex items-center text-sm text-gray-300 flex-wrap gap-2">
                              <span className="w-20 text-xs text-gray-500 uppercase">Sections:</span>
                              <span className={`text-[11px] px-2 py-1 rounded border ${
                                ev.isRankingPublic ? 'border-blue-500/50 bg-blue-900/30 text-blue-100' : 'border-gray-600 bg-gray-800 text-gray-300'
                              }`}>
                                DKP Ranking: {ev.isRankingPublic ? 'Public' : 'Private'}
                              </span>
                              <span className={`text-[11px] px-2 py-1 rounded border ${
                                ev.isHonorPublic ? 'border-purple-500/50 bg-purple-900/30 text-purple-100' : 'border-gray-600 bg-gray-800 text-gray-300'
                              }`}>
                                Honor Dashboard: {ev.isHonorPublic ? 'Public' : 'Private'}
                              </span>
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
              <FileReorderList
                type="overview"
                files={overviewFiles}
                onUpdate={loadData}
                headerAction={renderUploadButton('overview')}
              />
              <FileReorderList
                type="honor"
                files={honorFiles}
                onUpdate={loadData}
                headerAction={renderUploadButton('honor')}
              />
          </div>
      </div>
    </div>
  );
};

export default KvkManager;
