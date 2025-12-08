import React, { useState } from 'react';
import { UploadedFile } from '../types';
import { reorderFiles, deleteFile } from '../api';

interface FileReorderListProps {
  type: 'overview' | 'honor' | 'activity';
  files: UploadedFile[];
  onUpdate: () => void; // Callback um Daten neu zu laden
}

const FileReorderList: React.FC<FileReorderListProps> = ({ type, files, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= files.length) return;
    
    setLoading(true);
    const newFiles = [...files];
    const temp = newFiles[index];
    newFiles[index] = newFiles[index + direction];
    newFiles[index + direction] = temp;
    
    // Erstelle Array von IDs in neuer Reihenfolge
    const orderIds = newFiles.map(f => f.id);
    
    try {
        await reorderFiles(type, orderIds);
        onUpdate(); 
    } catch (e) {
        alert('Fehler beim Sortieren');
    } finally {
        setLoading(false);
    }
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

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mt-4">
      <h3 className="text-lg font-bold text-white mb-3 capitalize">{type} Dateien verwalten</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {files.length === 0 && <p className="text-gray-500 text-sm">Keine Dateien.</p>}
        {files.map((file, idx) => (
          <div key={file.id} className="flex items-center justify-between bg-gray-750 p-2 rounded hover:bg-gray-700 transition">
            <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-gray-500 font-mono text-xs w-6">{idx + 1}.</span>
                <span className="text-sm text-gray-200 truncate" title={file.name}>
                    {file.name}
                    {file.uploadDate && <span className="text-gray-500 text-xs ml-2">({new Date(file.uploadDate).toLocaleDateString()})</span>}
                </span>
            </div>
            
            <div className="flex items-center gap-1">
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
                    🗑️
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileReorderList;