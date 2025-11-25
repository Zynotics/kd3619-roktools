import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';

const LoginPrompt: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        // Passwort-Bestätigung prüfen
        if (password !== confirmPassword) {
          setError('Die Passwörter stimmen nicht überein.');
          setIsLoading(false);
          return;
        }

        // Registrierung
        await register(email, username, password);

        // Automatisch einloggen
        await login(username, password);

        // ➜ HINWEIS EINBLENDEN
        setSuccessMessage('Account erfolgreich erstellt!');

        // Felder leeren
        setEmail('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
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
    setConfirmPassword('');
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
            : 'Erstellen Sie einen Account für den Zugriff auf das Overview Dashboard'}
        </p>
      </div>

      {/* ➜ Erfolgs-Hinweis */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Fehleranzeige */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">E-Mail</label>
            <input
              type="email"
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={!isLogin}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Benutzername</label>
          <input
            type="text"
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Passwort</label>
          <input
            type="password"
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {/* Passwort-Bestätigung nur im Registriermodus */}
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Passwort bestätigen
            </label>
            <input
              type="password"
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2.5"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Bitte warten...' : isLogin ? 'Anmelden' : 'Registrieren'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={switchMode}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium"
        >
          {isLogin
            ? 'Noch keinen Account? Jetzt registrieren'
            : 'Bereits registriert? Jetzt anmelden'}
        </button>
      </div>
    </Card>
  );
};

export default LoginPrompt;
