import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, Paperclip, Sparkles, Check, Loader2, Pause, PlayCircle,
  Image as ImageIcon, Video, Upload, Wand2, ShieldCheck, Calendar,
  Target, MapPin, Wallet, Clock, FileDown,
} from "lucide-react";
import { printHtmlAsPdf } from "@/lib/print-pdf";
import { useCampaigns } from "@/lib/campaigns-store";
import { useNotifications } from "@/lib/notifications-store";
import { launchCampaign } from "@/functions/campaigns";

export const Route = createFileRoute("/_authenticated/app/campaigns/new")({
  head: () => ({ meta: [{ title: "Nouvelle campagne — Orkestria" }, { name: "robots", content: "noindex" }] }),
  component: NewCampaign,
});

/* --------------------------------- Types --------------------------------- */
type Role = "user" | "agent" | "system";
type Msg = { id: string; role: Role; text?: string; ui?: React.ReactNode };

type Brief = {
  product?: string;
  price?: string;
  goal?: string;
  zone?: string;
  channel?: string;
  capacity?: string;
  duration?: string;
  budget?: string;
  media?: string;
};

/* ------------------------------ Main screen ------------------------------ */
function NewCampaign() {
  const [step, setStep] = useState<"chat" | "preview" | "execute" | "done">("chat");
  const [brief, setBrief] = useState<Brief>({});
  const [plan, setPlan] = useState<null | Plan>(null);

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_10px_30px_-10px_rgba(255,108,2,0.6)]">
            <Sparkles className="h-5 w-5" />
            <span className="absolute inset-0 rounded-2xl ring-1 ring-white/40" />
          </span>
          <div>
            <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Assistant campagne</p>
            <h1 className="mt-0.5 font-display text-[26px] font-semibold text-ink">Créer une campagne</h1>
            <p className="text-[13px] text-ink-soft">
              Décrivez votre objectif — je m'occupe du reste : plan média, créations, protection.
            </p>
          </div>
        </div>
        <Link to="/app/campaigns" className="chip-ghost">Annuler</Link>
      </header>

      <ProgressStrip step={step} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {step === "chat" && (
            <ChatFlow
              brief={brief}
              onBriefChange={setBrief}
              onDone={(p) => { setPlan(p); setStep("preview"); }}
            />
          )}
          {step === "preview" && plan && (
            <Preview plan={plan} onEdit={() => setStep("chat")} onApprove={() => setStep("execute")} />
          )}
          {step === "execute" && plan && (
            <Execute brief={brief} plan={plan} onDone={() => setStep("done")} />
          )}
          {step === "done" && <Done />}
        </div>

        <aside className="space-y-4">
          <BriefCard brief={brief} />
          <TipsCard />
        </aside>
      </div>
    </div>
  );
}

/* ----------------------------- Progress strip ----------------------------- */
const STEPS = [
  { id: "chat", label: "Compréhension" },
  { id: "preview", label: "Prévisualisation" },
  { id: "execute", label: "Exécution" },
  { id: "done", label: "Activation" },
] as const;

