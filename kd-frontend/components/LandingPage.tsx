import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const featureHighlights = [
  {
    title: 'Live KvK Insights',
    description:
      'Aggregated kill and power deltas, honor progress, and player search in one view - ready out of the box with no setup.',
  },
  {
    title: 'Activity & Uploads',
    description:
      'Automatic processing of overview, honor, and activity uploads with history and visuals for your team.',
  },
  {
    title: 'Access Code & Shop',
    description:
      'Flexible shop with login protection. After purchase, the flow guides you safely through activation.',
  },
  {
    title: 'Roles & Onboarding',
    description:
      'R5 is assigned automatically, new kingdoms follow naming, and invites to R4/R5/raid leads are included.',
  },
];

const flowSteps = [
  {
    title: 'Secure your access code',
    detail:
      'Pick the right duration in the shop (1 day to 1 year). Checkout requires login or registration.',
  },
  {
    title: 'Create and name your kingdom',
    detail:
      'After purchase, go straight to setup. Choose a kingdom name, we create the profile, and set you as R5.',
  },
  {
    title: 'Activate the code',
    detail:
      'Activate your code to unlock uploads, KvK tracking, and analytics. The status is visible anytime.',
  },
  {
    title: 'Onboard your team',
    detail:
      'Invite R4/R5 or analysts. Standard users can use the public link for a safe read-only view.',
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
                The new control center <span className="text-blue-400">for your kingdom</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                A clear look into KvK analytics, rankings, and honor progress. The demo shows how uploads, goals, and
                comparisons work - concise, professional, and easy to evaluate.
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
            <h2 className="text-3xl font-bold">Platform highlights</h2>
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
        </section>

        <section className="space-y-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-200">Guided flow</p>
              <h2 className="text-3xl font-bold">From purchase to activation in four steps</h2>
            </div>
            <button
              onClick={onStartShop}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow shadow-emerald-900/30"
            >
              Start access now
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {flowSteps.map((step, index) => (
              <div key={step.title} className="bg-black/30 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/50 flex items-center justify-center font-bold text-blue-200">
                    {index + 1}
                  </div>
                  <p className="text-lg font-semibold">{step.title}</p>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm uppercase tracking-widest text-blue-200">Default Kingdom</p>
              <h2 className="text-3xl font-bold">Explore the demo dataset</h2>
              <p className="text-gray-300 mt-2 max-w-3xl">
                Open the default kingdom to try rankings, honor progress, and search. Everything is read-only and ready
                to explore without login.
              </p>
            </div>
            <button
              onClick={onSeeDefault}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
            >
              Open default kingdom
            </button>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-200 border border-blue-500/30">Public</span>
                <p className="text-sm text-gray-300">No login required - read-only preview</p>
              </div>
              <p className="text-lg font-semibold text-white">What you see</p>
              <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>Live KvK rankings and honor progress per event</li>
                <li>Player search with ID, name, and alliance filters</li>
                <li>Activity uploads with timestamps and file history</li>
                <li>Sample DKP and dead goals for transparency</li>
              </ul>
              <p className="text-xs text-gray-500">
                Tip: bookmark <code className="bg-gray-800 px-1 rounded">?slug=default-kingdom</code> for quick access.
              </p>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Shop and activation</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                The shop is protected. After login or registration, you start the purchase flow, then you are guided to
                kingdom setup and code activation.
              </p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>Access code purchased -&gt; choose name -&gt; R5 assigned</p>
                <p>Activation status visible, reminders in the dashboard</p>
                <p>Extra codes can be used for R5 extensions</p>
              </div>
              <button
                onClick={onStartShop}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Secure access code
              </button>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-700/20 via-blue-600/10 to-emerald-600/10 border border-blue-700/40 rounded-3xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-blue-200">Ready?</p>
            <h3 className="text-2xl font-bold">Start now, secure your code, and become R5 of your kingdom instantly.</h3>
            <p className="text-gray-300 max-w-3xl">
              We combine demo transparency with a guided checkout. See the value first, grab the code, and move through
              setup, naming, and activation without detours.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onStartShop}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow-lg shadow-emerald-900/40"
            >
              Start access code
            </button>
            <button
              onClick={onSeeDefault}
              className="px-5 py-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-blue-500 text-sm font-semibold"
            >
              View demo
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
