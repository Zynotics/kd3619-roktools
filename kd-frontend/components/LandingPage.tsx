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
      'Aggregierte Kill- und Power-Deltas, Honor-Verlauf und Spieler-Suche in einer Ansicht - sofort nutzbar, ohne Setup.',
  },
  {
    title: 'Aktivitaet & Uploads',
    description:
      'Automatische Verarbeitung von Overview-, Honor- und Aktivitaets-Uploads mit Historie und Visuals fuer dein Team.',
  },
  {
    title: 'Zugriffscode & Shop',
    description:
      'Flexibler Shop mit Login-Schutz. Nach dem Kauf fuehrt dich der Ablauf sicher durch die Aktivierung.',
  },
  {
    title: 'Rollen & Onboarding',
    description:
      'R5 wird automatisch gesetzt, neue Koenigreiche folgen der Benennung, Einladungen an R4/R5/Raid-Leads inklusive.',
  },
];

const flowSteps = [
  {
    title: 'Zugriffscode sichern',
    detail:
      'Waehle die passende Laufzeit im Shop (1 Tag bis 1 Jahr). Der Checkout erfordert Login oder Registrierung.',
  },
  {
    title: 'Koenigreich erstellen und benennen',
    detail:
      'Nach dem Kauf geht es direkt ins Setup. Du waehlst den Namen, wir erstellen das Profil und setzen dich als R5.',
  },
  {
    title: 'Code aktivieren',
    detail:
      'Aktiviere deinen Code, um Uploads, KvK-Tracking und Analysen freizuschalten. Der Status ist jederzeit sichtbar.',
  },
  {
    title: 'Team onboarden',
    detail:
      'Lade R4/R5 oder Analysten ein. Standard-User nutzen den Public-Link fuer die read-only Ansicht.',
  },
];

const previewStats = [
  { label: 'Aktive Kaempfer', value: 'Stufe A', hint: 'Beispielwerte' },
  { label: 'Kill-Index', value: 'Stufe B', hint: 'T4/T5 kombiniert' },
  { label: 'Honor-Impuls', value: 'Stufe A', hint: 'gegenueber Start' },
];

