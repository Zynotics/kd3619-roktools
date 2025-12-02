import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card } from './Card';

type GovIdStatus = 'idle' | 'checking' | 'valid' | 'invalid';

// Sicherstellen, dass die URL korrekt ist
const BACKEND_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.rise-of-stats.com'
    : 'http://localhost:4000';

const LoginPrompt: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [governorId, setGovernorId] = useState('');
  const [govIdStatus, setGovIdStatus] = useState<GovIdStatus>('idle');
  const [govIdMessage, setGovIdMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { login, register } = useAuth();

  const validateGovId = async () => {
    if (isLogin) return;

    const value = governorId.trim();
    if (!value) {
      setGovIdStatus('idle');
      setGovIdMessage(null);
      return;
    }

    setGovIdStatus('checking');
    setGovIdMessage('Checking Governor ID against uploaded data...');

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-gov-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ governorId: value }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server error during ID validation');
      }

      if (data.exists) {
        setGovIdStatus('valid');
        setGovIdMessage(
          'Governor ID found in data. Registration is allowed.'
        );
      } else {
        setGovIdStatus('invalid');
        setGovIdMessage(
          'Governor ID not found in current data. Registration is not allowed.'
        );
      }
    } catch (err: any) {
      setGovIdStatus('invalid');
      setGovIdMessage(
        err.message ||
          'An unexpected error occurred during Gov ID validation.'
      );
      console.error('Gov ID validation error:', err);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
        // Successful login handled by AuthContext redirect automatically
      } else {
        // 1. Registrieren
        await register(email, username, password, governorId);
        
        // 2. ✨ AUTO-LOGIN direkt nach Registrierung
        // Da kein Fehler geworfen wurde, war die Registrierung erfolgreich.
        // Wir loggen den User sofort mit den eben eingegebenen Daten ein.
        await login(username, password);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      // Bei Fehler im Login nach Registrierung bleiben wir im Formular,
      // aber der User ist theoretisch registriert.
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setSuccessMessage(null);
    setGovIdStatus('idle');
    setGovIdMessage(null);
  };

  const isSubmitDisabled =
    isLoading ||
    (!isLogin &&
      (password !== confirmPassword ||
        govIdStatus !== 'valid' ||
        !governorId.trim()));

  return (
    <Card className="max-w-lg mx-auto p-8">
      <h2 className="text-2xl font-bold text-white mb-6">
        {isLogin ? 'Sign In to KD3619' : 'Register New Account'}
      </h2>

      {error && (
        <div className="mb-4 text-sm text-red-400 bg-red-900/30 border border-red-700 px-3 py-2 rounded">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 text-sm text-green-400 bg-green-900/30 border border-green-700 px-3 py-2 rounded">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email (Register Only) */}
        {!isLogin && (
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
              placeholder="you@example.com"
              required={!isLogin}
            />
          </div>
        )}

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Your In-Game Name"
            required
          />
        </div>

        {/* Governor ID (Register Only) */}
        {!isLogin && (
          <div>
            <label
              htmlFor="governorId"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Governor ID
            </label>
            <div className="relative">
              <input
                id="governorId"
                type="text"
                value={governorId}
                onBlur={validateGovId}
                onChange={(e) => {
                  setGovernorId(e.target.value);
                  setGovIdStatus('idle');
                  setGovIdMessage(null);
                }}
                className={`w-full bg-gray-700 border text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors pr-10 ${
                  govIdStatus === 'valid'
                    ? 'border-green-500'
                    : govIdStatus === 'invalid'
                    ? 'border-red-500'
                    : 'border-gray-600'
                }`}
                placeholder="Your RoK Governor ID"
                required={!isLogin}
              />
              {govIdStatus === 'checking' && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
            {govIdMessage && (
              <p
                className={`mt-1 text-xs ${
                  govIdStatus === 'valid'
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {govIdMessage}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              *Your Gov ID must be present in the uploaded Kingdom data for
              approval.
            </p>
          </div>
        )}

        {/* Password (Login & Register) */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-400 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
            placeholder="Your password"
            required
            minLength={6}
          />
        </div>

        {/* Confirm Password (Register Only) */}
        {!isLogin && (
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-400 mb-1"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 transition-colors"
              placeholder="Repeat password"
              required
              minLength={6}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading
            ? isLogin
              ? 'Signing in...'
              : 'Creating account & Signing in...'
            : isLogin
            ? 'Sign In'
            : 'Register'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={switchMode}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          {isLogin
            ? 'Need an account? Register here.'
            : 'Already have an account? Sign In.'}
        </button>
      </div>
    </Card>
  );
};

export default LoginPrompt;