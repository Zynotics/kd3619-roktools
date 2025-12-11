import React, { useState } from 'react';
import { UploadedFile } from '../types';
import { reorderFiles, deleteFile } from '../api';

interface FileReorderListProps {
  type: 'overview' | 'honor' | 'activity';
  files: UploadedFile[];
  onUpdate: () => void;
  headerAction?: React.ReactNode;
}

const FileReorderList: React.FC<FileReorderListProps> = ({ type, files, onUpdate, headerAction }) => {
  const [loading, setLoading] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  // 🆕 State für Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const saveOrder = async (newFiles: UploadedFile[]) => {
      setLoading(true);
      const orderIds = newFiles.map(f => f.id);
      try {
          await reorderFiles(type, orderIds);
          onUpdate();
      } catch (e) {
          alert('Fehler beim Speichern der Reihenfolge');
      } finally {
          setLoading(false);
      }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= files.length) return;
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index + direction];
    newFiles[index + direction] = temp;
    await saveOrder(newFiles);
  };

  const handleAutoSort = async () => {
    if (!window.confirm('Liste wirklich automatisch nach Upload-Datum sortieren? (Älteste zuerst)')) return;
    const sorted = [...files].sort((a, b) => {
        const dA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const dB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return dA - dB;
    });
    await saveOrder(sorted);
  };

  const handlePositionChange = async (index: number, newPosStr: string) => {
      const newPos = parseInt(newPosStr);
      if (isNaN(newPos) || newPos < 1 || newPos > files.length || newPos === index + 1) {
          setEditIndex(null);
          return;
      }
      
      const newFiles = [...files];
      const [movedItem] = newFiles.splice(index, 1);
      newFiles.splice(newPos - 1, 0, movedItem);
      
      setEditIndex(null);
      await saveOrder(newFiles);
  };

  // 🆕 Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Transparenz oder Bild setzen
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Nötig, um Drop zu erlauben
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newFiles = [...files];
    const [movedItem] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(dropIndex, 0, movedItem);

    setDraggedIndex(null);
    await saveOrder(newFiles);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm('Datei wirklich löschen?')) return;
      setLoading(true);
      try {
          await deleteFile(type, id);
          onUpdate();
      } catch (e) {
          alert('Fehler beim Löschen');
      } finally {
          setLoading(false);
      }
  }

  const titleMap: Record<FileReorderListProps['type'], string> = {
    overview: 'Analytics Data',
    honor: 'Honor Data',
    activity: 'Activity Dateien',
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mt-4">
      <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white capitalize">{titleMap[type] ?? `${type} Dateien`}</h3>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              onClick={handleAutoSort}
              disabled={loading || files.length < 2}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded transition disabled:opacity-50"
            >
              Sort by upload date
            </button>
          </div>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {files.length === 0 && <p className="text-gray-500 text-sm">Keine Dateien.</p>}
        {files.map((file, idx) => (
          <div 
            key={file.id} 
            // 🆕 Drag Attributes
            draggable={!loading && editIndex === null}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
            className={`flex items-center justify-between bg-gray-750 p-2 rounded hover:bg-gray-700 transition cursor-default ${
                draggedIndex === idx ? 'opacity-40 border border-blue-500 border-dashed' : ''
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                {/* 🆕 Drag Handle Icon */}
                <div 
                    className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 px-1 select-none"
                    title="Ziehen zum Verschieben"
                >
                    ⋮⋮
                </div>

                {/* Positions-Nummer (Klickbar für manuelle Eingabe) */}
                {editIndex === idx ? (
                    <input 
                        type="number"
                        className="w-10 text-xs bg-gray-900 border border-blue-500 text-white text-center rounded p-1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handlePositionChange(idx, editValue)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePositionChange(idx, editValue);
                            if (e.key === 'Escape') setEditIndex(null);
                        }}
                        autoFocus
                    />
                ) : (
                    <span 
                        onClick={() => { setEditIndex(idx); setEditValue(String(idx + 1)); }}
                        className="text-gray-500 font-mono text-xs w-6 cursor-pointer hover:text-blue-400 text-center select-none"
                        title="Klicken zum Ändern der Position"
                    >
                        {idx + 1}.
                    </span>
                )}
                
                <div className="flex flex-col overflow-hidden select-none">
                    <span className="text-sm text-gray-200 truncate" title={file.name}>
                        {file.name}
                    </span>
                    {file.uploadDate && <span className="text-gray-500 text-[10px]">{new Date(file.uploadDate).toLocaleString()}</span>}
                </div>
            </div>
            
            <div className="flex items-center gap-1 ml-2">
                {/* Wir behalten die Buttons als Fallback oder für Feinjustierung */}
                <button 
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0 || loading}
                    className="p-1 hover:bg-gray-600 rounded text-blue-400 disabled:opacity-30"
                    title="Nach oben"
                >
                    ▲
                </button>
                <button 
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === files.length - 1 || loading}
                    className="p-1 hover:bg-gray-600 rounded text-blue-400 disabled:opacity-30"
                    title="Nach unten"
                >
                    ▼
                </button>
                <button 
                    onClick={() => handleDelete(file.id)}
                    disabled={loading}
                    className="ml-2 p-1 hover:bg-red-900/30 rounded text-red-400 disabled:opacity-30"
                    title="Löschen"
                >
                    ✕
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileReorderList;