import React, { useRef, useState } from 'react';
import type { UploadedFile } from '../types';

interface FileListProps {
  files: UploadedFile[];
  canManageFiles: boolean;
  onDeleteFile: (id: string) => void;
  onReorder: (reorderedFiles: UploadedFile[]) => void;
}

const FileList: React.FC<FileListProps> = ({ files, canManageFiles, onDeleteFile, onReorder }) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Nur R4/R5/Admin sollen dieses Fenster überhaupt sehen
  if (!canManageFiles || files.length === 0) return null;

  const handleDragStart = (index: number) => {
    if (!canManageFiles) return;
    dragItem.current = index;
    setDragging(true);
  };

  const handleDragEnter = (index: number) => {
    if (!canManageFiles) return;
    dragOverItem.current = index;
  };

  const handleDropOrEnd = () => {
    if (!canManageFiles) {
      dragItem.current = null;
      dragOverItem.current = null;
      setDragging(false);
      return;
    }

    if (
      dragItem.current === null ||
      dragOverItem.current === null ||
      dragItem.current === dragOverItem.current
    ) {
      dragItem.current = null;
      dragOverItem.current = null;
      setDragging(false);
      return;
    }

    const updatedFiles = [...files];
    const draggedItemContent = updatedFiles[dragItem.current];

    // Entfernen
    updatedFiles.splice(dragItem.current, 1);
    // An neuer Position einfügen
    updatedFiles.splice(dragOverItem.current, 0, draggedItemContent);

    onReorder(updatedFiles);

    dragItem.current = null;
    dragOverItem.current = null;
    setDragging(false);
  };

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 shadow-md shadow-black/30">
      <h2 className="text-lg font-semibold text-gray-100 mb-3">
        Uploaded Files
      </h2>

      {/* kompakter Bereich mit Scroll, falls viele Dateien */}
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {files.map((file, index) => {
          const isDragSource = dragging && dragItem.current === index;
          const isDragTarget = dragging && dragOverItem.current === index;

          return (
            <div
              key={file.id}
              draggable={canManageFiles}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDropOrEnd}
              onDrop={handleDropOrEnd}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all duration-150 ${
                canManageFiles ? 'cursor-move' : 'cursor-default'
              } ${
                isDragSource
                  ? 'opacity-70 scale-[1.01] border-blue-500 bg-gray-800'
                  : isDragTarget
                  ? 'border-blue-400 bg-gray-800'
                  : 'border-gray-700 bg-gray-850 hover:bg-gray-800'
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-gray-100 truncate">
                  {(file as any).name || (file as any).filename || 'Unnamed file'}
                </span>
                {(file as any).uploadDate && (
                  <span className="text-xs text-gray-400">
                    {new Date((file as any).uploadDate).toLocaleString()}
                  </span>
                )}
              </div>

              <button
                onClick={() => onDeleteFile(file.id)}
                className="ml-3 inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-red-300 hover:bg-red-900/40 transition-colors"
                title="Delete file"
                type="button"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M6 7h12m-9 3v7m6-7v7M9 4h6a1 1 0 011 1v2H8V5a1 1 0 011-1zm2 0h2"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileList;
