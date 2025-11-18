import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';

const LoginPrompt: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        const result = await register(email, username, password);
        setSuccessMessage(result.message);
        // Nach Registrierung auf Login umschalten
        setIsLogin(true);
        setEmail('');
        setUsername('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setUsername('');
    setPassword('');
  };

  return (
    <Card className="max-w-md mx-auto p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          {isLogin ? 'Anmelden' : 'Registrieren'}
        </h2>
        <p className="text-gray-400">
          {isLogin 
            ? 'Melden Sie sich an, um auf das Overview Dashboard zuzugreifen' 
            : 'Erstellen Sie einen Account für den Zugriff auf das Overview Dashboard'
          }
        </p>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
              placeholder="ihre@email.de"
              required={!isLogin}
            />
          </div>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1">
            Benutzername
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Benutzername"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Passwort"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Bitte warten...' : (isLogin ? 'Anmelden' : 'Registrieren')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={switchMode}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {isLogin 
            ? 'Noch keinen Account? Jetzt registrieren' 
            : 'Bereits registriert? Jetzt anmelden'
          }
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-700 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Zugriffsinformationen:</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• <strong>Gast:</strong> Honor + Player Analytics sofort sichtbar</li>
          <li>• <strong>Registriert:</strong> Overview Dashboard nach Freigabe</li>
          <li>• <strong>Freigegeben:</strong> Vollzugriff auf alle Bereiche</li>
        </ul>
      </div>
    </Card>
  );
};

export default LoginPrompt;