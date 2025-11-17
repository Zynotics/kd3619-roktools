import React, { useEffect, useState, useCallback } from 'react';

interface PowerAnalyticsDashboardProps {
  isAdmin: boolean;
  backendUrl: string;
}

const PowerAnalyticsDashboard: React.FC<PowerAnalyticsDashboardProps> = ({ isAdmin, backendUrl }) => {
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

  // Dateien laden
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Fetching files from:', `${backendUrl}/overview/files-data`);
      const res = await fetch(`${backendUrl}/overview/files-data`);
      
      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('Files loaded:', data.length);
      setUploadedFiles(data);
      setIsDataLoaded(data.length > 0);
    } catch (err) {
      console.error('Error loading file data:', err);
      setError('Error loading file data. Please ensure the backend server is running and accessible.');
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  if (isLoading) {
    return (
      <div className="text-center p-8 text-gray-400">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        Loading analytics data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-400 bg-red-900/50 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Power Analytics Dashboard</h2>
        <p className="text-gray-300">Player progression analytics and charts</p>
        
        <div className="mt-4 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Debug Info:</h3>
          <p className="text-gray-400">Files loaded: {uploadedFiles.length}</p>
          <p className="text-gray-400">Backend URL: {backendUrl}</p>
          <p className="text-gray-400">Admin Mode: {isAdmin ? 'Yes' : 'No'}</p>
          <p className="text-gray-400">Data Loaded: {isDataLoaded ? 'Yes' : 'No'}</p>
        </div>
      </div>

      {/* Einfache Search Komponente */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">Player Search</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Enter Player Name or Governor ID..."
            className="flex-grow bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 placeholder-gray-400"
            disabled={!isDataLoaded}
          />
          <button
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
            disabled={!isDataLoaded}
          >
            Search
          </button>
        </div>
        {!isDataLoaded && (
          <p className="text-sm text-gray-400 mt-2">
            {uploadedFiles.length === 0 ? 'No data available. Please upload files in the CH25 Stats section.' : 'Loading player data...'}
          </p>
        )}
      </div>

      {/* Platzhalter für Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
          <h4 className="text-lg font-semibold text-gray-200 mb-4">Power Progression</h4>
          <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Chart will appear here when player is selected</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
          <h4 className="text-lg font-semibold text-gray-200 mb-4">Troops Power</h4>
          <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Chart will appear here when player is selected</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerAnalyticsDashboard;