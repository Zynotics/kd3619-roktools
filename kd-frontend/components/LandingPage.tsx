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
      'Aggregierte Kill- und Power-Deltas, Ehrenverlauf und Player-Suche in einem Interface – sofort einsatzbereit ohne Konfiguration.',
  },
  {
    title: 'Activity & Upload-Pipeline',
    description:
      'Automatische Auswertung der Uploads (Overview, Honor, Activity) mit klarer Historie und visuellen Charts für dein Team.',
  },
  {
    title: 'Zugang per Access-Code',
    description:
      'Shop mit Laufzeitoptionen, Login-geschützt. Nach Kauf wird die Aktivierung angeleitet – transparent und sicher.',
  },
  {
    title: 'Rollen & Onboarding',
    description:
      'R5 wird automatisch gesetzt, neue Kingdoms erhalten einen Naming-Flow, danach können Invites an R4/R5/Raid-Leads raus.',
  },
];

const flowSteps = [
  {
    title: 'Zugangscode sichern',
    detail:
      'Wähle im Shop die passende Laufzeit (1 Tag bis 1 Jahr). Checkout benötigt Login oder Registrierung, damit dein Zugang eindeutig ist.',
  },
  {
    title: 'Kingdom erstellen & benennen',
    detail:
      'Nach dem Kauf wirst du direkt zum Setup geführt. Vergib einen Kingdom-Namen, wir legen das Profil an und setzen dich als R5.',
  },
  {
    title: 'Code aktivieren',
    detail:
      'Aktiviere deinen Code, damit Uploads, KvK-Tracking und Analytics freigeschaltet werden. Der Aktivierungsstatus ist jederzeit sichtbar.',
  },
  {
    title: 'Team onboarden',
    detail:
      'Lade R4/R5 oder Analysten ein. Standard-User können per Public-Link einen sicheren Read-Only Blick bekommen.',
  },
];

const previewStats = [
  { label: 'Aktive Kämpfer', value: '420', hint: '+32 diese Woche' },
  { label: 'Ø Kill-Score', value: '18.4B', hint: 'T4/T5 kombiniert' },
  { label: 'Honor-Boost', value: '+640%', hint: 'vs. Phase-Start' },
];

