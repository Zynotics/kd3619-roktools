
import React, { useRef, useState } from 'react';
import type { UploadedFile } from '../types';

interface FileListProps {
  files: UploadedFile[];
  onDeleteFile: (id: string) => void;
  onReorder: (reorderedFiles: UploadedFile[]) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onDeleteFile, onReorder }) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    setDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
  };
  
  const handleDragEnd = () => {
    setDragging(false);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
        handleDragEnd();
        return;
    }
    
    const newFiles = [...files];
    const dragItemContent = newFiles.splice(dragItem.current, 1)[0];
    newFiles.splice(dragOverItem.current, 0, dragItemContent);
    
    onReorder(newFiles);
    handleDragEnd();
  };

  if (files.length === 0) return null;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Uploaded Files</h2>
      <div className="space-y-3">
        {files.map((file, index) => (
          <div
            key={file.id}
            className={`flex justify-between items-center p-3 rounded-lg border-2 bg-gray-200 dark:bg-gray-700 transition-all duration-200 ${
              dragging && dragItem.current === index ? 'opacity-50 scale-105 shadow-lg' : 'opacity-100'
            } ${
              dragging && dragOverItem.current === index ? 'border-blue-500' : 'border-transparent'
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-3">
                 <div className="cursor-move text-gray-500 dark:text-gray-400" aria-label="Drag to reorder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                        <circle cx="5" cy="5" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                        <circle cx="5" cy="19" r="1"></circle>
                        <circle cx="19" cy="5" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="19" cy="19" r="1"></circle>
                    </svg>
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteFile(file.id); }}
              className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label={`Delete file ${file.name}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList;
