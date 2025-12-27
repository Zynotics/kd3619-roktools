import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const featureHighlights = [
  {
    title: 'CH 25 Analytics',
    description: 'Live kill and power deltas, matchup readiness, and quick rankings tailored to City Hall 25 players.',
  },
  {
    title: 'Weekly Activity',
    description: 'Uploads for overview, honor, and activity turn into clean week-over-week insights with visuals.',
  },
  {
    title: 'KvK Management',
    description: 'DKP and honor tracking in one place, with goal progress, alerts, and historical context.',
  },
  {
    title: 'Access & Roles',
    description: 'R5 automation, safe read-only links for users, and guided onboarding for R4/R5 and analysts.',
  },
];

const offeringRows = [
  {
    name: 'CH 25 Analytics',
    detail: 'Current kill/power deltas, KPIs by squad, and quick reads on matchup readiness.',
  },
  {
    name: 'Weekly Activity',
    detail: 'Clear weekly summaries from uploads: honor, activity, overview, and trend charts.',
  },
  {
    name: 'KvK Management',
    detail: 'DKP scoring, honor tracking, milestones, and roster accountability in one dashboard.',
  },
  {
    name: 'Uploads & History',
    detail: 'Automatic parsing, history retention, and comparisons without manual spreadsheets.',
  },
  {
    name: 'Roles & Governance',
    detail: 'R5/R4 controls, safe public read-only link, and invite management for analysts.',
  },
  {
    name: 'Shop & Codes',
    detail: 'Protected checkout, flexible durations, and activation guidance after purchase.',
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop, onOpenLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-700/50 text-xs uppercase tracking-widest text-blue-200">
              Rise of Stats | KvK Intelligence for Kingdom Leads
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black leading-tight">
                The control center <span className="text-blue-400">for modern KvK</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                Rise of Stats gives leaders a sharp snapshot of CH25 performance, weekly activity, and KvK goals without
                spreadsheets. Explore the demo to see how uploads become actionable calls and clean comparisons.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-sm font-semibold shadow-lg shadow-blue-900/40"
              >
                View the default kingdom
              </button>
              <button
                onClick={onStartShop}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition text-sm font-semibold shadow-lg shadow-emerald-900/40"
              >
                Buy access code
              </button>
              <button
                onClick={onOpenLogin}
                className="px-5 py-3 rounded-xl border border-gray-700 text-sm font-semibold text-gray-200 hover:border-gray-500 hover:text-white transition"
              >
                Log in
              </button>
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-200 font-semibold">
                Demo
              </div>
              <div>
                <p className="text-gray-200 font-semibold">Default kingdom without login</p>
                <p>Try rankings, honor curves, and search in a public read-only dataset.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" aria-hidden />
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-200">KvK Radar</p>
                  <p className="text-2xl font-bold">Live Demo Preview</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-200 border border-emerald-500/40">
                  R5 ready
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSeeDefault}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
                >
                  Open live demo
                </button>
                <button
                  onClick={onStartShop}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 text-sm font-semibold"
                >
                  Get access code
                </button>
              </div>
              <p className="text-xs text-gray-500">
                No risk: the demo is read-only. After activation you can use uploads, KvK management, and R5 tools.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-blue-200">What to expect</p>
            <h2 className="text-3xl font-bold">Everything included</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {featureHighlights.map(feature => (
              <div
                key={feature.title}
                className="bg-gray-900/80 border border-gray-800 rounded-2xl p-5 hover:border-blue-600/60 transition"
              >
                <p className="text-lg font-semibold mb-2">{feature.title}</p>
                <p className="text-sm text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-950/60 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="bg-gray-900/70 px-5 py-3 text-sm font-semibold uppercase tracking-widest text-blue-200">
              Detailed overview
            </div>
            <div className="divide-y divide-gray-800">
              {offeringRows.map(row => (
                <div key={row.name} className="grid md:grid-cols-3 items-start gap-4 px-5 py-4">
                  <p className="text-sm font-semibold text-gray-100 md:col-span-1">{row.name}</p>
                  <p className="text-sm text-gray-300 md:col-span-2 leading-relaxed">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-700/20 via-blue-600/10 to-emerald-600/10 border border-blue-700/40 rounded-3xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-blue-200">See it in action</p>
            <h3 className="text-2xl font-bold">Walk through the demo kingdom and preview your next KvK cycle.</h3>
            <p className="text-gray-300 max-w-3xl">
              Check weekly activity, CH25 analytics, and KvK management with DKP and honor tracking. The demo is
              read-only, so you can explore safely before activating your own code.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onSeeDefault}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow-lg shadow-blue-900/40"
            >
              Explore demo kingdom
            </button>
            <button
              onClick={onStartShop}
              className="px-5 py-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-emerald-400 text-sm font-semibold"
            >
              Secure an access code
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
