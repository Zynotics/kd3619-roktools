import React, { useEffect, useMemo, useState } from 'react';
import { activateSelfR5Code, createKingdomWithCode, fetchMyKingdom, fetchMyR5Codes } from '../api';
import { R5Code } from '../types';
import { useAuth } from './AuthContext';
import LoginPrompt from './LoginPrompt';
import ShopWidget from './ShopWidget';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
};

type KingdomInfo = {
  id: string;
  displayName: string;
  slug: string;
};

const overviewItems = [
  {
    name: 'CH 25 Analytics',
    detail: 'Monitor your KD with power, KP, and readiness snapshots.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-300" aria-hidden="true">
        <path
          d="M4 13h4v7H4v-7Zm6-6h4v13h-4V7Zm6 3h4v10h-4V10Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: 'Weekly Activity',
    detail: 'Donations, tech, and building progress at a glance.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-300" aria-hidden="true">
        <path
          d="M12 3l2.4 4.8 5.3.8-3.8 3.7.9 5.4L12 15.8 7.2 17.7l.9-5.4-3.8-3.7 5.3-.8L12 3z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: 'KvK Management',
    detail: 'DKP calculations and honor overview in one hub.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-300" aria-hidden="true">
        <path
          d="M12 2l7 4v6c0 5-3.3 9.6-7 10-3.7-.4-7-5-7-10V6l7-4zm0 4l-4 2v4c0 3.5 2.2 6.7 4 7.2 1.8-.5 4-3.7 4-7.2V8l-4-2z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    name: 'Share Data',
    detail: 'Share dashboards with all members safely.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-fuchsia-300" aria-hidden="true">
        <path
          d="M7 12a3 3 0 105.2 2H15a3 3 0 103 3 3 3 0 00-2.2-2.9l-3.6-2a3 3 0 000-2.2l3.6-2A3 3 0 0018 6a3 3 0 10-3 3h-2.8a3 3 0 00-5.2 2 3 3 0 000 2H7z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const statusLabel = (code: R5Code) => {
  if (!code.isActive) return 'Unused';
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) return 'Expired';
  return 'Active';
};

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop }) => {
  const { user, refreshUser, logout } = useAuth();
  const [kingdomInfo, setKingdomInfo] = useState<KingdomInfo | null>(null);
  const [codes, setCodes] = useState<R5Code[]>([]);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [codesLoading, setCodesLoading] = useState(false);
  const [activatingCode, setActivatingCode] = useState<string | null>(null);
  const [activateMessage, setActivateMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const hasKingdom = useMemo(() => !!kingdomInfo?.id, [kingdomInfo]);
  const accountSlug = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('account');
  }, []);
  const isShopPage = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('shop') === 'true';
  }, []);
  const isAccountPage = !!accountSlug;
  const showShopPage = isShopPage && !isAccountPage;

  useEffect(() => {
    if (!user) return;

    const loadKingdom = async () => {
      try {
        const data = await fetchMyKingdom();
        setKingdomInfo(data.kingdom || null);
      } catch {
        setKingdomInfo(null);
      }
    };

    const loadCodes = async () => {
      setCodesLoading(true);
      setCodesError(null);
      try {
        const data = await fetchMyR5Codes();
        setCodes(data);
      } catch (err: any) {
        setCodesError(err.message || 'Failed to load codes.');
      } finally {
        setCodesLoading(false);
      }
    };

    loadKingdom();
    loadCodes();
  }, [user]);

  const handleGoToDashboard = () => {
    if (!kingdomInfo?.slug) return;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('slug', kingdomInfo.slug);
    newUrl.searchParams.delete('login');
    newUrl.searchParams.delete('register');
    newUrl.searchParams.delete('account');
    newUrl.searchParams.delete('shop');
    window.location.href = newUrl.toString();
  };

  const handleGoToSuperadminDashboard = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('slug');
    newUrl.searchParams.delete('account');
    newUrl.searchParams.delete('shop');
    newUrl.searchParams.delete('login');
    newUrl.searchParams.delete('register');
    window.location.href = newUrl.toString();
  };

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleGoToAccount = () => {
    const nextSlug = slugify(user?.username || 'account');
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('account', nextSlug || 'account');
    newUrl.searchParams.delete('slug');
    newUrl.searchParams.delete('login');
    newUrl.searchParams.delete('register');
    window.location.href = newUrl.toString();
  };

  const handleBackToLanding = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('account');
    newUrl.searchParams.delete('shop');
    newUrl.searchParams.delete('login');
    newUrl.searchParams.delete('register');
    window.location.href = newUrl.toString();
  };

  const handleActivate = async (code: string) => {
    if (!kingdomInfo?.id) {
      setActivateMessage('Create a kingdom first to activate codes.');
      return;
    }
    setActivatingCode(code);
    setActivateMessage(null);
    try {
      await activateSelfR5Code(code, kingdomInfo.id);
      setActivateMessage('Code activated.');
      await refreshUser();
      const data = await fetchMyR5Codes();
      setCodes(data);
    } catch (err: any) {
      setActivateMessage(err.message || 'Activation failed.');
    } finally {
      setActivatingCode(null);
      setTimeout(() => setActivateMessage(null), 3000);
    }
  };

  const handleCreateKingdom = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreateLoading(true);
    try {
      const payload = {
        displayName: displayName.trim(),
        code: accessCode.trim().toUpperCase(),
      };
      const result = await createKingdomWithCode(payload);
      setCreateSuccess(`Kingdom created: ${result.kingdom.slug}`);
      setKingdomInfo(result.kingdom);
      setDisplayName('');
      setAccessCode('');
      await refreshUser();
    } catch (err: any) {
      setCreateError(err.message || 'Creation failed.');
    } finally {
      setCreateLoading(false);
    }
  };

  const scrollToCreate = () => {
    const target = document.getElementById('create-kingdom');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ fontFamily: '"Space Grotesk", "Sora", "Trebuchet MS", sans-serif' }}
    >
      <style>{`
        @keyframes heroGlow {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-8px); opacity: 0.9; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .hero-fade { animation: fadeUp 0.9s ease both; }
      `}</style>

      <div className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.25),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(251,146,60,0.15),_transparent_55%)]" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-12">
        <div className="flex flex-wrap justify-end gap-2 hero-fade">
          {user && (
            <div className="flex items-center px-3 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-300">
              Signed in as <span className="ml-1 text-white">{user.username}</span>
            </div>
          )}
          {(isAccountPage || isShopPage) && (
            <button
              onClick={handleBackToLanding}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
            >
              Home
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={handleGoToSuperadminDashboard}
              className="px-4 py-2 rounded-lg border border-amber-400/60 text-xs font-semibold text-amber-100 hover:border-amber-300 hover:text-white transition"
            >
              Superadmin dashboard
            </button>
          )}
          {user && hasKingdom && kingdomInfo?.slug && (
            <button
              onClick={handleGoToDashboard}
              className="px-4 py-2 rounded-lg border border-emerald-400/60 text-xs font-semibold text-emerald-100 hover:border-emerald-300 hover:text-white transition"
            >
              Jump to {kingdomInfo.slug}
            </button>
          )}
          <button
            onClick={handleGoToAccount}
            className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
          >
            My Account
          </button>
          {user ? (
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
            >
              Log out
            </button>
          ) : (
            <button
              onClick={handleGoToAccount}
              className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
            >
              Log in
            </button>
          )}
        </div>
        {!isAccountPage && !showShopPage && (
          <section className="grid gap-10 items-center">
          <div className="flex justify-center hero-fade">
            <div className="inline-flex items-center px-4 py-2 rounded-full border border-emerald-400/50 bg-emerald-400/10 text-xs uppercase tracking-[0.4em] text-emerald-200">
              RISE OF STATS
            </div>
            </div>
            <div className="space-y-6 hero-fade">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-black leading-tight text-white">
                  ROK Kingdom &amp; KVK Management Tool
                </h1>
                <p className="text-lg text-slate-300 leading-relaxed">
                  The tool for kings, leaders and council members that keeps track of everything in your kingdom.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onStartShop}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 transition text-sm font-semibold shadow-lg shadow-amber-900/40 text-slate-950"
                >
                  Shop
                </button>
                <button
                  onClick={handleGoToAccount}
                  className="px-5 py-3 rounded-xl border border-slate-700 text-sm font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
                >
                  {user ? 'My Account' : 'Log in / Register new account'}
                </button>
              </div>
            </div>
          </section>
        )}

        {!isAccountPage && !showShopPage && (
          <section className="space-y-6 hero-fade" style={{ animationDelay: '0.25s' }}>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Overview</p>
              <h2 className="text-3xl font-bold">Everything you need in one place</h2>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid md:grid-cols-[auto_1fr_2fr] gap-4 px-5 py-4 border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                <span />
                <span>Module</span>
                <span>Focus</span>
              </div>
              <div className="divide-y divide-slate-800">
                {overviewItems.map(item => (
                  <div key={item.name} className="grid md:grid-cols-[auto_1fr_2fr] gap-4 px-5 py-4 items-start">
                    <div className="h-10 w-10 rounded-xl bg-slate-800/70 border border-slate-700 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {isAccountPage && (
          <section className="space-y-6 hero-fade" style={{ animationDelay: '0.15s' }}>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">My Account</p>
              <h2 className="text-3xl font-bold">Access and manage your codes</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
                {user ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Signed in</p>
                      <p className="text-xl font-semibold text-white">{user.username}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-xs uppercase text-slate-500">Role</p>
                        <p className="font-semibold text-white">{user.role.toUpperCase()}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                        <p className="text-xs uppercase text-slate-500">Kingdom</p>
                        <p className="font-semibold text-white">{kingdomInfo?.slug || 'Not linked'}</p>
                      </div>
                    </div>
                    {hasKingdom && (
                      <button
                        onClick={handleGoToDashboard}
                        className="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-slate-950 transition"
                      >
                        Go to {kingdomInfo?.slug} dashboard
                      </button>
                    )}
                  </div>
                ) : (
                  <LoginPrompt />
                )}
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">My Codes</h3>
                  {codesLoading && <span className="text-xs text-slate-400">Loading...</span>}
                </div>
                {codesError && (
                  <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 px-3 py-2 rounded">
                    {codesError}
                  </div>
                )}
                {activateMessage && (
                  <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-800 px-3 py-2 rounded">
                    {activateMessage}
                  </div>
                )}
                {!user ? (
                  <p className="text-sm text-slate-400">Sign in to view and redeem your access codes.</p>
                ) : codes.length === 0 ? (
                  <p className="text-sm text-slate-400">No codes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {codes.map((code) => (
                      <div
                        key={code.code}
                        className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white tracking-wide">{code.code}</p>
                          <p className="text-xs text-slate-400">
                            {statusLabel(code)}  •  Expires {formatDate(code.expiresAt)}
                          </p>
                        </div>
                        {!code.isActive && (
                          <button
                            onClick={() => handleActivate(code.code)}
                            disabled={activatingCode === code.code}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                              activatingCode === code.code
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {activatingCode === code.code ? 'Activating...' : 'Activate'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {user && !hasKingdom && (
                  <form id="create-kingdom" onSubmit={handleCreateKingdom} className="space-y-3 pt-4 border-t border-slate-800">
                    <div>
                      <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">
                        Kingdom display name
                      </label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                        placeholder="e.g. Rising Order"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-[0.2em] text-slate-400 mb-1">
                        Access code
                      </label>
                      <input
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                        placeholder="Enter your access code"
                        required
                      />
                    </div>
                    {createError && (
                      <div className="text-xs text-red-400 bg-red-900/30 border border-red-800 px-3 py-2 rounded">
                        {createError}
                      </div>
                    )}
                    {createSuccess && (
                      <div className="text-xs text-emerald-300 bg-emerald-900/30 border border-emerald-800 px-3 py-2 rounded">
                        {createSuccess}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={createLoading}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-semibold ${
                        createLoading
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      }`}
                    >
                      {createLoading ? 'Creating...' : 'Create Kingdom'}
                    </button>
                  </form>
                )}

                {user && hasKingdom && (
                  <div className="text-xs text-slate-400 border-t border-slate-800 pt-4">
                    You already belong to {kingdomInfo?.displayName || kingdomInfo?.slug}.
                  </div>
                )}

                {user && (
                  <button
                    onClick={onStartShop}
                    className="w-full px-4 py-3 rounded-xl border border-amber-400/70 text-sm font-semibold text-amber-100 hover:border-amber-300 hover:text-white transition"
                  >
                    Shop
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {showShopPage && (
          <section className="space-y-6 hero-fade" style={{ animationDelay: '0.15s' }}>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Shop</p>
              <h2 className="text-3xl font-bold">Choose your access</h2>
            </div>
            <ShopWidget kingdomSlug={kingdomInfo?.slug || undefined} />
          </section>
        )}

        {!isAccountPage && !showShopPage && (
          <section
            className="bg-gradient-to-r from-emerald-500/15 via-slate-900/40 to-amber-500/15 border border-emerald-400/30 rounded-3xl p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hero-fade"
            style={{ animationDelay: '0.35s' }}
          >
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">See the demo</p>
              <h3 className="text-2xl font-bold">Walk the demo kingdom before you activate yours.</h3>
              <p className="text-slate-300 max-w-3xl">
                Explore CH25 analytics, weekly activity, and full KvK management with DKP and honor tracking. Everything
                is read-only, so you can review the flow with your council first.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold shadow-lg shadow-emerald-900/40"
              >
                Launch demo kingdom
              </button>
              <button
                onClick={onStartShop}
                className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-sm font-semibold"
              >
                Secure access
              </button>
            </div>
          </section>
        )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
