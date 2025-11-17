import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Wenn du später globales CSS haben willst, kannst du hier eine index.css importieren.
// Beispiel: import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container missing in index.html');
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
