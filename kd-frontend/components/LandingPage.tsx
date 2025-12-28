import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
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
                  The tool for kings, leaders and council members that keeps track of everything in you kingdom.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
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
          </section>

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
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