const previewCharts = [
  {
    title: 'Allianz-Tempo',
    subtitle: 'Anonymisierte Indizes',
    bars: [
      { label: 'Allianz A', value: 78 },
      { label: 'Allianz B', value: 62 },
      { label: 'Allianz C', value: 45 },
    ],
  },
  {
    title: 'Honor-Verlauf',
    subtitle: 'Beispielhafte Phasen',
    bars: [
      { label: 'Phase 1', value: 40 },
      { label: 'Phase 2', value: 70 },
      { label: 'Phase 3', value: 55 },
    ],
  },
  {
    title: 'Aktivitaets-Cluster',
    subtitle: 'Fiktive Segmente',
    bars: [
      { label: 'Segment X', value: 65 },
      { label: 'Segment Y', value: 52 },
      { label: 'Segment Z', value: 33 },
    ],
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop, onOpenLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-700/50 text-xs uppercase tracking-widest text-blue-200">
              Rise of Stats | KvK Intelligence fuer Kingdom Leads
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black leading-tight">
                Das neue Kontrollzentrum <span className="text-blue-400">fuer dein Koenigreich</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                Ein klarer Einblick in KvK-Analysen, Rankings und Honor-Verlaeufe. Die Demo zeigt den Ablauf von Uploads,
                Zielen und Vergleichen - kompakt, professionell und ohne reale Spielernamen oder Werte.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-sm font-semibold shadow-lg shadow-blue-900/40"
              >
                Standard-Koenigreich ansehen
              </button>
              <button
                onClick={onStartShop}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition text-sm font-semibold shadow-lg shadow-emerald-900/40"
              >
                Zugriffscode kaufen
              </button>
              <button
                onClick={onOpenLogin}
                className="px-5 py-3 rounded-xl border border-gray-700 text-sm font-semibold text-gray-200 hover:border-gray-500 hover:text-white transition"
              >
                Login
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {previewStats.map(item => (
                <div
                  key={item.label}
                  className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-inner shadow-black/40"
                >
                  <p className="text-xs uppercase tracking-widest text-gray-400">{item.label}</p>
                  <p className="text-2xl font-bold text-white mt-2">{item.value}</p>
                  <p className="text-xs text-blue-300 mt-1">{item.hint}</p>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {previewCharts.map(chart => (
                <div
                  key={chart.title}
                  className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-inner shadow-black/40"
                >
                  <p className="text-xs uppercase tracking-widest text-gray-400">{chart.title}</p>
                  <p className="text-[11px] text-blue-300 mt-1">{chart.subtitle}</p>
                  <div className="mt-4 space-y-2">
                    {chart.bars.map(bar => (
                      <div key={bar.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>{bar.label}</span>
                          <span>Fiktiv</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/40 border border-gray-700 overflow-hidden">
                          <div
                            className="h-full bg-blue-500/70"
                            style={{ width: `${bar.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-200 font-semibold">
                Demo
              </div>
              <div>
                <p className="text-gray-200 font-semibold">Standard-Koenigreich ohne Login</p>
                <p>Teste Rankings, Honor-Kurven und Suche mit anonymisierten Beispielen. Vollstaendig oeffentlich und read-only.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" aria-hidden />
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-200">KvK Radar</p>
                  <p className="text-2xl font-bold">Fiktiver Demo Snapshot</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-200 border border-emerald-500/40">
                  R5 ready
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2">
                  <p className="text-sm text-gray-400">Kill-Trend</p>
                  <p className="text-3xl font-black text-white">Index Hoch</p>
                  <p className="text-xs text-emerald-300">Fuehrung in der Beispiel-Allianz</p>
                </div>
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2">
                  <p className="text-sm text-gray-400">Honor-Korridor</p>
                  <p className="text-3xl font-black text-white">Band A bis C</p>
                  <p className="text-xs text-blue-300">Events und Phasen sichtbar</p>
                </div>
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2 col-span-2">
                  <p className="text-sm text-gray-400">Profil-Analyse</p>
                  <p className="text-lg font-semibold">Filter nach ID, Allianz, Kill-Index oder Dead-Goals.</p>
                  <p className="text-xs text-gray-400">Upload-Historie, Event-Mapping und DKP-Ziele sind im Demo-Beispiel enthalten.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSeeDefault}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
                >
                  Demo oeffnen
                </button>
                <button
                  onClick={onStartShop}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 text-sm font-semibold"
                >
                  Zugriffscode holen
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Hinweis: Die Demo ist read-only. Nach Aktivierung stehen Uploads, KvK-Management und R5-Tools bereit.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-blue-200">Was dich erwartet</p>
            <h2 className="text-3xl font-bold">Highlights der Plattform</h2>
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
              <p className="text-sm uppercase tracking-widest text-blue-200">Gefuehrter Ablauf</p>
              <h2 className="text-3xl font-bold">Von Kauf bis Aktivierung in vier Schritten</h2>
            </div>
            <button
              onClick={onStartShop}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow shadow-emerald-900/30"
            >
              Zugriff starten
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
              <p className="text-sm uppercase tracking-widest text-blue-200">Standard-Koenigreich</p>
              <h2 className="text-3xl font-bold">Demo-Datensatz erkunden</h2>
              <p className="text-gray-300 mt-2 max-w-3xl">
                Oeffne das Standard-Koenigreich, um Rankings, Honor-Verlauf und Suche zu testen. Die Daten sind anonymisiert,
                damit du einen echten Eindruck vom Ablauf bekommst - komplett ohne Login.
              </p>
            </div>
            <button
              onClick={onSeeDefault}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
            >
              Standard-Koenigreich oeffnen
            </button>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-200 border border-blue-500/30">Public</span>
                <p className="text-sm text-gray-300">Kein Login noetig - read-only Vorschau</p>
              </div>
              <p className="text-lg font-semibold text-white">Was du siehst</p>
              <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>KvK-Rankings und Honor-Progress pro Event</li>
                <li>Suche mit ID-, Name- und Allianz-Filter</li>
                <li>Aktivitaets-Uploads mit Zeitstempeln und History</li>
                <li>Beispielhafte DKP- und Dead-Goals</li>
              </ul>
              <p className="text-xs text-gray-500">
                Tipp: Speichere <code className="bg-gray-800 px-1 rounded">?slug=default-kingdom</code> fuer schnellen Zugriff.
              </p>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Shop und Aktivierung</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Der Shop ist geschuetzt. Nach Login oder Registrierung startest du den Kauf, danach folgt die
                Koenigreich-Einrichtung und die Code-Aktivierung.
              </p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>Zugriffscode gekauft -&gt; Name waehlen -&gt; R5 gesetzt</p>
                <p>Aktivierungsstatus sichtbar, Hinweise im Dashboard</p>
                <p>Zusatzcodes fuer R5-Verlaengerungen</p>
              </div>
              <button
                onClick={onStartShop}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Zugriffscode sichern
              </button>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-700/20 via-blue-600/10 to-emerald-600/10 border border-blue-700/40 rounded-3xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-blue-200">Bereit?</p>
            <h3 className="text-2xl font-bold">Starte jetzt, sichere deinen Code und werde sofort R5 deines Koenigreichs.</h3>
            <p className="text-gray-300 max-w-3xl">
              Eine klare Demo, ein gefuehrter Checkout. Du siehst zuerst die Inhalte, sicherst dir den Code und wirst durch
              Setup, Benennung und Aktivierung gefuehrt - ohne Umwege.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onStartShop}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow-lg shadow-emerald-900/40"
            >
              Zugriffscode starten
            </button>
            <button
              onClick={onSeeDefault}
              className="px-5 py-3 rounded-xl bg-gray-900 border border-gray-700 hover:border-blue-500 text-sm font-semibold"
            >
              Demo ansehen
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
