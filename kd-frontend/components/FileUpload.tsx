import React, { useState } from 'react';

interface FileUploadProps {
  onUploadComplete: () => void;
  uploadUrl: string;
  children?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, uploadUrl, children }) => {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    // 🔑 NEU: Token holen
    const token = localStorage.getItem('authToken');

    const uploadPromises = Array.from(files).map(file => {
      const formData = new FormData();
      formData.append('file', file);

      // Fetch mit Token Header
      return fetch(uploadUrl, {
        method: 'POST',
        headers: {
            // WICHTIG: Bei FormData kein 'Content-Type' setzen (macht der Browser automatisch),
            // aber der Authorization Header ist Pflicht!
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      }).then(async response => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Upload failed.' }));
          // Spezifische Errormeldung für 401/403
          if (response.status === 401 || response.status === 403) {
              return Promise.reject(`Permission denied for file "${file.name}". Are you logged in?`);
          }
          return Promise.reject(`Error uploading "${file.name}": ${errData.message || response.statusText}`);
        }
        return response.json();
      });
    });

    const results = await Promise.allSettled(uploadPromises);

    setIsUploading(false);

    const errorMessages = results
      .filter(res => res.status === 'rejected')
      .map(res => (res as PromiseRejectedResult).reason);

    if (errorMessages.length > 0) {
      setError(errorMessages.join(', '));
    } else {
      // Erfolg
      if (event.target) {
          event.target.value = ''; // Reset input
      }
      onUploadComplete();
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 transition-colors ${
            isUploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center pt-5 pb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-sm text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 000-6h-.025A5.56 
                     5.56 0 0016 6.5a5.5 5.5 0 00-10.793-1.48C5.137 
                     5.017 5.071 5 5 5a4 4 0 000 8h2.167M10 
                     15V6m0 0L8 8m2-2 2 2"
                />
              </svg>

              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span>
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                XLSX, XLS, or CSV
              </p>
            </div>
          )}

          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            multiple
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/50 text-red-200 text-sm rounded border border-red-700">
          {error}
        </div>
      )}
      
      {children}
    </div>
  );
};

export default FileUpload;