function ProgressStrip({ step }: { step: string }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="card-soft flex flex-wrap items-center gap-2 rounded-2xl p-2">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                active
                  ? "bg-gradient-to-br from-ink to-ink/80 text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]"
                  : done
                  ? "bg-gradient-to-br from-[#fff1e2] to-[#ffe1c4] text-[#ff6c02] ring-1 ring-[#ff6c02]/20"
                  : "bg-white/70 text-ink-soft ring-1 ring-line/60"
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                active ? "bg-white text-ink shadow-inner" : done ? "bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white" : "bg-white text-ink-soft ring-1 ring-line"
              }`}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------- Scripted chat flow ---------------------------- */
type Question = {
  key: keyof Brief;
  prompt: string;
  suggestions?: string[];
  placeholder?: string;
};

const QUESTIONS: Question[] = [
  { key: "price", prompt: "Parfait. Quel est le prix de ce menu ?", suggestions: ["3 500 FCFA", "5 000 FCFA", "7 500 FCFA"], placeholder: "Ex : 4 500 FCFA" },
  { key: "zone", prompt: "Où livrez-vous ? (ville ou quartiers)", suggestions: ["Cocody", "Marcory + Zone 4", "Tout Abidjan"], placeholder: "Cocody, Marcory…" },
  { key: "capacity", prompt: "Combien de commandes pouvez-vous traiter par jour ?", suggestions: ["20 / jour", "50 / jour", "100+ / jour"], placeholder: "Ex : 40" },
  { key: "channel", prompt: "Les clients doivent-ils commander sur WhatsApp ou sur votre site ?", suggestions: ["WhatsApp", "Site web", "Les deux"] },
  { key: "budget", prompt: "Quel budget total sur combien de jours ?", suggestions: ["150 000 FCFA · 7 jours", "250 000 FCFA · 14 jours", "500 000 FCFA · 30 jours"], placeholder: "Ex : 250 000 FCFA · 14 jours" },
];

function ChatFlow({
  brief, onBriefChange, onDone,
}: {
  brief: Brief;
  onBriefChange: (b: Brief) => void;
  onDone: (p: Plan) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "m0", role: "agent", text: "Bonjour 👋 Je suis Orkestria. Dites-moi ce que vous voulez lancer, en une phrase." },
  ]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"intro" | "questions" | "analysing" | "plan">("intro");
  const [qIdx, setQIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const push = (m: Msg) => setMessages((prev) => [...prev, m]);

  const respondAsAgent = async (text: string, delay = 700) => {
    setTyping(true);
    await wait(delay);
    setTyping(false);
    push({ id: uid(), role: "agent", text });
  };

  const submit = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    push({ id: uid(), role: "user", text: value });
    setInput("");

    if (phase === "intro") {
      const nextBrief: Brief = {
        ...brief,
        product: value,
        goal: guessGoal(value),
      };
      onBriefChange(nextBrief);
      await respondAsAgent(
        `Compris — objectif : ${nextBrief.goal}. Je regarde vos anciennes campagnes similaires en parallèle. Quelques questions rapides d'abord.`,
        800,
      );
      await wait(300);
      setPhase("questions");
      askQuestion(0);
      return;
    }

    if (phase === "questions") {
      const q = QUESTIONS[qIdx];
      const nextBrief = { ...brief, [q.key]: value } as Brief;
      onBriefChange(nextBrief);
      const next = qIdx + 1;
      if (next < QUESTIONS.length) {
        setQIdx(next);
        askQuestion(next);
      } else {
        setPhase("analysing");
        await respondAsAgent("Parfait. Je croise avec vos données GA4 et vos meilleures audiences historiques…", 500);
        push({ id: uid(), role: "system", ui: <AnalyseTimeline /> });
        await wait(3200);
        const plan = buildPlan(nextBrief);
        push({ id: uid(), role: "agent", text: "Voici le plan média que je propose. Vous pouvez l'ajuster en langage naturel." });
        push({ id: uid(), role: "system", ui: <PlanCard plan={plan} /> });
        setPhase("plan");
      }
      return;
    }

    if (phase === "plan") {
      // Natural adjustment
      await respondAsAgent(applyAdjustment(value), 700);
      const plan = buildPlan(brief, value);
      push({ id: uid(), role: "system", ui: <PlanCard plan={plan} /> });
    }
  };

  const askQuestion = async (i: number) => {
    const q = QUESTIONS[i];
    setTyping(true);
    await wait(600);
    setTyping(false);
    push({ id: uid(), role: "agent", text: q.prompt, ui: q.suggestions ? (
      <div className="mt-2 flex flex-wrap gap-2">
        {q.suggestions.map((s) => (
          <button key={s} onClick={() => submit(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-ink hover:border-[#ff6c02] hover:text-[#ff6c02]">
            {s}
          </button>
        ))}
      </div>
    ) : undefined });
  };

  const currentPlaceholder = useMemo(() => {
    if (phase === "intro") return "Ex : Lance une campagne pour mon nouveau menu";
    if (phase === "questions") return QUESTIONS[qIdx].placeholder ?? "Votre réponse";
    if (phase === "plan") return "Ex : Mets seulement 150 000 FCFA et concentre-toi sur Cocody";
    return "";
  }, [phase, qIdx]);

  return (
    <div className="card-soft card-hover flex h-[640px] flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-line/60 bg-gradient-to-br from-white via-[#fffaf3] to-[#fff2e2] px-5 py-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white shadow-[0_8px_20px_-8px_rgba(255,108,2,0.6)]">
          <Sparkles className="h-4 w-4" />
          <span className="absolute inset-0 animate-ping rounded-full bg-[#ff6c02]/30" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink">Orkestria</p>
          <p className="text-[11px] text-emerald-600">● en ligne · analyse en temps réel</p>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 space-y-4 overflow-y-auto bg-gradient-to-br from-[#fdfaf4] via-white to-[#fff6ec] px-5 py-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
        <div className="relative space-y-4">
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        {typing && (
          <div className="flex items-center gap-2 text-[12px] text-ink-soft">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff6c02]/10 text-[#ff6c02]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="flex gap-1">
              <Dot /> <Dot d={0.15} /> <Dot d={0.3} />
            </span>
          </div>
        )}

        {phase === "plan" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onDone(buildPlan(brief))} className="btn-primary !py-2 !px-4 !text-[13px]">
              Approuver et prévisualiser <Check className="h-4 w-4" />
            </button>
            <button onClick={() => submit("Ajuste avec plus de TikTok et moins de Google")} className="chip-ghost bg-surface-2">
              <Wand2 className="h-4 w-4" /> Ajuster avec Orkestria
            </button>
          </div>
        )}
        </div>
      </div>

      <div className="border-t border-line/60 bg-gradient-to-br from-white to-[#fff6ec] p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-line/70 bg-white px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_20px_-12px_rgba(0,0,0,0.15)] focus-within:border-[#ff6c02] focus-within:ring-2 focus-within:ring-[#ff6c02]/20">
          <button className="chip-ghost !p-2" aria-label="Joindre un fichier"><Paperclip className="h-4 w-4" /></button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
            }}
            rows={1}
            placeholder={currentPlaceholder}
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-ink placeholder:text-ink-soft focus:outline-none"
          />
          <button onClick={() => submit(input)} className="btn-primary btn-halo !p-2" aria-label="Envoyer">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-ink-soft">
          ⏎ pour envoyer · Shift+⏎ pour un retour à la ligne · Orkestria pose une seule question à la fois.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- Bubbles -------------------------------- */
function Bubble({ m }: { m: Msg }) {
  if (m.role === "system") return <div>{m.ui}</div>;
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
        isUser
          ? "bg-gradient-to-br from-ink to-ink/80 text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/5"
          : "bg-white/85 text-ink ring-1 ring-line/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-14px_rgba(0,0,0,0.15)] backdrop-blur"
      }`}>
        {m.text}
        {m.ui}
      </div>
    </div>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff6c02]" style={{ animationDelay: `${d}s` }} />;
}

/* ------------------------------ Analyse card ----------------------------- */
function AnalyseTimeline() {
  const steps = [
    "Lecture des campagnes similaires",
    "Meilleures audiences détectées",
    "Meilleurs horaires et zones",
    "Coûts historiques par plateforme",
    "Données GA4 intégrées",
  ];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDone((d) => (d < steps.length ? d + 1 : d)), 550);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="card-soft rounded-2xl p-4">
      <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-[#ff6c02]">Analyse historique</p>
      <ul className="space-y-2 text-[13px]">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i < done ? <Check className="h-4 w-4 text-emerald-500" /> : <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />}
            <span className={i < done ? "text-ink" : "text-ink-soft"}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Plan --------------------------------- */
type Plan = {
  goal: string;
  duration: string;
  budget: string;
  split: { channel: "Meta" | "Google" | "TikTok"; amount: string; share: number }[];
  creatives: string[];
  protection: string;
  estimate: string;
};

function buildPlan(brief: Brief, adjust?: string): Plan {
  const isCocody = /cocody/i.test(adjust ?? brief.zone ?? "");
  const reducedBudget = /150\s*000/.test(adjust ?? "");
  const moreTikTok = /tiktok/i.test(adjust ?? "");

  const total = reducedBudget ? 150000 : 250000;
  const meta = moreTikTok ? 0.4 : 0.6;
  const tiktok = moreTikTok ? 0.45 : 0.28;
  const google = 1 - meta - tiktok;

  return {
    goal: brief.goal ?? "100 conversations WhatsApp",
    duration: reducedBudget ? "10 jours" : "14 jours",
    budget: `${total.toLocaleString("fr-FR")} FCFA`,
    split: [
      { channel: "Meta", amount: `${Math.round(total * meta).toLocaleString("fr-FR")} FCFA`, share: meta * 100 },
      { channel: "TikTok", amount: `${Math.round(total * tiktok).toLocaleString("fr-FR")} FCFA`, share: tiktok * 100 },
      { channel: "Google", amount: `${Math.round(total * google).toLocaleString("fr-FR")} FCFA`, share: google * 100 },
    ],
    creatives: ["2 vidéos verticales", "2 affiches", "1 carrousel"],
    protection: `Arrêter une publicité après 20 000 FCFA dépensés sans résultat${isCocody ? " · zone limitée à Cocody" : ""}`,
    estimate: reducedBudget ? "55 à 75 conversations WhatsApp" : "90 à 130 conversations WhatsApp",
  };
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line/70 bg-white">
      <div className="border-b border-line/60 bg-gradient-to-br from-[#fff6ee] to-white px-5 py-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff6c02]">Plan média proposé</p>
        <p className="mt-1 font-display text-[16px] font-semibold text-ink">{plan.goal}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 px-5 py-4 text-[13px] sm:grid-cols-4">
        <Kv icon={Target} label="Objectif" value={plan.goal} />
        <Kv icon={Clock} label="Durée" value={plan.duration} />
        <Kv icon={Wallet} label="Budget" value={plan.budget} />
        <Kv icon={ShieldCheck} label="Protection" value="Auto-pause activée" />
      </div>
      <div className="border-t border-line/60 px-5 py-4">
        <p className="mb-2 text-[12px] uppercase tracking-wider text-ink-soft">Répartition</p>
        {plan.split.map((s) => (
          <div key={s.channel} className="mb-2 flex items-center gap-3 text-[13px]">
            <span className="w-16 font-medium text-ink">{s.channel}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-2 ${channelColor(s.channel)}`} style={{ width: `${s.share}%` }} />
            </div>
            <span className="w-32 text-right text-ink-soft">{s.amount}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-line/60 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[12px] uppercase tracking-wider text-ink-soft">Créations</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink">
            {plan.creatives.map((c) => <li key={c}>· {c}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-wider text-ink-soft">Estimation</p>
          <p className="mt-2 text-[13px] text-ink">{plan.estimate}</p>
          <p className="mt-1 text-[11px] text-ink-soft">Intervalle basé sur vos 90 derniers jours.</p>
        </div>
      </div>
      <div className="border-t border-line/60 bg-surface-2/60 px-5 py-3 text-[12px] text-ink-soft">
        {plan.protection}
      </div>
    </div>
  );
}

