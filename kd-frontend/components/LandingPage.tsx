import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const benefits = [
  {
    title: 'Instant insights',
    description: 'Process uploads, calculate KPIs, and visualize results clearly for R4/R5.',
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
    title: 'Leadership decisions',
    description: 'Trends, Honor, and Activity at a glance so decisions land faster.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-300" aria-hidden="true">
        <path
          d="M12 3 3 9l9 6 9-6-9-6Zm0 8.8L6.1 9.3 12 5.8l5.9 3.5L12 11.8ZM3 12l9 6 9-6v4l-9 6-9-6v-4Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    title: 'Roles and access',
    description: 'R4, R5, Admin: separate rights and safe public views.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-300" aria-hidden="true">
        <path
          d="M12 2a5 5 0 0 0-5 5v1.1a6 6 0 0 0-4 5.6V17a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3v-3.3a6 6 0 0 0-4-5.6V7a2 2 0 0 1 4 0v1h2V7a5 5 0 0 0-5-5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    title: 'History and reports',
    description: 'Versioned uploads, comparisons per player/KD, and export options.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-fuchsia-300" aria-hidden="true">
        <path
          d="M5 3h10l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 1H5v16h12V8h-4V4Zm-5 6h6v2H8v-2Zm0 4h4v2H8v-2Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

const steps = [
  { title: 'Upload', detail: 'Upload CSV/exports, ingest KD and player data in seconds.', accent: 'Data in' },
  { title: 'Analyze', detail: 'Review dashboards, rankings, Honor and Activity on any device.', accent: 'Insights' },
  { title: 'Decide', detail: 'Set rewards, assign roles, and communicate priorities clearly.', accent: 'Go live' },
];

const features = [
  'Honor dashboard and ranking with public KvK views',
  'Overview dashboard for KPIs and progress',
  'Player analytics: comparisons, trends, engagement',
  'File uploads with history and role permissions',
  'Roles: R4 / R5 / Admin with safe sharing',
  'Kingdom management and slug-based links',
];

const pricingPlans = [
  {
    name: 'Starter',
    tagline: 'For smaller kingdoms and first KvK preparation.',
    priceHint: 'from •• / month',
    points: ['Core dashboards', 'Guided upload', 'Email support (async)', 'Public KvK view'],
    action: 'View demo',
    onAction: (handlers: LandingHandlers) => handlers.onSeeDefault(),
  },
  {
    name: 'Pro',
    tagline: 'For active R4/R5 who need faster decisions.',
    priceHint: 'from •• / month',
    highlight: 'Most popular',
    points: ['All dashboards and player analytics', 'Roles and public sharing', 'Report exports and trends', 'Priority support'],
    action: 'Get started',
    onAction: (handlers: LandingHandlers) => handlers.onStartShop(),
  },
  {
    name: 'Enterprise',
    tagline: 'For multi-kingdom teams and council ops.',
    priceHint: 'from •• / month',
    points: ['Multi-kingdom management', 'Council onboarding', 'Custom SLAs and privacy', 'Dedicated contact'],
    action: 'Contact us',
    onAction: (_handlers: LandingHandlers) => {
      window.open('mailto:contact@rise-of-stats.com', '_blank');
    },
  },
];

const faqs = [
  {
    question: 'How about privacy and security?',
    answer: 'Uploads stay in your account, public links are read-only. Roles control all access.',
  },
  {
    question: 'Which files are needed?',
    answer: 'Standard exports from Rise of Kingdoms are enough. Upload helpers show required fields.',
  },
  {
    question: 'Who has access?',
    answer: 'Roles for R4, R5, Admin plus read-only public views. Rights can be changed anytime.',
  },
  {
    question: 'How fast is setup?',
    answer: 'First dashboards in minutes. The demo kingdom is your blueprint.',
  },
  {
    question: 'Is there support?',
    answer: 'Yes. From email to personal onboarding depending on the plan.',
  },
];

type LandingHandlers = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const SectionHeader: React.FC<{ label: string; title: string; subtitle?: string }> = ({
  label,
  title,
  subtitle,
}) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">{label}</p>
    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{title}</h2>
    {subtitle ? <p className="text-slate-300 max-w-3xl">{subtitle}</p> : null}
  </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop, onOpenLogin }) => {
  const handlers: LandingHandlers = { onSeeDefault, onStartShop, onOpenLogin };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-950 to-black" />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
        <header className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-emerald-100">
              Rise of Stats
              <span className="h-1 w-1 rounded-full bg-emerald-300" />
              Kingdom Analytics
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-white">
                Rise of Stats - Kingdom Analytics
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed">
                The command center for R4/R5: uploads, dashboards, KvK insights, and roles in one fast, clear interface.
                Less chaos, better decisions.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
              >
                View demo
              </button>
              <button
                onClick={onStartShop}
                className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
              >
                Get started
              </button>
              <button
                onClick={onOpenLogin}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Login / Contact
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Dashboards</p>
                <p className="text-base font-semibold text-white">Honor, Overview, Player</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Time saved</p>
                <p className="text-base font-semibold text-white">Uploads -> Insights</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Roles</p>
                <p className="text-base font-semibold text-white">R4 / R5 / Admin</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-black/50">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_60%_80%,rgba(251,191,36,0.12),transparent_35%)]" />
            <div className="relative p-8 space-y-6">
              <div className="flex items-center gap-3 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-xs text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Live analytics for council and leads
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">KVK FLOW</p>
                <p className="text-2xl font-bold text-white leading-snug">
                  Honor, rankings, activity, and upload history in one surface. No extra tools or messy exports.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Public KvK</p>
                  <p className="text-base font-semibold text-white">Shareable by slug, read-only and safe</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Upload history</p>
                  <p className="text-base font-semibold text-white">Versions and comparisons per player</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                {['Auditable', 'Role-based', 'Mobile-ready', 'Dark-mode optimized'].map(label => (
                  <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-8">
          <SectionHeader
            label="Benefits"
            title="Why kingdoms pick Rise of Stats"
            subtitle="Faster decisions, less manual work, and clear data for wars, rewards, and diplomacy."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(benefit => (
              <div
                key={benefit.title}
                className="h-full rounded-2xl border border-white/5 bg-white/5 p-5 shadow-lg shadow-black/40 transition hover:-translate-y-1 hover:border-emerald-300/40"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-semibold text-white">{benefit.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionHeader
            label="How it works"
            title="Three steps from upload to decision"
            subtitle="Fewer meetings, more clarity. The app stays Vite + React and is easy to extend."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative h-full rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 shadow-lg shadow-black/40"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                    {step.accent}
                  </div>
                  <span className="text-sm text-slate-400">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <SectionHeader
            label="Features"
            title="What you get"
            subtitle="All key modules in one place. No extra tooling, no wasted clicks."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(feature => (
              <div
                key={feature}
                className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200"
              >
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
                <p>{feature}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/10 via-slate-900/60 to-sky-500/10 p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center gap-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Social proof</p>
              <h3 className="text-2xl font-bold text-white">Used by kingdoms across EU, NA, and APAC</h3>
              <p className="text-slate-300">
                Neutral placeholder for logos and references. Ideal for trust elements in sales calls.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-200">
              {['Kingdom 123', 'Imperium 999', 'Coalition Alpha', 'Council Beta'].map(label => (
                <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <SectionHeader
            label="Pricing"
            title="Plans without risk"
            subtitle="No payment integration. Price labels are placeholders for sales discussions."
          />
          <div className="grid gap-6 md:grid-cols-3">
            {pricingPlans.map(plan => (
              <div
                key={plan.name}
                className="relative h-full rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 shadow-xl shadow-black/50"
              >
                {plan.highlight ? (
                  <div className="absolute right-4 top-4 rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    {plan.highlight}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">{plan.priceHint}</p>
                  <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{plan.tagline}</p>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  {plan.points.map(point => (
                    <div key={point} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => plan.onAction(handlers)}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-emerald-300/60 hover:bg-emerald-400/20"
                  >
                    {plan.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader label="FAQ" title="Frequently asked questions" />
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map(item => (
              <div
                key={item.question}
                className="h-full rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-slate-200 shadow-md shadow-black/40"
              >
                <h3 className="text-base font-semibold text-white">{item.question}</h3>
                <p className="mt-2 leading-relaxed text-slate-300">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-r from-slate-900 via-emerald-900/40 to-slate-900 p-8 shadow-2xl shadow-black/60">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] items-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Ready?</p>
              <h3 className="text-3xl font-bold text-white leading-tight">
                Start with the demo, upload your data, and activate your council in minutes.
              </h3>
              <p className="text-slate-300">
                No payment integration, no hidden steps. Use local tokens until your own auth is in place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
              >
                View demo
              </button>
              <button
                onClick={onStartShop}
                className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
              >
                Get started
              </button>
              <a
                href="mailto:contact@rise-of-stats.com"
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Contact
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 pt-8 text-sm text-slate-300">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Rise of Stats - KD Analytics</p>
              <p className="text-slate-400">Data, roles, and insights for kingdom leads.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a className="text-slate-400 hover:text-white transition" href="#" aria-label="Imprint placeholder">
                Imprint
              </a>
              <a className="text-slate-400 hover:text-white transition" href="#" aria-label="Privacy placeholder">
                Privacy
              </a>
              <button
                onClick={onOpenLogin}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300/50 hover:text-emerald-100"
              >
                Open login
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
