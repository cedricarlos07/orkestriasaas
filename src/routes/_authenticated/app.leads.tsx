import { createFileRoute } from "@tanstack/react-router";
import { Star, Users, Coins, Percent, ShoppingBag, Sparkles, MessageCircle, Phone, CheckCircle2, Calendar, XCircle, AlertOctagon, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/leads")({ component: Leads });

const STATES = [
  { l: "Nouveau", tone: "from-sky-50 to-white text-sky-700 ring-sky-200" },
  { l: "Contacté", tone: "from-indigo-50 to-white text-indigo-700 ring-indigo-200" },
  { l: "Répondu", tone: "from-violet-50 to-white text-violet-700 ring-violet-200" },
  { l: "Qualifié", tone: "from-amber-50 to-white text-amber-700 ring-amber-200" },
  { l: "Rendez-vous", tone: "from-orange-50 to-white text-[#ff6c02] ring-[#ff6c02]/25" },
  { l: "Client", tone: "from-emerald-50 to-white text-emerald-700 ring-emerald-200" },
  { l: "Perdu", tone: "from-slate-50 to-white text-slate-600 ring-slate-200" },
  { l: "Faux numéro", tone: "from-red-50 to-white text-red-700 ring-red-200" },
] as const;

const STATE_TONE: Record<string, string> = Object.fromEntries(STATES.map((s) => [s.l, s.tone]));

const LEADS = [
  { name: "Aminata K.", source: "WhatsApp · Meta", score: 78, state: "Qualifié" },
  { name: "Yao B.", source: "Formulaire Meta", score: 62, state: "Contacté" },
  { name: "Fatou D.", source: "Google Search", score: 92, state: "Client" },
  { name: "Kouassi M.", source: "TikTok", score: 30, state: "Répondu" },
  { name: "N° inconnu", source: "WhatsApp", score: 0, state: "Faux numéro" },
  { name: "Awa T.", source: "Site web", score: 84, state: "Rendez-vous" },
];

const KPIS = [
  { k: "Leads 30j", v: "312", icon: Users, grad: "from-sky-100 via-white to-sky-50", accent: "text-sky-700", chip: "bg-sky-500" },
  { k: "Coût / lead", v: "1 360 FCFA", icon: Coins, grad: "from-[#fff1e2] via-white to-[#ffe1c4]", accent: "text-[#ff6c02]", chip: "bg-[#ff6c02]" },
  { k: "Taux de qualification", v: "42 %", icon: Percent, grad: "from-violet-100 via-white to-violet-50", accent: "text-violet-700", chip: "bg-violet-500" },
  { k: "Ventes confirmées", v: "68", icon: ShoppingBag, grad: "from-emerald-100 via-white to-emerald-50", accent: "text-emerald-700", chip: "bg-emerald-500" },
];

function sourceIcon(src: string) {
  if (src.includes("WhatsApp")) return { I: MessageCircle, tone: "bg-emerald-500" };
  if (src.includes("Meta")) return { I: Users, tone: "bg-sky-500" };
  if (src.includes("Google")) return { I: Star, tone: "bg-[#ff6c02]" };
  if (src.includes("TikTok")) return { I: Sparkles, tone: "bg-pink-500" };
  return { I: Phone, tone: "bg-slate-500" };
}

function scoreTone(s: number) {
  if (s >= 80) return "text-emerald-700 bg-emerald-50 ring-emerald-200";
  if (s >= 60) return "text-amber-700 bg-amber-50 ring-amber-200";
  if (s > 0) return "text-slate-700 bg-slate-50 ring-slate-200";
  return "text-red-700 bg-red-50 ring-red-200";
}

function Leads() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_10px_30px_-10px_rgba(255,108,2,0.6)]">
          <Users className="h-5 w-5" />
          <span className="absolute inset-0 animate-ping rounded-2xl bg-[#ff6c02]/20" />
        </span>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Prospects · Ventes · Qualité</p>
          <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Leads & ventes</h1>
          <p className="text-[13px] text-ink-soft">Score personnalisable par entreprise. Vue unifiée toutes sources confondues.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {KPIS.map((s, i) => (
          <div
            key={s.k}
            className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.grad} p-4 ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-14px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-14px_rgba(0,0,0,0.2)] animate-fade-in`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.25]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0.05 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
            <div className="relative flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{s.k}</p>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.3)] ${s.chip}`}>
                <s.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className={`relative mt-2 font-display text-[22px] font-semibold ${s.accent}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-soft overflow-hidden rounded-2xl">
          <div className="flex flex-wrap gap-1.5 border-b border-line/60 bg-gradient-to-br from-[#fdfaf4] to-white px-4 py-3 text-[12px]">
            {STATES.map((s) => {
              const [gradFrom, gradTo, text, ring] = s.tone.split(" ");
              return (
                <button key={s.l} className={`rounded-full bg-gradient-to-br ${gradFrom} ${gradTo} px-3 py-1 font-medium ${text} ring-1 ${ring} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:-translate-y-0.5`}>{s.l}</button>
              );
            })}
          </div>
          <div className="relative overflow-x-auto">
            <div className="pointer-events-none absolute inset-0 opacity-[0.2]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
            <table className="relative w-full min-w-[640px] text-left text-[14px]">
              <thead className="bg-gradient-to-br from-[#fffaf3] to-white text-[11px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-5 py-3 font-semibold">Prospect</th>
                  <th className="px-3 py-3 font-semibold">Source</th>
                  <th className="px-3 py-3 font-semibold">Score</th>
                  <th className="px-3 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {LEADS.map((l, i) => {
                  const src = sourceIcon(l.source);
                  const [gradFrom, gradTo, text, ring] = (STATE_TONE[l.state] ?? "from-slate-50 to-white text-slate-700 ring-slate-200").split(" ");
                  return (
                    <tr key={l.name} className={`border-t border-line/50 transition hover:bg-white/70 ${i % 2 === 0 ? "bg-white/40" : "bg-transparent"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#fff1e2] to-white text-[11px] font-semibold text-[#ff6c02] ring-1 ring-[#ff6c02]/20">
                            {l.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </span>
                          <span className="font-medium text-ink">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 text-[12px] text-ink ring-1 ring-line/60 backdrop-blur">
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-white ${src.tone}`}>
                            <src.I className="h-2.5 w-2.5" />
                          </span>
                          {l.source}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ${scoreTone(l.score)}`}>
                          <Star className="h-3 w-3" fill="currentColor" /> {l.score}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full bg-gradient-to-br ${gradFrom} ${gradTo} px-2.5 py-0.5 text-[12px] font-medium ${text} ring-1 ${ring} shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]`}>{l.state}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="relative h-fit overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#141414] to-[#0b0b0b] p-5 text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#ff6c02]/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-[#ff8a3d]/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
          <div className="relative flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_8px_20px_-8px_rgba(255,108,2,0.6)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#ff8a3d]">Insight Orkestria</p>
          </div>
          <p className="relative mt-3 text-[14px] leading-relaxed text-white/90">
            TikTok génère les prospects les moins chers, mais Google génère les prospects qui achètent le plus souvent. Voulez-vous que je déplace 20 % du budget TikTok vers Google Search ?
          </p>
          <div className="relative mt-4 flex flex-wrap gap-2">
            <button className="btn-primary btn-halo !px-3.5 !py-2 !text-[12px]"><Send className="h-3.5 w-3.5" /> Proposer un plan</button>
            <button className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">Plus tard</button>
          </div>
        </div>
      </section>
    </div>
  );
}