import React, { useState } from 'react';
import { UploadedFile } from '../types';
import { reorderFiles, deleteFile } from '../api';

interface FileReorderListProps {
  type: 'overview' | 'honor' | 'activity';
  files: UploadedFile[];
  onUpdate: () => void;
}

const FileReorderList: React.FC<FileReorderListProps> = ({ type, files, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null); // Welches Feld wird gerade bearbeitet
  const [editValue, setEditValue] = useState<string>('');

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

  // 🆕 Auto-Sortierung nach Datum
  const handleAutoSort = async () => {
    if (!window.confirm('Liste wirklich automatisch nach Upload-Datum sortieren? (Älteste zuerst)')) return;
    const sorted = [...files].sort((a, b) => {
        const dA = a.uploadDate ? new Date(a.uploadDate).getTime() : 0;
        const dB = b.uploadDate ? new Date(b.uploadDate).getTime() : 0;
        return dA - dB;
    });
    await saveOrder(sorted);
  };

  // 🆕 Manuelles Springen zu Position
  const handlePositionChange = async (index: number, newPosStr: string) => {
      const newPos = parseInt(newPosStr);
      if (isNaN(newPos) || newPos < 1 || newPos > files.length || newPos === index + 1) {
          setEditIndex(null);
          return;
      }
      
      const newFiles = [...files];
      const [movedItem] = newFiles.splice(index, 1); // Element rausnehmen
      newFiles.splice(newPos - 1, 0, movedItem); // An neuer Stelle einfügen (1-based index to 0-based)
      
      setEditIndex(null);
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

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mt-4">
      <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-white capitalize">{type} Dateien</h3>
          <button 
            onClick={handleAutoSort}
            disabled={loading || files.length < 2}
            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded transition disabled:opacity-50"
          >
            Nach Datum sortieren
          </button>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {files.length === 0 && <p className="text-gray-500 text-sm">Keine Dateien.</p>}
        {files.map((file, idx) => (
          <div key={file.id} className="flex items-center justify-between bg-gray-750 p-2 rounded hover:bg-gray-700 transition">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
                {/* 🆕 Eingabefeld für Position */}
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
                        className="text-gray-500 font-mono text-xs w-6 cursor-pointer hover:text-blue-400 text-center"
                        title="Klicken zum Ändern der Position"
                    >
                        {idx + 1}.
                    </span>
                )}
                
                <div className="flex flex-col overflow-hidden">
                    <span className="text-sm text-gray-200 truncate" title={file.name}>
                        {file.name}
                    </span>
                    {file.uploadDate && <span className="text-gray-500 text-[10px]">{new Date(file.uploadDate).toLocaleString()}</span>}
                </div>
            </div>
            
            <div className="flex items-center gap-1 ml-2">
                <button 
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0 || loading}
                    className="p-1 hover:bg-gray-600 rounded text-blue-400 disabled:opacity-30"
                >
                    ▲
                </button>
                <button 
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === files.length - 1 || loading}
                    className="p-1 hover:bg-gray-600 rounded text-blue-400 disabled:opacity-30"
                >
                    ▼
                </button>
                <button 
                    onClick={() => handleDelete(file.id)}
                    disabled={loading}
                    className="ml-2 p-1 hover:bg-red-900/30 rounded text-red-400 disabled:opacity-30"
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