import React from 'react';

type LandingPageProps = {
  onSeeDefault: () => void;
  onStartShop: () => void;
  onOpenLogin: () => void;
};

const benefits = [
  {
    title: 'Sofortige Auswertung',
    description: 'Uploads verarbeiten, KPIs berechnen und für Rat & R4/R5 sofort verständlich visualisieren.',
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
    title: 'Leadership-Entscheidungen',
    description: 'Trends, Honor & Activity in einem Blick, damit Kriegs- und Belohnungsentscheidungen sitzen.',
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
    title: 'Rollen & Zugriffssteuerung',
    description: 'R4, R5, Admin: getrennte Zugriffe, Public-Shares für sichere Einsicht ohne Risiko.',
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
    title: 'Historie & Reports',
    description: 'Versionierte Uploads, Vergleiche pro Spieler/KD und Export-Optionen für Meetings.',
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
  { title: 'Upload', detail: 'CSV/Exports hochladen, KD & Player-Daten in Sekunden einlesen.', accent: 'Daten rein' },
  { title: 'Analyse', detail: 'Dashboards, Rankings, Honor & Activity prüfen – mobil & Desktop.', accent: 'Insights' },
  { title: 'Entscheidung', detail: 'Belohnungen steuern, Rollen zuweisen, Prioritäten klar kommunizieren.', accent: 'Go live' },
];

const features = [
  'Honor Dashboard & Ranking mit Public-KvK-Ansichten',
  'Overview Dashboard für KPIs & Fortschritt',
  'Player Analytics: Vergleiche, Trends, Engagement',
  'Datei-Uploads mit Historie und Rollenrechten',
  'Rollen: R4 / R5 / Admin mit sicherem Sharing',
  'Kingdom Management & Slug-basierte Links',
];

const pricingPlans = [
  {
    name: 'Starter',
    tagline: 'Für kleine Kingdoms & erste KvK-Vorbereitung.',
    priceHint: 'ab •• / Monat',
    points: ['Basis-Dashboards', 'Geführter Upload', 'E-Mail Support (Async)', 'Öffentliche KvK-Ansicht'],
    action: 'Demo ansehen',
    onAction: (handlers: LandingHandlers) => handlers.onSeeDefault(),
  },
  {
    name: 'Pro',
    tagline: 'Für aktive R4/R5, die schneller entscheiden müssen.',
    priceHint: 'ab •• / Monat',
    highlight: 'Beliebt',
    points: ['Alle Dashboards & Player Analytics', 'Rollen & Public Sharing', 'Report-Exports & Trends', 'Priorisierter Support'],
    action: 'Jetzt starten',
    onAction: (handlers: LandingHandlers) => handlers.onStartShop(),
  },
  {
    name: 'Enterprise',
    tagline: 'Für Imperiums-Teams & Mehr-Kingdom-Setups.',
    priceHint: 'ab •• / Monat',
    points: ['Multi-Kingdom Management', 'Onboarding für Council', 'Eigene SLAs & Datenschutz', 'Direkter Ansprechpartner'],
    action: 'Kontakt aufnehmen',
    onAction: (_handlers: LandingHandlers) => {
      window.open('mailto:contact@rise-of-stats.com', '_blank');
    },
  },
];

const faqs = [
  {
    question: 'Wie steht es um Datenschutz & Sicherheit?',
    answer: 'Alle Uploads bleiben in eurem Account, Public-Links sind lesend. Rollen sorgen dafür, dass nur freigeschaltete Personen Änderungen sehen.',
  },
  {
    question: 'Welche Dateien werden benötigt?',
    answer: 'Standard-Exports aus Rise of Kingdoms genügen. Upload-Assistenten zeigen, welche Felder gebraucht werden.',
  },
  {
    question: 'Wer hat Zugriff?',
    answer: 'Rollen für R4, R5, Admin sowie schreibgeschützte Public-Ansichten. Rechte lassen sich jederzeit entziehen.',
  },
  {
    question: 'Wie schnell ist das Setup?',
    answer: 'Erste Dashboards in wenigen Minuten. Demo-Kingdom dient als Blaupause, damit ihr sofort loslegt.',
  },
  {
    question: 'Gibt es Support?',
    answer: 'Ja. Von E-Mail bis persönlichem Onboarding je nach Plan. Feedback fließt direkt in neue Releases ein.',
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
                Rise of Stats – Kingdom Analytics
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed">
                Die zentrale Schaltstelle für R4/R5: Uploads, Dashboards, KvK-Insights und Rollenverwaltung in einem
                klaren, schnellen Interface. Weniger Chaos, mehr Entscheidungen.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
              >
                Demo ansehen
              </button>
              <button
                onClick={onStartShop}
                className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
              >
                Jetzt starten
              </button>
              <button
                onClick={onOpenLogin}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Login / Kontakt
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Dashboards</p>
                <p className="text-base font-semibold text-white">Honor, Overview, Player</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Zeitersparnis</p>
                <p className="text-base font-semibold text-white">Uploads → Insights</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Rollen</p>
                <p className="text-base font-semibold text-white">R4 / R5 / Admin</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-black/50">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_60%_80%,rgba(251,191,36,0.12),transparent_35%)]" />
            <div className="relative p-8 space-y-6">
              <div className="flex items-center gap-3 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-xs text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Live-Auswertung für Council & Leads
              </div>
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">KVK FLOW</p>
                <p className="text-2xl font-bold text-white leading-snug">
                  Honor, Rankings, Activity und Upload-Historie in einer Oberfläche. Ohne zusätzliche Tools oder
                  komplizierte Exporte.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Public KvK</p>
                  <p className="text-base font-semibold text-white">Teilbar per Slug, lesend & sicher</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Upload-Historie</p>
                  <p className="text-base font-semibold text-white">Versionen & Vergleiche pro Spieler</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                {['Auditierbar', 'Rollenbasiert', 'Mobilfähig', 'Dark-Mode optimiert'].map(label => (
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
            label="Nutzen"
            title="Warum Kingdoms auf Rise of Stats setzen"
            subtitle="Schnelle Entscheidungen, weniger manuelle Arbeit und klare Daten für Kriege, Belohnungen und Diplomatie."
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
            label="So funktioniert’s"
            title="Drei Schritte von Upload bis Entscheidung"
            subtitle="Weniger Meetings, mehr Klarheit. Die App bleibt Vite + React und ist leicht anpassbar."
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
            title="Was du bekommst"
            subtitle="Alle wichtigen Module gebündelt. Kein zusätzliches Tooling, keine unnötigen Klicks."
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
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Social Proof</p>
              <h3 className="text-2xl font-bold text-white">Genutzt von Kingdoms aus EU, NA und APAC</h3>
              <p className="text-slate-300">
                Neutraler Platzhalter für Logos und Referenzen. Ideal für Trust-Elemente in Sales-Gesprächen.
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
            label="Preise"
            title="Pläne ohne Risiko"
            subtitle="Keine Zahlungsintegration eingebaut. Preisangaben sind Platzhalter und können im Vertrieb geklärt werden."
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
          <SectionHeader label="FAQ" title="Die häufigsten Fragen" />
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
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Bereit?</p>
              <h3 className="text-3xl font-bold text-white leading-tight">
                Starte mit der Demo, lade eure Daten hoch und aktiviere das Council in wenigen Minuten.
              </h3>
              <p className="text-slate-300">
                Keine Zahlungsintegration, keine versteckten Schritte. Du steuerst über lokale Tokens, bis deine eigene
                Auth-Lösung steht.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
              >
                Demo ansehen
              </button>
              <button
                onClick={onStartShop}
                className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
              >
                Jetzt starten
              </button>
              <button
                onClick={() => window.open('mailto:contact@rise-of-stats.com', '_blank')}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Kontakt
              </button>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 pt-8 text-sm text-slate-300">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-white">Rise of Stats – KD Analytics</p>
              <p className="text-slate-400">Daten, Rollen und Insights für Kingdom-Leads.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <a className="text-slate-400 hover:text-white transition" href="#" aria-label="Impressum Platzhalter">
                Impressum
              </a>
              <a className="text-slate-400 hover:text-white transition" href="#" aria-label="Datenschutz Platzhalter">
                Datenschutz
              </a>
              <button
                onClick={onOpenLogin}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:border-emerald-300/50 hover:text-emerald-100"
              >
                Login öffnen
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
