import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const heroHighlights = [
  'Instant CH25 performance deltas and readiness signals.',
  'Weekly activity snapshots built from uploads in minutes.',
  'KvK management with DKP, honor, and goal tracking.',
];

const offeringRows = [
  {
    name: 'CH25 Analytics',
    detail: 'Power, kill points, and delta trends that surface your sharpest pilots.',
  },
  {
    name: 'Weekly Activity',
    detail: 'Honor, activity, and overview uploads distilled into week-over-week momentum.',
  },
  {
    name: 'KvK Management',
    detail: 'DKP + honor tracking, goal progress, and accountability dashboards.',
  },
  {
    name: 'Roster Visibility',
    detail: 'Public read-only links, search, and snapshots for fast briefings.',
  },
  {
    name: 'Historical Comparisons',
    detail: 'Side-by-side phase performance without manual spreadsheets.',
  },
  {
    name: 'Access & Governance',
    detail: 'R4/R5 workflows, controlled access, and quick onboarding.',
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop, onOpenLogin }) => {
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
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
          <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
            <div className="space-y-6 hero-fade">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-xs uppercase tracking-[0.3em] text-emerald-200">
                Rise of Stats
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-black leading-tight text-white">
                  A crisp command deck for <span className="text-emerald-300">KvK leadership</span>
                </h1>
                <p className="text-lg text-slate-300 leading-relaxed">
                  Rise of Stats turns your uploads into battle-ready insight: CH25 analytics, weekly activity, and
                  complete KvK management in a single, clean view.
                </p>
              </div>
              <div className="grid gap-3 text-sm text-slate-300">
                {heroHighlights.map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSeeDefault}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 transition text-sm font-semibold shadow-lg shadow-emerald-900/40"
                >
                  Explore demo kingdom
                </button>
                <button
                  onClick={onStartShop}
                  className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 transition text-sm font-semibold shadow-lg shadow-amber-900/40 text-slate-950"
                >
                  Get access code
                </button>
                <button
                  onClick={onOpenLogin}
                  className="px-5 py-3 rounded-xl border border-slate-700 text-sm font-semibold text-slate-200 hover:border-slate-400 hover:text-white transition"
                >
                  Log in
                </button>
              </div>
            </div>

            <div className="relative hero-fade" style={{ animationDelay: '0.15s' }}>
              <div
                className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl"
                style={{ animation: 'heroGlow 6s ease-in-out infinite' }}
              />
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Demo Kingdom</p>
                    <p className="text-2xl font-bold">Live Read-Only Preview</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/40">
                    Safe to browse
                  </span>
                </div>
                <div className="grid gap-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between border border-slate-700/80 rounded-xl px-4 py-3">
                    <span>CH25 performance pulse</span>
                    <span className="text-emerald-300 font-semibold">Live</span>
                  </div>
                  <div className="flex items-center justify-between border border-slate-700/80 rounded-xl px-4 py-3">
                    <span>Weekly activity rollup</span>
                    <span className="text-amber-200 font-semibold">Updated</span>
                  </div>
                  <div className="flex items-center justify-between border border-slate-700/80 rounded-xl px-4 py-3">
                    <span>KvK DKP + honor goals</span>
                    <span className="text-slate-100 font-semibold">Tracked</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onSeeDefault}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold shadow shadow-emerald-900/30"
                  >
                    Open demo
                  </button>
                  <button
                    onClick={onStartShop}
                    className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-sm font-semibold"
                  >
                    Activate your kingdom
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Browse the demo kingdom to understand the flow, then unlock uploads and leadership controls.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6 hero-fade" style={{ animationDelay: '0.25s' }}>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Everything included</p>
              <h2 className="text-3xl font-bold">A clear overview of what Rise of Stats delivers</h2>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid md:grid-cols-[1fr_2fr] gap-4 px-5 py-4 border-b border-slate-800 text-xs uppercase tracking-[0.2em] text-slate-400">
                <span>Capability</span>
                <span>What you get</span>
              </div>
              <div className="divide-y divide-slate-800">
                {offeringRows.map(row => (
                  <div key={row.name} className="grid md:grid-cols-[1fr_2fr] gap-4 px-5 py-4">
                    <p className="text-sm font-semibold text-white">{row.name}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-r from-emerald-500/15 via-slate-900/40 to-amber-500/15 border border-emerald-400/30 rounded-3xl p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hero-fade" style={{ animationDelay: '0.35s' }}>
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
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
