import React from 'react';
import { formatDate } from '../utils';

interface FileListProps {
  files: { filename: string; uploadedAt: string }[];
  selectedFile: string | null;
  onSelect: (name: string) => void;
  title?: string;
}

const FileList: React.FC<FileListProps> = ({
  files,
  selectedFile,
  onSelect,
  title = 'Uploaded Files',
}) => {
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 shadow-lg shadow-black/30">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{title}</h3>

      {/* GRID statt lange Liste */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {files.map((file, index) => {
          const isSelected = selectedFile === file.filename;
          const isNewest = index === 0;

          return (
            <button
              key={file.filename}
              onClick={() => onSelect(file.filename)}
              className={`text-left p-3 rounded-lg transition-all border ${
                isSelected
                  ? 'bg-blue-600/30 border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`font-semibold text-sm ${
                    isSelected ? 'text-blue-300' : 'text-gray-200'
                  }`}
                >
                  {file.filename.replace('.csv', '')}
                </span>

                {/* NEU: „Newest“ Badge */}
                {isNewest && (
                  <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded-md border border-green-500/40">
                    NEW
                  </span>
                )}
              </div>

              {/* Hover-Infos statt permanente Infos */}
              <p className="text-gray-400 text-xs mt-1">
                {formatDate(file.uploadedAt)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Hinweis bei vielen Dateien */}
      {files.length >= 12 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Showing {files.length} files · Consider archiving old files soon.
        </p>
      )}
    </div>
  );
};

export default FileList;