const LandingPage: React.FC<LandingPageProps> = ({ onSeeDefault, onStartShop, onOpenLogin }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 border border-blue-700/50 text-xs uppercase tracking-widest text-blue-200">
              Rise of Stats · KvK Intelligence für Kingdom Leads
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl lg:text-5xl font-black leading-tight">
                Willkommen im neuen Kontrollzentrum <span className="text-blue-400">deines Kingdoms</span>
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed">
                Zeig potentiellen Käufern sofort, was sie erwartet: eine komplette KvK- und Player-Analytics-Suite, Demo am Default-Kingdom,
                geführter Shop-Flow mit Access-Code und automatisiertem Kingdom-Setup. Alles, was du brauchst, um schneller zu entscheiden.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onSeeDefault}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition text-sm font-semibold shadow-lg shadow-blue-900/40"
              >
                Default Kingdom live ansehen
              </button>
              <button
                onClick={onStartShop}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition text-sm font-semibold shadow-lg shadow-emerald-900/40"
              >
                Access-Code kaufen
              </button>
              <button
                onClick={onOpenLogin}
                className="px-5 py-3 rounded-xl border border-gray-700 text-sm font-semibold text-gray-200 hover:border-gray-500 hover:text-white transition"
              >
                Anmelden
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
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-200 font-semibold">
                Demo
              </div>
              <div>
                <p className="text-gray-200 font-semibold">Default Kingdom ohne Login</p>
                <p>Nutze den Live-Datensatz, um Ranking, Honor-Kurven und Player-Search auszuprobieren. Alles read-only, komplett öffentlich.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" aria-hidden />
            <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-blue-200">KvK Radar</p>
                  <p className="text-2xl font-bold">Live Demo Snapshot</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-600/20 text-emerald-200 border border-emerald-500/40">
                  R5 ready
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2">
                  <p className="text-sm text-gray-400">Kill-Delta</p>
                  <p className="text-3xl font-black text-white">+6.3B</p>
                  <p className="text-xs text-emerald-300">Top Alliance führt mit 1.2B</p>
                </div>
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2">
                  <p className="text-sm text-gray-400">Honor-Korridor</p>
                  <p className="text-3xl font-black text-white">4.7M → 29.3M</p>
                  <p className="text-xs text-blue-300">Events & Phasenwechsel sichtbar</p>
                </div>
                <div className="bg-black/30 border border-gray-700 rounded-2xl p-4 space-y-2 col-span-2">
                  <p className="text-sm text-gray-400">Player Journey</p>
                  <p className="text-lg font-semibold">Filtere nach Gov-ID, Allianz, Kill-Punkten oder Dead-Goals.</p>
                  <p className="text-xs text-gray-400">Upload-Historie, Event-Zuordnung und DKP-Ziele sind sofort im Demo-Datensatz enthalten.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onSeeDefault}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
                >
                  Live-Demo öffnen
                </button>
                <button
                  onClick={onStartShop}
                  className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 text-sm font-semibold"
                >
                  Zugangscode holen
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Kein Risiko: Die Demo ist read-only. Nach der Code-Aktivierung kannst du Uploads, KvK-Manager und R5-Tools nutzen.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-widest text-blue-200">Was dich erwartet</p>
            <h2 className="text-3xl font-bold">Feature-Highlights für Käufer</h2>
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
              <p className="text-sm uppercase tracking-widest text-blue-200">Geführter Ablauf</p>
              <h2 className="text-3xl font-bold">Von Kauf bis Aktivierung in vier Schritten</h2>
            </div>
            <button
              onClick={onStartShop}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow shadow-emerald-900/30"
            >
              Jetzt Zugang starten
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
              <h2 className="text-3xl font-bold">Erkunde den Demo-Datensatz</h2>
              <p className="text-gray-300 mt-2 max-w-3xl">
                Öffne das Default Kingdom, um echte Uploads, KvK-Events und Player-Suchen auszuprobieren. Du kannst Rankings filtern,
                Honor-Verläufe anschauen und Activity-History prüfen – ganz ohne Login.
              </p>
            </div>
            <button
              onClick={onSeeDefault}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold shadow shadow-blue-900/30"
            >
              Default Kingdom öffnen
            </button>
          </div>
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-200 border border-blue-500/30">Public</span>
                <p className="text-sm text-gray-300">Keine Anmeldung nötig · Read-only Preview</p>
              </div>
              <p className="text-lg font-semibold text-white">Was du siehst</p>
              <ul className="space-y-2 text-sm text-gray-300 list-disc list-inside">
                <li>Live KvK-Rankings & Ehrenverläufe pro Event</li>
                <li>Player-Suche mit ID, Name und Allianz-Filter</li>
                <li>Activity-Uploads mit Zeitstempeln und File-Historie</li>
                <li>Beispielhafte DKP- & Dead-Ziele für Transparenz</li>
              </ul>
              <p className="text-xs text-gray-500">Tipp: Speichere die Seite mit <code className="bg-gray-800 px-1 rounded">?slug=default-kingdom</code> als Bookmark.</p>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Shop & Aktivierung</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                Der Zugang zum Shop ist geschützt. Nach Login oder Registrierung leitest du den Kauf ein, danach wirst du automatisch zum
                Kingdom-Setup und zur Code-Aktivierung geführt.
              </p>
              <div className="space-y-2 text-xs text-gray-400">
                <p>• Access-Code gekauft → Name wählen → R5 gesetzt</p>
                <p>• Aktivierungsstatus sichtbar, Erinnerungen im Dashboard</p>
                <p>• Weitere Codes können für R5-Erweiterungen genutzt werden</p>
              </div>
              <button
                onClick={onStartShop}
                className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold"
              >
                Zugangscode sichern
              </button>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-700/20 via-blue-600/10 to-emerald-600/10 border border-blue-700/40 rounded-3xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-widest text-blue-200">Bereit?</p>
            <h3 className="text-2xl font-bold">Starte jetzt, sichere deinen Code und werde sofort R5 deines Kingdoms.</h3>
            <p className="text-gray-300 max-w-3xl">
              Wir kombinieren Demo-Transparenz mit einem geführten Checkout. Käufer sehen zuerst den Nutzen, holen sich dann den Code und werden ohne Umwege
              durch Setup, Naming und Aktivierung geleitet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onStartShop}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow-lg shadow-emerald-900/40"
            >
              Access-Code starten
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