function Kv({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-soft">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}

function channelColor(c: string) {
  return c === "Meta" ? "bg-[#1877f2]" : c === "TikTok" ? "bg-ink" : "bg-[#ff6c02]";
}

/* ------------------------------- Preview -------------------------------- */
function Preview({ plan, onEdit, onApprove }: { plan: Plan; onEdit: () => void; onApprove: () => void }) {
  const [choice, setChoice] = useState("templates");
  const exportMediaPlan = () => {
    const rows = plan.split.map((s) =>
      `<tr><td>${s.channel}</td><td>${s.amount}</td><td>${Math.round(s.share)}%</td></tr>`
    ).join("");
    printHtmlAsPdf("Plan média — Orkestria", `
      <span class="badge">Plan média</span>
      <h1>${plan.goal}</h1>
      <p class="muted">Durée : ${plan.duration} · Budget total : ${plan.budget}</p>
      <div class="card">
        <h2>Répartition par canal</h2>
        <table><thead><tr><th>Canal</th><th>Budget</th><th>Part</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="card">
        <h2>Protection</h2>
        <p>${plan.protection}</p>
      </div>
      <div class="card">
        <h2>Estimation</h2>
        <p>${plan.estimate}</p>
      </div>`);
  };
  const exportCreatives = () => {
    const items = plan.creatives.map((c) => `<li>${c}</li>`).join("");
    printHtmlAsPdf("Récapitulatif créations — Orkestria", `
      <span class="badge">Créations</span>
      <h1>${plan.goal} — Créations</h1>
      <p class="muted">Formats prévus pour Meta, TikTok et Google.</p>
      <div class="card">
        <h2>Livrables</h2>
        <ul style="font-size:13px; line-height:1.6;">${items}</ul>
      </div>
      <div class="card grid2">
        <div><h2>Message</h2><p>Nouveau menu — Livraison en 30 min. Commandez maintenant sur WhatsApp.</p></div>
        <div><h2>Diffusion</h2><p>09:00 → 22:00 · pic à 12h et 19h · zones à forte densité prioritaires.</p></div>
      </div>`);
  };
  return (
    <div className="space-y-4">
      <PlanCard plan={plan} />

      <div className="rounded-2xl border border-line/70 bg-white p-5">
        <p className="mb-3 font-display text-[15px] font-semibold text-ink">Créations</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { id: "mine", i: ImageIcon, l: "Mes médias" },
            { id: "templates", i: Wand2, l: "Templates" },
            { id: "poster", i: Upload, l: "Importer affiche" },
            { id: "video", i: Video, l: "Importer vidéo" },
            { id: "ai", i: Sparkles, l: "IA externe (BYOK)" },
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => setChoice(o.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12px] transition ${
                choice === o.id ? "border-[#ff6c02] bg-[#fff6ee]" : "border-line hover:border-ink/40"
              }`}
            >
              <o.i className={`h-4 w-4 ${choice === o.id ? "text-[#ff6c02]" : "text-ink-soft"}`} /> {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line/70 bg-white p-5">
        <p className="mb-3 font-display text-[15px] font-semibold text-ink">Prévisualisations par plateforme</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {["Meta", "TikTok", "Google"].map((c) => (
            <div key={c} className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between border-b border-line/60 bg-surface-2 px-3 py-2 text-[12px]">
                <span className="font-medium text-ink">{c}</span>
                <span className="text-ink-soft">Aperçu 9:16</span>
              </div>
              <div className="relative aspect-[9/16] bg-gradient-to-br from-ink/90 via-ink to-ink/70">
                <div className="absolute inset-0 flex flex-col justify-end p-3 text-white">
                  <p className="text-[11px] uppercase tracking-wider text-white/70">Nouveau menu</p>
                  <p className="font-display text-[18px] font-semibold">Livraison en 30 min</p>
                  <p className="mt-1 text-[11px] text-white/80">Commandez maintenant sur WhatsApp</p>
                  <button className="mt-3 rounded-full bg-[#ff6c02] px-3 py-1.5 text-[11px] font-medium">Commander</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line/70 bg-white p-5">
        <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          <Calendar className="h-4 w-4 text-[#ff6c02]" /> Calendrier
        </p>
        <div className="flex items-center gap-2 text-[12px] text-ink-soft">
          <MapPin className="h-3.5 w-3.5" /> Diffusion 09:00 → 22:00 · pic à 12h et 19h · zones à forte densité prioritaires
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-line/70 bg-white p-4">
        <button onClick={onApprove} className="btn-primary">Tout approuver et lancer</button>
        <button onClick={onEdit} className="chip-ghost bg-surface-2">Modifier avec Orkestria</button>
        <button onClick={exportMediaPlan} className="chip-ghost bg-surface-2">
          <FileDown className="h-4 w-4" /> Exporter le plan média (PDF)
        </button>
        <button onClick={exportCreatives} className="chip-ghost bg-surface-2">
          <FileDown className="h-4 w-4" /> Exporter les créations (PDF)
        </button>
        <button className="chip-ghost bg-surface-2">Enregistrer comme brouillon</button>
      </div>
    </div>
  );
}

/* -------------------------------- Execute -------------------------------- */
function Execute({
  brief,
  plan,
  onDone,
}: {
  brief: Brief;
  plan: Plan;
  onDone: () => void;
}) {
  const { push } = useNotifications();
  const { syncMeta } = useCampaigns();
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = [
    "Vérification connexion Meta",
    "Création campagne (pause)",
    "Création ensemble publicitaire",
    "Enregistrement Orkestria",
    "Terminé",
  ];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setStepIndex(1);
        const name = brief.product ?? plan.goal.slice(0, 80) ?? "Campagne Orkestria";
        setStepIndex(2);
        const result = await launchCampaign({
          data: {
            name,
            budget: plan.budget,
            duration: plan.duration,
            zone: brief.zone,
          },
        });
        if (cancelled) return;
        setStepIndex(3);
        await syncMeta();
        setStepIndex(steps.length);
        push({
          kind: "status",
          title: "Campagne Meta créée",
          body: result.message ?? "Campagne en pause sur Meta Ads.",
        });
        setTimeout(onDone, 600);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Échec de création");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-line/70 bg-white p-6">
      <p className="text-[12px] uppercase tracking-wider text-[#ff6c02]">Exécution</p>
      <h2 className="mt-1 font-display text-[20px] font-semibold text-ink">Création sur Meta Ads</h2>
      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-700">{error}</p>
      ) : (
        <ul className="mt-5 space-y-2.5 text-[14px]">
          {steps.map((s, idx) => (
            <li key={s} className="flex items-center gap-3">
              {idx < stepIndex ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3 w-3" />
                </span>
              ) : idx === stepIndex ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#ff6c02]" />
              ) : (
                <span className="h-5 w-5 rounded-full border border-line" />
              )}
              <span className={idx <= stepIndex ? "text-ink" : "text-ink-soft"}>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------- Done --------------------------------- */
function Done() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"draft" | "paused" | "live">("paused");
  return (
    <div className="rounded-2xl border border-line/70 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-[20px] font-semibold text-ink">Campagnes prêtes</h2>
          <p className="text-[13px] text-ink-soft">Par défaut, elles restent en pause jusqu'à votre validation finale.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { id: "draft", i: Wand2, t: "Garder en brouillon", d: "Je continue de peaufiner." },
          { id: "paused", i: Pause, t: "Laisser en pause", d: "Recommandé — vous décidez quand lancer." },
          { id: "live", i: PlayCircle, t: "Activer maintenant", d: "Diffusion immédiate." },
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setMode(o.id as typeof mode)}
            className={`rounded-2xl border p-4 text-left transition ${
              mode === o.id ? "border-[#ff6c02] bg-[#fff6ee]" : "border-line hover:border-ink/40"
            }`}
          >
            <o.i className={`h-4 w-4 ${mode === o.id ? "text-[#ff6c02]" : "text-ink-soft"}`} />
            <p className="mt-2 text-[14px] font-medium text-ink">{o.t}</p>
            <p className="mt-1 text-[12px] text-ink-soft">{o.d}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => nav({ to: "/app/campaigns" })} className="btn-primary">Voir mes campagnes</button>
        <button onClick={() => nav({ to: "/app" })} className="chip-ghost bg-surface-2">Retour à l'accueil</button>
      </div>
    </div>
  );
}

/* ------------------------------- Brief card ----------------------------- */
function BriefCard({ brief }: { brief: Brief }) {
  const rows: [string, string | undefined][] = [
    ["Produit", brief.product],
    ["Objectif", brief.goal],
    ["Prix", brief.price],
    ["Zone", brief.zone],
    ["Canal", brief.channel],
    ["Capacité", brief.capacity],
    ["Budget", brief.budget],
  ];
  return (
    <div className="card-soft rounded-2xl p-5">
      <p className="text-[12px] uppercase tracking-wider text-ink-soft">Brief en construction</p>
      <dl className="mt-3 space-y-2 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 transition hover:bg-white/70">
            <dt className="text-ink-soft">{k}</dt>
            <dd className={`text-right font-medium ${v ? "text-ink" : "text-ink-soft/50"}`}>{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TipsCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink via-[#141414] to-[#0b0b0b] p-5 text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#ff6c02]/40 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.08 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")" }} />
      <div className="relative flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6c02] to-[#ffb04a] text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-[12px] font-medium uppercase tracking-wider text-[#ff8a3d]">Astuce</p>
      </div>
      <p className="relative mt-2 text-[13px] leading-relaxed text-white/90">
        Parlez naturellement : « mets 150 000 FCFA sur Cocody » ou « double le budget TikTok ». Je recalcule le plan et je vous explique l'impact attendu.
      </p>
    </div>
  );
}

/* --------------------------------- Utils --------------------------------- */
function uid() { return Math.random().toString(36).slice(2); }
function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function guessGoal(text: string) {
  const t = text.toLowerCase();
  if (t.includes("prospect") || t.includes("lead")) return "Générer des prospects qualifiés";
  if (t.includes("visite") || t.includes("trafic")) return "Amener du trafic vers le site";
  if (t.includes("notoriété") || t.includes("notoriete")) return "Faire connaître la marque";
  return "100 conversations WhatsApp";
}
function applyAdjustment(text: string) {
  return `Compris. Je recalcule le plan : ${text.toLowerCase().includes("cocody") ? "je concentre la diffusion sur Cocody, " : ""}j'ajuste les budgets et je vous propose une nouvelle estimation.`;
}