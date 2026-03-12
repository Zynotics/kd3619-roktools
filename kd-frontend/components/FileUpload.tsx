import React, { useState } from 'react';
import { useToast } from './Toast';

interface FileUploadProps {
  onUploadComplete: () => void | Promise<void>;
  uploadUrl: string;
  children?: React.ReactNode;
}

interface FileProgress {
  name: string;
  percent: number;
  done: boolean;
}

function uploadFileWithProgress(
  file: File,
  url: string,
  token: string | null,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else if (xhr.status === 401 || xhr.status === 403) {
        reject(`Permission denied for "${file.name}". Are you logged in?`);
      } else {
        let msg = xhr.statusText;
        try { msg = JSON.parse(xhr.responseText)?.error || msg; } catch {}
        reject(`Error uploading "${file.name}": ${msg}`);
      }
    });

    xhr.addEventListener('error', () => reject(`Network error uploading "${file.name}"`));
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete, uploadUrl, children }) => {
  const { addToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [fileProgresses, setFileProgresses] = useState<FileProgress[]>([]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const token = localStorage.getItem('authToken');

    setFileProgresses(Array.from(files).map((f) => ({ name: f.name, percent: 0, done: false })));

    const results = await Promise.allSettled(
      Array.from(files).map((file, idx) =>
        uploadFileWithProgress(file, uploadUrl, token, (percent) => {
          setFileProgresses((prev) =>
            prev.map((p, i) => (i === idx ? { ...p, percent, done: percent === 100 } : p))
          );
        })
      )
    );

    setIsUploading(false);

    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason as string);

    if (errors.length > 0) {
      errors.forEach((msg) => addToast(msg, 'error'));
      setFileProgresses([]);
    } else {
      const count = files.length;
      addToast(`${count} file${count > 1 ? 's' : ''} uploaded successfully.`, 'success');
      setFileProgresses([]);
      if (event.target) event.target.value = '';
      await onUploadComplete();
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
              <p className="text-xs text-gray-500 dark:text-gray-400">XLSX, XLS, or CSV</p>
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

      {fileProgresses.length > 0 && (
        <div className="mt-3 space-y-2">
          {fileProgresses.map((fp, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span className="truncate max-w-[80%]">{fp.name}</span>
                <span>{fp.percent}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    fp.done ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${fp.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
};

export default FileUpload;
