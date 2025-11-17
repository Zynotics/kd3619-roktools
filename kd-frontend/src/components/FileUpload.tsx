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

    const uploadPromises = Array.from(files).map(file => {
      const formData = new FormData();
      formData.append('file', file);

      return fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      }).then(async response => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Upload failed (unknown server error).' }));
          return Promise.reject(`Error uploading "${file.name}": ${errData.message || 'Server error'}`);
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
      setError(errorMessages.join('\n'));
    }

    const successfulUploads = results.filter(res => res.status === 'fulfilled').length;
    if (successfulUploads > 0) {
      onUploadComplete();
    }

    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Upload Files</h2>

      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="file-upload-input"
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed
                      rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700
                      hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500
                      dark:hover:bg-gray-600 transition-colors
                      ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center">
              <svg
                className="animate-spin h-6 w-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4zm2 
                     5.291A7.96 7.96 0 014 12H0c0 
                     3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>

              <p className="mt-2 text-sm text-gray-300">Uploading...</p>
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
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                XLSX, XLS, or CSV
              </p>
            </div>
          )}

          <input
            id="file-upload-input"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            multiple
            disabled={isUploading}
          />
        </label>
      </div>

      {children}

      {error && (
        <p className="mt-2 text-sm text-red-600 whitespace-pre-line">
          {error}
        </p>
      )}
    </div>
  );
};

export default FileUpload;
